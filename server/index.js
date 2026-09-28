import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import { config, ROOT, ALLOWED_EXTENSIONS, modelConfigured } from './config.js';
import { normalizeInput, validateInput, completeUrlInput } from './input.js';
import { collectFromUrl } from './collectors/url.js';
import { collectFromFiles } from './collectors/files.js';
import { analyze } from './analyzer.js';
import { generatePdf, reportFilename } from './report/pdf.js';
import { t, normLang } from './i18n.js';

const RESULTS_DIR = path.join(config.dataDir, 'results');
const UPLOADS_DIR = path.join(config.dataDir, 'uploads');
fs.mkdirSync(RESULTS_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// نتيجة التجربة لكل لغة
const DEMO_IDS = { demo: 'ar', 'demo-en': 'en' };
// تُعاد نتيجة التجربة عند كل تشغيل حتى تعكس آخر نسخة من القواعد والقالب
for (const id of Object.keys(DEMO_IDS)) fs.rmSync(path.join(RESULTS_DIR, `${id}.json`), { force: true });
const jobs = new Map(); // id -> { status, progress, error }

// لغة الطلب: ?lang= ثم حقل النموذج، والعربية افتراضيًا
const reqLang = (req) => normLang(req.query.lang || (req.body && req.body.lang));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      req.jobId ||= crypto.randomUUID();
      const dir = path.join(UPLOADS_DIR, req.jobId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    // multer يقرأ أسماء الملفات بترميز latin1؛ نعيدها إلى UTF-8 لتظهر الأسماء العربية صحيحة
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) cb(null, true);
    else cb(new Error(t(reqLang(req), 'input.bad_file', { name: file.originalname })));
  },
});

const resultPath = (id) => path.join(RESULTS_DIR, `${id}.json`);
const thumbPath = (id) => path.join(RESULTS_DIR, `${id}.jpg`);
const validId = (id) => /^[a-z0-9-]{1,64}$/i.test(id);

async function loadDemo(lang) {
  const pick = async (base) => {
    const en = path.join(config.demoDir, `${base}.en.json`);
    const file = lang === 'en' && fs.existsSync(en) ? en : path.join(config.demoDir, `${base}.json`);
    return JSON.parse(await fsp.readFile(file, 'utf8'));
  };
  const filesDir = path.join(config.demoDir, 'files');
  const files = (await fsp.readdir(filesDir)).sort().map((name) => ({ path: path.join(filesDir, name), originalname: name }));
  return { input: await pick('input'), files, recorded: await pick('recorded-analysis') };
}

async function runJob(id, input, files, { recorded = null } = {}) {
  const job = jobs.get(id);
  const L = input.lang;
  const progress = (msg) => {
    job.progress = msg;
  };
  job.status = 'running';
  try {
    progress(t(L, input.source === 'url' ? 'progress.browser' : 'progress.files'));
    const collected = input.source === 'url' ? await collectFromUrl(input, progress) : await collectFromFiles(files, L);
    if (input.source === 'url') completeUrlInput(input, collected);
    // صورة مصغرة للصفحة الأولى لعرضها في رأس صفحة النتائج فقط (لا تدخل في التقرير)
    const thumbnail = collected.thumbnail;
    delete collected.thumbnail;
    if (thumbnail) await fsp.writeFile(thumbPath(id), thumbnail);
    progress(t(L, 'progress.rules'));
    const result = await analyze(input, collected, { recordedAnalysis: recorded, onProgress: progress });
    result.id = id;
    result.meta.has_thumbnail = Boolean(thumbnail);
    progress(t(L, 'progress.finish'));
    await fsp.writeFile(resultPath(id), JSON.stringify(result, null, 2));
    job.status = 'done';
    progress(t(L, 'progress.done'));
  } catch (e) {
    console.error(e);
    job.status = 'error';
    job.error = t(L, 'job.failed', { msg: String(e.message || e).split('\n')[0] });
  }
}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(ROOT, 'public')));
app.use('/fonts', express.static(path.join(ROOT, 'node_modules/@fontsource/ibm-plex-sans-arabic/files')));

app.get('/api/status', (req, res) => {
  res.json({ model_configured: modelConfigured(), model: config.model });
});

app.get('/api/demo', async (req, res) => {
  const { input, files } = await loadDemo(reqLang(req));
  res.json({ input, files: files.map((f) => f.originalname) });
});

app.post('/api/analyze', upload.array('files', 20), async (req, res) => {
  const id = req.jobId || crypto.randomUUID();
  const lang = reqLang(req);
  let files = (req.files || []).map((f) => ({ path: f.path, originalname: f.originalname }));
  let input;
  let recorded = null;

  if (req.body.demo === '1') {
    // بيانات التجربة: ملفات جاهزة؛ بدون مفتاح نموذج يُستخدم التحليل المسجل لها
    const demo = await loadDemo(lang);
    input = normalizeInput({ ...demo.input, source: 'file', lang });
    files = demo.files;
    if (!modelConfigured()) recorded = demo.recorded;
  } else {
    input = normalizeInput({ ...req.body, lang });
    if (input.source === 'url') files = [];
  }

  const errors = validateInput(input, files.length);
  if (errors.length) return res.status(400).json({ errors });

  jobs.set(id, { status: 'queued', progress: t(lang, 'progress.queued') });
  runJob(id, input, files, { recorded });
  res.status(202).json({ id });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (job) return res.json(job);
  if (validId(req.params.id) && fs.existsSync(resultPath(req.params.id))) return res.json({ status: 'done' });
  res.status(404).json({ error: t(reqLang(req), 'job.not_found') });
});

async function readResult(id) {
  if (!validId(id)) return null;
  if (DEMO_IDS[id] && !fs.existsSync(resultPath(id))) {
    // نتيجة التجربة تُنشأ عند أول طلب لتفتح صفحة النتائج مباشرة بدون مفتاح نموذج
    const lang = DEMO_IDS[id];
    const demo = await loadDemo(lang);
    const input = normalizeInput({ ...demo.input, source: 'file', lang });
    const result = await analyze(input, await collectFromFiles(demo.files, lang), { recordedAnalysis: demo.recorded });
    result.id = id;
    await fsp.writeFile(resultPath(id), JSON.stringify(result, null, 2));
  }
  try {
    return JSON.parse(await fsp.readFile(resultPath(id), 'utf8'));
  } catch {
    return null;
  }
}

app.get('/api/results/:id', async (req, res) => {
  const result = await readResult(req.params.id);
  if (!result) return res.status(404).json({ error: t(reqLang(req), 'result.not_found') });
  res.json(result);
});

app.get('/api/results/:id/thumb.jpg', (req, res) => {
  if (!validId(req.params.id) || !fs.existsSync(thumbPath(req.params.id))) return res.status(404).end();
  res.sendFile(thumbPath(req.params.id));
});

app.get('/api/results/:id/report.pdf', async (req, res) => {
  const result = await readResult(req.params.id);
  if (!result) return res.status(404).json({ error: t(reqLang(req), 'result.not_found') });
  try {
    const pdf = await generatePdf(result);
    const name = reportFilename(result);
    const ascii = name.replace(/[^\x20-\x7e]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.send(pdf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: t(result.meta.lang, 'pdf.failed', { msg: String(e.message || e).split('\n')[0] }) });
  }
});

app.use((err, req, res, next) => {
  res.status(400).json({ errors: [String(err.message || err)] });
});

app.listen(config.port, () => {
  console.log(`Quality Review is running: http://localhost:${config.port}`);
  console.log(modelConfigured() ? `AI model: ${config.model}` : 'No model key: analysis uses the evidence-based rules only.');
});
