import fs from 'node:fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { config, modelConfigured, CONFIDENCES } from './config.js';
import { CATEGORIES, SEVERITIES, EFFORTS, SEVERITY_RANK, CATEGORY_STANDARDS, CHECKLIST, categoryScore, performanceScore, priorityValue, rateMetric } from './standards.js';
import { checkAnalytics, deterministicAnalytics } from './analytics.js';
import { ruleFindings } from './rules.js';
import { t } from './i18n.js';
import { executiveSummary } from './summary.js';

const systemPrompt = (lang) => `أنت مدقق جودة ويب أول، خبير في إمكانية الوصول وأبحاث تجربة المستخدم والأداء وتصوير البيانات. تدقق موقعًا واحدًا فتحه متصفح آلي، مقابل هذه المعايير:
1. accessibility: WCAG 2.2 المستوى AA (لوحة المفاتيح، ظهور التركيز، التباين، دعم قارئات الشاشة للرسوم والجداول، ARIA، تسميات النماذج).
2. usability: استدلالات نيلسن العشرة و ISO 9241-11 (الفعالية، الكفاءة، الرضا) للمهام الرئيسية.
3. performance: Core Web Vitals (LCP ≤ 2.5s، INP ≤ 200ms، CLS ≤ 0.1)، حجم الصفحة، الموارد المعطِّلة، الصور، التخزين المؤقت، تحميل البيانات الكبيرة.
4. data_visualization: وضوح الرسوم، ملاءمة نوع الرسم للبيانات، التسميات، ألوان آمنة لعمى الألوان، عدم تضليل المقاييس، بدائل نصية أو جدولية.
5. responsive: السلوك على الجوال واللوحي وسطح المكتب.
6. security_privacy: HTTPS، موافقة ملفات الارتباط، مشكلات OWASP Top 10 الظاهرة من الواجهة، التعامل مع البيانات الحساسة.
7. seo_content: HTML دلالي، بنية العناوين، وسوم meta، وضوح النصوص.

قواعد ملزمة:
- فكّر في كل فئة خطوة بخطوة قبل أي استنتاج.
- اعتمد على الدليل المجموع المرفق فقط (لقطات الصفحات، نتائج axe، قياسات الأداء، الترويسات، الرسوم). لا تفترض سلوكًا لم يظهر، ولا تعتمد على معرفة عامة عن مواقع مشابهة.
- كل ملاحظة: category من القائمة أعلاه، و standard يذكر المعيار المخالف بدقة (مثل "WCAG 2.2 SC 1.4.3 Contrast (Minimum) (AA)" أو "Nielsen heuristic #9" أو "Core Web Vitals — LCP ≤ 2.5 s" أو "OWASP A05:2021")، و where يحدد المكان (رابط الصفحة أو محدد العنصر)، و evidence يقتبس الدليل، و evidence_source بالقيمة الحرفية من المصادر المسموحة، و recommendation إصلاح عملي، و code مثال كود عند الحاجة أو نص فارغ، و effort تقدير الجهد (low أقل من يوم، medium أيام، high أكثر).
- الشدة: critical إذا منعت إكمال مهمة رئيسية أو كشفت بيانات حساسة أو خالفت معيارًا قانونيًا صريحًا. high إذا أعاقت المهمة بشدة أو استبعدت فئة من المستخدمين. medium إذا أكمل المستخدم بصعوبة واضحة. low إذا كان الإزعاج لا يوقف المهمة.
- confidence: high فقط إذا كان الدليل مباشرًا وصريحًا. medium إذا احتاج استنتاجًا بسيطًا. low إذا كان جزئيًا.
- ما لا يمكن التحقق منه من الدليل اكتبه في insufficient_evidence مع طريقة اختباره يدويًا (الأداة والخطوات)، ولا تخمّن.
- لا تكرر الملاحظة نفسها، ولا تكرر ملاحظات القواعد الآلية المرفقة؛ أضف ما لا تغطيه، خصوصًا استدلالات نيلسن ووضوح النصوص وملاءمة الرسوم.
- أحداث التحليلات: لا تعدّ حدثًا ظهر في الدليل ناقصًا.
- التوصية مقترح يخضع لمراجعة بشرية.
- ${t(lang, 'model.language')}
- success_condition_met: yes إذا أظهر الدليل تحقق شرط النجاح، no إذا أظهر عدم تحققه، unknown إذا لم يكفِ الدليل.
- journey_state: completed أو stopped أو unknown، و stopped_at_step رقم الخطوة التي توقفت عندها الرحلة أو -1.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['success_condition_met', 'success_condition_basis', 'journey_state', 'stopped_at_step', 'findings', 'missing_analytics_events', 'insufficient_evidence'],
  properties: {
    success_condition_met: { type: 'string', enum: ['yes', 'no', 'unknown'] },
    success_condition_basis: { type: 'string' },
    journey_state: { type: 'string', enum: ['completed', 'stopped', 'unknown'] },
    stopped_at_step: { type: 'integer' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'title', 'standard', 'severity', 'step', 'evidence_source', 'evidence', 'where', 'impact', 'recommendation', 'code', 'effort', 'confidence'],
        properties: {
          category: { type: 'string', enum: CATEGORIES },
          title: { type: 'string' },
          standard: { type: 'string' },
          severity: { type: 'string', enum: SEVERITIES },
          step: { type: 'integer' },
          evidence_source: { type: 'string' },
          evidence: { type: 'string' },
          where: { type: 'string' },
          impact: { type: 'string' },
          recommendation: { type: 'string' },
          code: { type: 'string' },
          effort: { type: 'string', enum: EFFORTS },
          confidence: { type: 'string', enum: CONFIDENCES },
        },
      },
    },
    missing_analytics_events: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['event_name', 'when', 'why'],
        properties: { event_name: { type: 'string' }, when: { type: 'string' }, why: { type: 'string' } },
      },
    },
    insufficient_evidence: { type: 'array', items: { type: 'string' } },
  },
};

// ---------- تجهيز الدليل للنموذج ----------

function allowedSources(collected) {
  if (collected.source === 'url') return collected.steps.map((s) => `step:${s.number}`);
  return collected.files.map((f) => `file:${f.file}`);
}

function evidenceForModel(collected) {
  if (collected.source === 'url') {
    return {
      source: 'url',
      target_url: collected.target_url,
      auto_explored: Boolean(collected.auto_explored),
      all_steps_executed: collected.all_steps_executed,
      stopped_at_step: collected.stopped_at_step,
      steps: collected.steps.map((s) => ({
        evidence_source: `step:${s.number}`,
        number: s.number,
        written_step: s.text,
        status: s.status,
        action_result: s.action_result,
        error: s.error,
        page: s.page,
        network: (s.network || []).slice(0, 80),
        console_errors: s.console_errors,
        tracking_calls: s.tracking_calls,
      })),
      audit: compactAudit(collected.audit),
    };
  }
  return {
    source: 'file',
    files: collected.files.map((f) => {
      const { image_path, ...rest } = f;
      return { evidence_source: `file:${f.file}`, ...rest };
    }),
  };
}

function buildUserContent(input, collected, analyticsChecks, priorFindings = []) {
  const brief = {
    product_name: input.product_name,
    journey: input.journey,
    steps: input.steps,
    success_condition: input.success_condition,
    expected_features_and_stories: input.expected_features,
    expected_analytics_events: input.expected_events,
  };
  if (collected.auto_explored) {
    brief.note =
      'لم يكتب المستخدم خطوات: الخطوات أعلاه استكشاف تلقائي (تسجيل دخول إن وُجد حساب تجريبي ثم فتح روابط التنقل). قيّم ما ظهر في الصفحات المفتوحة فقط، ولا تعدّ عدم تنفيذ إجراءات لم تُطلب ملاحظة.';
  }
  if (!input.success_condition) brief.success_condition = 'غير محدد — استخدم unknown لـ success_condition_met';
  const content = [
    { type: 'text', text: `مدخلات المراجعة:\n${JSON.stringify(brief, null, 1)}` },
    { type: 'text', text: `مصادر الدليل المسموحة لحقل evidence_source:\n${JSON.stringify(allowedSources(collected))}` },
    { type: 'text', text: `الدليل المجموع:\n${JSON.stringify(evidenceForModel(collected), null, 1)}` },
    {
      type: 'text',
      text: `نتيجة الفحص الآلي لأحداث التحليلات (observed=true يعني أن الاسم ظهر في الدليل):\n${JSON.stringify(analyticsChecks, null, 1)}`,
    },
    {
      type: 'text',
      text: `ملاحظات سجلتها القواعد الآلية مسبقًا وستُعرض كما هي. لا تكررها ولا تعِد صياغتها؛ أضف فقط ما لا تغطيه:\n${JSON.stringify(
        priorFindings.map(({ category, standard, step, where, evidence }) => ({ category, standard, step, where, evidence })),
        null,
        1,
      )}`,
    },
  ];
  return content;
}

// نسخة مختصرة من التدقيق للنموذج (بدون القوائم الطويلة)
function compactAudit(a) {
  if (!a) return null;
  const perf = a.performance;
  return {
    pages: a.pages.map((p) => ({
      evidence_source: `step:${p.step}`,
      url: p.url,
      axe_violations: p.axe ? p.axe.violations.map((v) => ({ id: v.id, impact: v.impact, count: v.count, wcag: v.tags.filter((x) => /^wcag\d{3,}/.test(x)), targets: v.nodes.map((n) => n.target) })) : null,
      seo: p.seo,
      charts: p.charts,
      tables: p.tables,
      dom_nodes: p.dom_nodes,
      libs: p.libs,
      consent_banner: p.consent_banner,
    })),
    keyboard: a.keyboard,
    performance: perf
      ? {
          conditions: perf.conditions,
          metrics: perf.metrics,
          requests: perf.resources.length,
          total_kb: Math.round(perf.resources.reduce((x, r) => x + (r.bytes || 0), 0) / 1024),
          largest: [...perf.resources].sort((x, y) => (y.bytes || 0) - (x.bytes || 0)).slice(0, 12).map((r) => ({ url: r.url.slice(0, 120), type: r.type, kb: Math.round((r.bytes || 0) / 1024), cache: r.headers && r.headers['cache-control'], encoding: r.headers && r.headers['content-encoding'] })),
        }
      : null,
    responsive: a.responsive,
    security: a.security ? { https: a.security.https, http_redirects_to_https: a.security.http_redirects_to_https, headers: a.security.headers, cookies: a.security.cookies } : null,
    errors: a.errors,
  };
}

async function imageBlocks(collected) {
  if (collected.source !== 'file') return [];
  const blocks = [];
  for (const f of collected.files) {
    if (f.kind !== 'image' || f.too_large_for_model) continue;
    const data = (await fs.readFile(f.image_path)).toString('base64');
    blocks.push({ type: 'text', text: `الصورة التالية مصدرها: file:${f.file}` });
    blocks.push({ type: 'image', source: { type: 'base64', media_type: f.media_type, data } });
  }
  return blocks;
}

async function callModel(input, collected, analyticsChecks, priorFindings) {
  const client = new Anthropic();
  const content = [...(await imageBlocks(collected)), ...buildUserContent(input, collected, analyticsChecks, priorFindings)];
  const stream = client.messages.stream({
    model: config.model,
    max_tokens: 32000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    system: systemPrompt(input.lang),
    messages: [{ role: 'user', content }],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') throw new Error(t(input.lang, 'err.refusal'));
  if (message.stop_reason === 'max_tokens') throw new Error(t(input.lang, 'err.max_tokens'));
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

// ---------- التحقق من مخرجات النموذج ----------

function norm(s) {
  return String(s || '').replace(/[\s\p{P}]+/gu, ' ').trim().toLowerCase();
}

// فئات قديمة (نتائج سابقة وبيانات التجربة) تُحوَّل إلى فئات المعايير الجديدة
const LEGACY = { UX: 'usability', CX: 'usability', navigation: 'usability', friction: 'usability', feature_completeness: 'usability', analytics: 'usability', accessibility: 'accessibility' };

export function validateFindings(raw, collected, input) {
  const sources = new Set(allowedSources(collected));
  const maxStep = input.steps.length;
  const kept = [];
  const rejected = [];
  const seen = new Set();
  for (const f0 of raw || []) {
    const f = { ...f0, category: CATEGORIES.includes(f0.category) ? f0.category : LEGACY[f0.category || f0.criterion] };
    const problems = [];
    if (!f.category) problems.push(t(input.lang, 'rej.criterion'));
    if (!SEVERITIES.includes(f.severity)) problems.push(t(input.lang, 'rej.severity'));
    if (!CONFIDENCES.includes(f.confidence)) problems.push(t(input.lang, 'rej.confidence'));
    if (!Number.isInteger(f.step) || f.step < 0 || f.step > maxStep) problems.push(t(input.lang, 'rej.step'));
    if (!sources.has(f.evidence_source)) problems.push(t(input.lang, 'rej.source'));
    if (!String(f.evidence || '').trim()) problems.push(t(input.lang, 'rej.evidence'));
    if (!String(f.standard || '').trim()) problems.push(t(input.lang, 'rej.standard'));
    if (problems.length) {
      rejected.push(t(input.lang, 'ins.rejected', { problems: problems.join(t(input.lang, 'list.sep')), text: String(f.impact || f.evidence || '').slice(0, 200) }));
      continue;
    }
    const key = `${f.category}|${f.step}|${norm(f.evidence).slice(0, 120)}`;
    const key2 = `${f.category}|${f.step}|${norm(f.impact).slice(0, 120)}`;
    if (seen.has(key) || seen.has(key2)) continue;
    seen.add(key);
    seen.add(key2);
    kept.push({
      journey: input.journey,
      category: f.category,
      criterion: f.category,
      title: String(f.title || '').trim(),
      standard: String(f.standard).trim(),
      severity: f.severity,
      step: f.step,
      evidence: String(f.evidence).trim(),
      evidence_source: f.evidence_source,
      where: String(f.where || '').trim(),
      impact: String(f.impact || '').trim(),
      recommendation: String(f.recommendation || '').trim(),
      code: String(f.code || ''),
      effort: EFFORTS.includes(f.effort) ? f.effort : 'medium',
      recommendation_status: 'pending_human_review',
      confidence: f.confidence,
    });
  }
  return { findings: kept, rejected };
}

// الدرجات: الأداء من مقاييس Core Web Vitals، وباقي الفئات 100 ناقص خصم الملاحظات عالية الثقة؛
// الفئة التي لم يتوفر لها دليل "غير مُقيّمة" ولا تدخل في الدرجة الكلية
export function computeScores(findings, assessed, metrics, lang = 'ar') {
  const categories = {};
  for (const c of CATEGORIES) {
    const list = findings.filter((f) => f.category === c);
    const isAssessed = assessed.has(c) || list.length > 0;
    let score = null;
    if (isAssessed) score = c === 'performance' && metrics ? performanceScore(metrics) ?? categoryScore(list) : categoryScore(list);
    categories[c] = { score, assessed: isAssessed, findings: list.length, standard: CATEGORY_STANDARDS[c] };
  }
  const scored = Object.values(categories).filter((x) => x.score != null);
  const overall = scored.length ? Math.round(scored.reduce((s, x) => s + x.score, 0) / scored.length) : null;
  return {
    overall,
    categories,
    counted_findings: findings.filter((f) => f.confidence === 'high').length,
    method: t(lang, 'score.method'),
  };
}

function uniq(arr) {
  return [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))];
}

// ---------- التجميع النهائي ----------

export async function analyze(input, collected, { recordedAnalysis = null, onProgress = () => {} } = {}) {
  const analyticsChecks = checkAnalytics(input.expected_events, collected);
  const det = deterministicAnalytics(analyticsChecks, collected, input.lang);
  const warnings = collectWarnings(collected, input.lang);

  // القواعد الآلية تعمل دائمًا (ما عدا بيانات التجربة المسجلة) ولا تحتاج نموذجًا
  const rules = recordedAnalysis ? { findings: [], insufficient: [], assessed: new Set(['usability']) } : ruleFindings(input, collected, { modelUsed: modelConfigured() });
  const L = input.lang;
  const RULES_NOTICE = t(L, 'notice.rules');

  let mode = 'rules';
  let notice = RULES_NOTICE;
  let modelOut = null;

  if (recordedAnalysis) {
    mode = 'recorded_demo';
    modelOut = recordedAnalysis;
    notice = t(L, 'notice.demo');
  } else if (modelConfigured()) {
    onProgress(t(L, 'progress.model'));
    try {
      modelOut = await callModel(input, collected, analyticsChecks, rules.findings);
      mode = 'model';
      notice = null;
    } catch (e) {
      notice = t(L, 'notice.model_failed', { msg: String(e.message || e).split('\n')[0] }) + RULES_NOTICE;
    }
  }

  let completed;
  let stoppedAt;
  const insufficient = [...det.insufficient, ...rules.insufficient];
  let findings = [...rules.findings];
  let score = null;
  let scoring = null;
  let missing = det.missing;
  let successBasis = null;

  const hasCondition = Boolean(input.success_condition);
  const auto = Boolean(collected.auto_explored);
  const noConditionNote = auto
    ? t(L, 'ins.no_condition_auto')
    : t(L, 'ins.no_condition');
  const validStep = (s) => Number.isInteger(s) && s >= 0 && s <= input.steps.length;

  if (collected.source === 'url') {
    // توقف فعلي (فشل فتح الموقع أو فشل خطوة مكتوبة) يعني أن الرحلة لم تكتمل
    completed = collected.all_steps_executed ? (hasCondition && !auto ? true : null) : false;
    stoppedAt = collected.stopped_at_step;
  } else {
    completed = null;
    stoppedAt = null;
  }

  if (modelOut) {
    const { findings: kept, rejected } = validateFindings(modelOut.findings, collected, input);
    findings = [...findings, ...kept.map((f) => ({ ...f, origin: mode === 'recorded_demo' ? 'recorded' : 'model' }))];
    insufficient.push(...(modelOut.insufficient_evidence || []), ...rejected);
    successBasis = hasCondition ? modelOut.success_condition_basis || null : null;

    if (collected.source === 'url') {
      if (completed !== false) {
        if (!hasCondition) {
          completed = null;
          insufficient.push(noConditionNote);
        } else if (modelOut.success_condition_met === 'yes') {
          completed = true;
        } else if (modelOut.success_condition_met === 'no') {
          completed = false;
          stoppedAt = validStep(modelOut.stopped_at_step) ? modelOut.stopped_at_step : auto ? null : input.steps.length;
        } else if (auto) {
          completed = null;
          insufficient.push(t(L, 'ins.auto_unknown'));
        } else {
          insufficient.push(t(L, 'ins.steps_unknown'));
        }
      }
    } else if (modelOut.journey_state === 'completed' && modelOut.success_condition_met !== 'no') {
      completed = true;
    } else if (modelOut.journey_state === 'stopped' || modelOut.success_condition_met === 'no') {
      completed = false;
      stoppedAt = validStep(modelOut.stopped_at_step) ? modelOut.stopped_at_step : null;
    } else {
      insufficient.push(t(L, 'ins.files_unknown'));
    }

    // النموذج يحسّن وصف الأحداث الناقصة، لكن لا يضيف حدثًا ظهر في الدليل ولا حدثًا غير متوقع
    const byName = new Map((modelOut.missing_analytics_events || []).map((e) => [e.event_name, e]));
    missing = det.missing.map((m) => {
      const e = byName.get(m.event_name);
      return e ? { event_name: m.event_name, when: e.when || m.when, why: e.why || m.why } : m;
    });

  } else {
    if (collected.source === 'url' && collected.all_steps_executed) {
      if (!hasCondition) insufficient.push(noConditionNote);
      else if (auto) insufficient.push(t(L, 'ins.auto_condition_model'));
      else insufficient.push(t(L, 'ins.steps_condition_model'));
    }
    if (collected.source === 'file') insufficient.push(t(L, 'ins.files_model'));
    for (const f of collected.files || [])
      if (f.kind === 'image') insufficient.push(t(L, 'ins.image_model', { file: f.file }));
  }

  findings.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.step - b.step);
  const perf = collected.audit && collected.audit.performance;
  scoring = computeScores(findings, rules.assessed, perf ? perf.metrics : null, L);
  score = scoring.overall;
  // أهم 10 إصلاحات (الأثر مقابل الجهد)، والإصلاحات السريعة (أقل من يوم)
  const ranked = findings.map((f, i) => ({ i, v: priorityValue(f), f })).sort((a, b) => b.v - a.v || SEVERITY_RANK[b.f.severity] - SEVERITY_RANK[a.f.severity]);
  const priorities = ranked.slice(0, 10).map((x) => x.i);
  const quickWins = ranked.filter((x) => x.f.effort === 'low' && x.f.severity !== 'low').slice(0, 10).map((x) => x.i);
  const metrics = perf ? summarizeMetrics(perf) : null;

  const result = {
    product_name: input.product_name,
    journey: input.journey,
    source: collected.source,
    completed,
    stopped_at_step: completed ? null : stoppedAt,
    overall_score_out_of_100: score,
    score_out_of_5: score == null ? null : Math.round((score / 20) * 10) / 10,
    category_scores: scoring.categories,
    findings,
    priorities,
    quick_wins: quickWins,
    metrics,
    checklist: CHECKLIST[L === 'en' ? 'en' : 'ar'],
    missing_analytics_events: missing,
    insufficient_evidence: uniq(insufficient),
    meta: {
      created_at: new Date().toISOString(),
      lang: L,
      analysis_mode: mode,
      model: mode === 'model' ? config.model : null,
      notice,
      auto_explored: Boolean(collected.auto_explored),
      success_condition: input.success_condition,
      success_condition_basis: successBasis,
      scoring,
      steps: input.steps,
      expected_features: input.expected_features,
      expected_events: input.expected_events,
      analytics_checks: analyticsChecks,
      warnings,
    },
    collected_evidence: publicEvidence(collected),
  };
  result.meta.executive_summary = executiveSummary(result, L);
  return result;
}

function summarizeMetrics(perf) {
  const m = perf.metrics;
  const res = perf.resources;
  const sum = (pred) => Math.round(res.filter(pred).reduce((s, r) => s + (r.bytes || 0), 0) / 1024);
  const out = { conditions: perf.conditions, url: perf.url };
  for (const k of ['lcp', 'cls', 'tbt', 'fcp', 'ttfb']) out[k] = { value: m[k], rating: rateMetric(k, m[k]) };
  out.inp = { value: null, rating: null, note: 'field-only' };
  out.total_kb = sum(() => true);
  out.js_kb = sum((r) => r.type === 'Script');
  out.css_kb = sum((r) => r.type === 'Stylesheet');
  out.img_kb = sum((r) => r.type === 'Image');
  out.font_kb = sum((r) => r.type === 'Font');
  out.requests = res.length;
  out.render_blocking = (m.render_blocking || []).length;
  out.lcp_element = m.lcp_element;
  return out;
}

function collectWarnings(collected, lang) {
  const w = [];
  if (collected.source === 'file') {
    for (const f of collected.files) {
      if (f.content && f.content.truncated)
        w.push(t(lang, 'warn.truncated', { file: f.file, sent: f.content.text.length, total: f.content.total_chars }));
      if (f.har && f.har.truncated) w.push(t(lang, 'warn.har_truncated', { file: f.file, total: f.har.total_entries }));
      if (f.too_large_for_model) w.push(t(lang, 'warn.image_large', { file: f.file }));
      if (f.kind === 'unreadable') w.push(f.error + ` (${f.file})`);
    }
  }
  return w;
}

// نسخة من الدليل للعرض (بدون مسارات داخلية على القرص)
function publicEvidence(collected) {
  if (collected.source === 'url') return collected;
  return { ...collected, files: collected.files.map(({ image_path, ...rest }) => rest) };
}
