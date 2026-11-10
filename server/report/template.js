// قالب تقرير PDF: يحوّل JSON النتائج إلى HTML مخصص للطباعة بلغة التحليل.
// لا يستخدم أي ملف من واجهة التطبيق؛ أنماطه في report.css فقط.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { counts, executiveSummary } from '../summary.js';
import { CATEGORIES, CATEGORY_LABELS } from '../standards.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const CSS = fs.readFileSync(path.join(here, 'report.css'), 'utf8');

function fontFace(subset, weight, range) {
  try {
    const file = require.resolve(`@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-${subset}-${weight}-normal.woff2`);
    const b64 = fs.readFileSync(file).toString('base64');
    return `@font-face{font-family:'Report Sans';font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${range};}`;
  } catch {
    return '';
  }
}
const AR_RANGE = 'U+0600-06FF,U+0750-077F,U+0870-08FF,U+FB50-FDFF,U+FE70-FEFF,U+200C-200F';
const LATIN_RANGE = 'U+0000-00FF,U+2000-206F,U+20AC,U+2122,U+2190-21FF';
export const FONT_CSS = [400, 600, 700].map((w) => fontFace('arabic', w, AR_RANGE) + fontFace('latin', w, LATIN_RANGE)).join('');

const LABELS = {
  ar: {
    kicker: 'تدقيق جودة الموقع وتجربة العميل وفق المعايير',
    standards: 'WCAG 2.2 AA · استدلالات نيلسن و ISO 9241-11 · Core Web Vitals · تصوير البيانات · التصميم المتجاوب · OWASP · SEO',
    journey: 'الرحلة',
    date: 'تاريخ الإصدار',
    overall: 'الدرجة الكلية',
    of100: 'من 100',
    notScored: 'غير محسوبة',
    status: 'حالة الرحلة',
    url: 'الرابط',
    completed: 'اكتملت الرحلة',
    stepsRan: 'نُفذت كل الخطوات — تحقق شرط النجاح يحتاج حكم النموذج',
    notCompleted: 'لم تكتمل',
    stoppedAt: (n) => `لم تكتمل — توقفت عند الخطوة ${n}`,
    undetermined: 'غير محدد — الدليل لا يكفي للحكم',
    summary: '1. الملخص التنفيذي',
    catScores: 'الدرجة حسب الفئة',
    catCols: ['الفئة', 'المعيار المرجعي', 'الدرجة', 'الملاحظات'],
    notAssessed: 'غير مُقيّمة',
    sevCounts: 'الملاحظات حسب الشدة',
    cwv: 'مقاييس الأداء',
    cwvCols: ['المقياس', 'القيمة', 'الحد', 'التقييم'],
    inpNote: 'يحتاج بيانات مستخدمين حقيقيين (CrUX)',
    tbtNote: 'مؤشر مختبري لـ INP',
    weight: 'حجم الصفحة',
    requests: 'الطلبات',
    conditions: 'ظروف القياس',
    rating: { good: 'جيد', needs_improvement: 'يحتاج تحسين', poor: 'ضعيف' },
    findings: '2. النتائج حسب الفئة',
    cols: ['المشكلة', 'المعيار المخالَف', 'المكان', 'الشدة', 'الإصلاح المقترح'],
    evidence: 'الدليل',
    effort: 'الجهد',
    sourceLbl: 'المصدر',
    noCatFindings: 'لا توجد ملاحظات في هذه الفئة.',
    catNotAssessed: 'لم تُقيّم لعدم توفر دليل؛ طريقة اختبارها في قسم الدليل غير الكافي.',
    top10: '3. أهم 10 إصلاحات حسب الأثر مقابل الجهد',
    topCols: ['#', 'المشكلة', 'الفئة', 'الشدة', 'الجهد', 'المعيار'],
    quick: '4. إصلاحات سريعة (أقل من يوم)',
    none: 'لا توجد بنود.',
    eventsTitle: 'أحداث التحليلات الناقصة',
    eventsCols: ['اسم الحدث', 'متى يجب أن يُطلق', 'سبب اعتباره ناقصًا'],
    checklist: '5. قائمة اختبار قابلة لإعادة الاستخدام',
    clCols: ['الفئة', 'البند', 'الأداة'],
    unverified: 'لم يُتحقق منه في هذا التحليل — طريقة اختباره',
    method: 'منهجية التقييم',
    methodText:
      'فتحت الأداة الموقع بمتصفح Chromium آلي وجمعت الدليل من كل صفحة: فحص axe-core لمعايير WCAG 2.2 AA، واختبار التنقل بلوحة المفاتيح، وتشغيل جوال مقيّد (4G بطيء ومعالج ×4) لقياس Core Web Vitals، وعروض 320 و390 و820 و1440 بكسل، وترويسات الأمان وملفات الارتباط وطلبات التتبع، وعناصر SEO، وإعدادات الرسوم البيانية. كل ملاحظة مرتبطة بمصدر محدد في الدليل وتذكر المعيار المخالف. ما لا يمكن التحقق منه آليًا مذكور مع طريقة اختباره.',
    methodModel: ' ثم راجع نموذج ذكاء اصطناعي الدليل بقواعد تمنع أي ملاحظة بلا مصدر أو معيار.',
    scoring: 'حساب الدرجات',
    recsNote: 'التوصيات مقترحات تخضع للمراجعة البشرية قبل اعتمادها.',
    general: 'الصفحة الأولى / عام',
    sev: { critical: 'حرجة', high: 'عالية', medium: 'متوسطة', low: 'منخفضة' },
    eff: { low: 'أقل من يوم', medium: 'أيام', high: 'أسبوع أو أكثر' },
    header: 'تقرير الجودة',
    page: 'صفحة',
    of: 'من',
  },
  en: {
    kicker: 'Standards-based web quality & customer experience audit',
    standards: 'WCAG 2.2 AA · Nielsen heuristics & ISO 9241-11 · Core Web Vitals · Data visualization · Responsive · OWASP · SEO',
    journey: 'Journey',
    date: 'Issued',
    overall: 'Overall score',
    of100: 'of 100',
    notScored: 'Not scored',
    status: 'Journey status',
    url: 'URL',
    completed: 'Journey completed',
    stepsRan: 'All steps ran — the success condition needs the AI model',
    notCompleted: 'Not completed',
    stoppedAt: (n) => `Not completed — stopped at step ${n}`,
    undetermined: 'Undetermined — not enough evidence',
    summary: '1. Executive summary',
    catScores: 'Score by category',
    catCols: ['Category', 'Reference standard', 'Score', 'Findings'],
    notAssessed: 'Not assessed',
    sevCounts: 'Findings by severity',
    cwv: 'Performance metrics',
    cwvCols: ['Metric', 'Value', 'Threshold', 'Rating'],
    inpNote: 'Needs real-user data (CrUX)',
    tbtNote: 'Lab proxy for INP',
    weight: 'Page weight',
    requests: 'Requests',
    conditions: 'Test conditions',
    rating: { good: 'Good', needs_improvement: 'Needs improvement', poor: 'Poor' },
    findings: '2. Findings by category',
    cols: ['Issue', 'Standard / criterion violated', 'Where it occurs', 'Severity', 'Recommended fix'],
    evidence: 'Evidence',
    effort: 'Effort',
    sourceLbl: 'Source',
    noCatFindings: 'No findings in this category.',
    catNotAssessed: 'Not assessed for lack of evidence; see the insufficient-evidence section for how to test it.',
    top10: '3. Top 10 priority fixes (impact vs effort)',
    topCols: ['#', 'Issue', 'Category', 'Severity', 'Effort', 'Standard'],
    quick: '4. Quick wins (under a day)',
    none: 'None.',
    eventsTitle: 'Missing analytics events',
    eventsCols: ['Event name', 'When it should fire', 'Why it is considered missing'],
    checklist: '5. Reusable testing checklist',
    clCols: ['Category', 'Check', 'Tool'],
    unverified: 'Not verified in this run — how to test it',
    method: 'Methodology',
    methodText:
      'The tool opened the site in an automated Chromium browser and collected evidence from each page: an axe-core scan for WCAG 2.2 AA, a keyboard navigation pass, a throttled mobile run (slow 4G, CPU ×4) for Core Web Vitals, 320/390/820/1440 px viewports, security headers, cookies and tracking requests, SEO elements and chart configuration. Every finding links to a specific source in the evidence and cites the violated standard. Anything that cannot be verified automatically is listed with how to test it.',
    methodModel: ' An AI model then reviewed the evidence under rules that reject any finding without a source or standard.',
    scoring: 'Scoring',
    recsNote: 'Recommendations are proposals for human review before adoption.',
    general: 'First page / general',
    sev: { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' },
    eff: { low: '< 1 day', medium: 'Days', high: '1 week +' },
    header: 'Quality report',
    page: 'Page',
    of: 'of',
  },
};

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// نص مختلط: عزل المقاطع اللاتينية داخل العربية لتحافظ على ترتيبها
const LATIN_RUN = /([A-Za-z0-9_/{"'][A-Za-z0-9_.,:;/\-=?&%#{}()"'\[\] ]*[A-Za-z0-9_}"'\]/]|[A-Za-z0-9_])/;
const bidiAr = (v) =>
  String(v ?? '')
    .split(LATIN_RUN)
    .map((part, i) => (i % 2 ? `<bdi>${esc(part)}</bdi>` : esc(part)))
    .join('');
// في التقرير الإنجليزي: عزل المقاطع العربية
const ARABIC_RUN = /([؀-ۿ][؀-ۿ\s«»،؛]*[؀-ۿ»]|[؀-ۿ])/;
const bidiEn = (v) =>
  String(v ?? '')
    .split(ARABIC_RUN)
    .map((part, i) => (i % 2 ? `<bdi dir="rtl">${esc(part)}</bdi>` : esc(part)))
    .join('');

export function formatDate(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

function ring(score) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(1, score / 100));
  const color = score == null ? '#d9d2c7' : score >= 90 ? '#2f7a55' : score >= 50 ? '#c07a2c' : '#b3413a';
  return `<svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="#ece5da" stroke-width="9"/>
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"
      stroke-dasharray="${(c * pct).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)"/>
    <text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-size="26" font-weight="700" fill="#1d2b27">${score == null ? '—' : score}</text>
  </svg>`;
}
const scoreTone = (s) => (s == null ? 'na' : s >= 90 ? 'good' : s >= 50 ? 'mid' : 'bad');

const LOGO = `<svg class="logo" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 6c9 0 16 6 16 15v13C15 34 8 28 8 19z" fill="#1f4d43"/><path d="M32 10c-6 1-10 6-10 12v12c6-1 10-6 10-12z" fill="#c9895f"/></svg>`;
const LEGACY = { UX: 'usability', CX: 'usability', navigation: 'usability', friction: 'usability', feature_completeness: 'usability', analytics: 'usability', accessibility: 'accessibility' };

export function renderReport(r) {
  const lang = r.meta.lang === 'en' ? 'en' : 'ar';
  const L = LABELS[lang];
  const CL = CATEGORY_LABELS[lang];
  const bidi = lang === 'en' ? bidiEn : bidiAr;
  const dir = lang === 'en' ? 'ltr' : 'rtl';
  const date = formatDate(r.meta.created_at);
  const c = counts(r.findings);
  const catOf = (f) => (CATEGORIES.includes(f.category) ? f.category : LEGACY[f.category || f.criterion] || 'usability');
  const overall = r.overall_score_out_of_100 != null ? r.overall_score_out_of_100 : r.score_out_of_5 != null ? Math.round(r.score_out_of_5 * 20) : null;
  const cs = r.category_scores || {};
  const url = (r.collected_evidence && r.collected_evidence.target_url) || '';
  const stepLabel = (n) => (n === 0 ? L.general : ((r.meta.steps || []).find((x) => x.number === n) || {}).text || '');
  const completion =
    r.completed === true && ['evidence_only', 'rules'].includes(r.meta.analysis_mode)
      ? L.stepsRan
      : r.completed === true
        ? L.completed
        : r.completed === false
          ? r.stopped_at_step != null
            ? L.stoppedAt(r.stopped_at_step)
            : L.notCompleted
          : L.undetermined;
  const summaryText = r.meta.executive_summary || executiveSummary(r, lang);
  const sevBadge = (s) => `<span class="sev sev-${esc(s)}">${esc(L.sev[s] || s)}</span>`;

  const catRows = CATEGORIES.map((k) => {
    const x = cs[k] || {};
    const n = r.findings.filter((f) => catOf(f) === k).length;
    return `<tr><td><strong>${esc(CL[k])}</strong></td><td class="std">${esc(x.standard || '')}</td>
      <td><span dir="ltr" class="score score-${scoreTone(x.score)}">${x.score == null ? L.notAssessed : `${x.score} / 100`}</span></td><td>${n}</td></tr>`;
  }).join('');

  const m = r.metrics;
  const sec = (v) => (v == null ? '—' : `${(v / 1000).toFixed(2)} s`);
  const ms = (v) => (v == null ? '—' : `${v} ms`);
  const mRow = (name, val, th, rating, note = '') =>
    `<tr><td><strong>${name}</strong>${note ? `<div class="small muted">${esc(note)}</div>` : ''}</td><td class="ltr">${val}</td><td class="ltr">${th}</td><td>${rating ? `<span class="rate rate-${rating}">${L.rating[rating]}</span>` : '—'}</td></tr>`;
  const metricsTable = m
    ? `<h3>${L.cwv}</h3>
  <table class="data">
    <colgroup><col style="width:46mm"><col style="width:30mm"><col style="width:30mm"><col></colgroup>
    <thead><tr>${L.cwvCols.map((x) => `<th>${x}</th>`).join('')}</tr></thead>
    <tbody>
      ${mRow('LCP', sec(m.lcp.value), '≤ 2.5 s', m.lcp.rating)}
      ${mRow('INP', '—', '≤ 200 ms', null, L.inpNote)}
      ${mRow('CLS', m.cls.value == null ? '—' : m.cls.value, '≤ 0.1', m.cls.rating)}
      ${mRow('TBT', ms(m.tbt.value), '≤ 200 ms', m.tbt.rating, L.tbtNote)}
      ${mRow('FCP', sec(m.fcp.value), '≤ 1.8 s', m.fcp.rating)}
      ${mRow('TTFB', ms(m.ttfb.value), '≤ 0.8 s', m.ttfb.rating)}
      ${mRow(L.weight, `${(m.total_kb / 1024).toFixed(2)} MB`, '≤ 1.6 MB', m.total_kb > 1600 ? 'poor' : 'good', `JS ${m.js_kb} KB · CSS ${m.css_kb} KB · IMG ${m.img_kb} KB`)}
      ${mRow(L.requests, m.requests, '—', null)}
    </tbody>
  </table>
  <p class="small muted">${L.conditions}: <span class="ltr">${esc(m.conditions)}</span></p>`
    : '';

  const issueRows = (list) =>
    list
      .map(
        (f) => `<tr class="row-${esc(f.severity)}">
      <td><strong>${bidi(f.title || f.impact || f.evidence)}</strong>
        <div class="small muted">${L.evidence}: ${bidi(f.evidence)}</div>
        ${f.impact && f.title ? `<div class="small">${bidi(f.impact)}</div>` : ''}
        <div class="small muted">${L.sourceLbl}: <span class="ltr">${esc(f.evidence_source)}</span></div></td>
      <td class="std">${esc(f.standard || '—')}</td>
      <td class="where">${f.where ? `<span class="ltr">${esc(f.where)}</span>` : bidi(stepLabel(f.step))}</td>
      <td>${sevBadge(f.severity)}<div class="small muted">${L.effort}: ${esc(L.eff[f.effort || 'medium'])}</div></td>
      <td>${bidi(f.recommendation)}${f.code ? `<pre class="code">${esc(f.code)}</pre>` : ''}</td>
    </tr>`,
      )
      .join('');

  const catSections = CATEGORIES.map((k) => {
    const x = cs[k] || {};
    const list = r.findings.filter((f) => catOf(f) === k);
    const head = `<h3 class="cat-head">${esc(CL[k])} <span dir="ltr" class="score score-${scoreTone(x.score)}">${x.score == null ? L.notAssessed : `${x.score} / 100`}</span></h3>
      ${x.standard ? `<p class="small muted std-line">${esc(x.standard)}</p>` : ''}`;
    if (!list.length) return `<div class="cat-block">${head}<p class="muted">${x.score == null ? L.catNotAssessed : L.noCatFindings}</p></div>`;
    return `<div class="cat-block">${head}
      <table class="data findings">
        <colgroup><col style="width:52mm"><col style="width:30mm"><col style="width:24mm"><col style="width:18mm"><col></colgroup>
        <thead><tr>${L.cols.map((x2) => `<th>${x2}</th>`).join('')}</tr></thead>
        <tbody>${issueRows(list)}</tbody>
      </table></div>`;
  }).join('');

  const top = (r.priorities || []).map((i) => r.findings[i]).filter(Boolean);
  const quick = (r.quick_wins || []).map((i) => r.findings[i]).filter(Boolean);
  const cl = r.checklist || {};

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<title>${esc(L.header)} — ${esc(r.product_name)}</title>
<style>${FONT_CSS}${CSS}</style>
</head>
<body class="${dir}">

<div class="cover">
  ${LOGO}
  <div class="kicker">${esc(L.kicker)}</div>
  <h1>${bidi(r.product_name)}</h1>
  ${url ? `<div class="journey ltr">${esc(url)}</div>` : `<div class="journey">${L.journey}: ${bidi(r.journey)}</div>`}
  <div class="cover-score">
    ${ring(overall)}
    <div><div class="big">${overall == null ? L.notScored : `${overall} / 100`}</div><div class="muted">${L.overall}</div></div>
  </div>
  <table class="cover-cats">
    ${CATEGORIES.map((k) => `<tr><td>${esc(CL[k])}</td><td class="num"><span dir="ltr" class="score score-${scoreTone((cs[k] || {}).score)}">${(cs[k] || {}).score == null ? L.notAssessed : cs[k].score}</span></td></tr>`).join('')}
  </table>
  <table class="meta">
    <tr><th>${L.date}</th><td><span class="ltr">${date}</span></td></tr>
    <tr><th>${L.status}</th><td>${esc(completion)}</td></tr>
  </table>
  <p class="small muted standards">${esc(L.standards)}</p>
</div>

<section>
  <h2>${L.summary}</h2>
  <p class="lead">${bidi(summaryText)}</p>
  <h3>${L.catScores}</h3>
  <table class="data">
    <colgroup><col style="width:38mm"><col><col style="width:26mm"><col style="width:20mm"></colgroup>
    <thead><tr>${L.catCols.map((x) => `<th>${x}</th>`).join('')}</tr></thead>
    <tbody>${catRows}</tbody>
  </table>
  <p class="sev-line">${L.sevCounts}: ${['critical', 'high', 'medium', 'low'].map((s) => `${sevBadge(s)} ${c[s]}`).join(' &nbsp;·&nbsp; ')}</p>
  ${metricsTable}
</section>

<section class="new-page">
  <h2>${L.findings}</h2>
  ${catSections}
  <p class="review-note">${L.recsNote}</p>
</section>

<section class="new-page">
  <h2>${L.top10}</h2>
  ${
    top.length
      ? `<table class="data">
    <colgroup><col style="width:7mm"><col><col style="width:28mm"><col style="width:17mm"><col style="width:18mm"><col style="width:44mm"></colgroup>
    <thead><tr>${L.topCols.map((x) => `<th>${x}</th>`).join('')}</tr></thead>
    <tbody>${top.map((f, i) => `<tr class="row-${esc(f.severity)}"><td>${i + 1}</td><td>${bidi(f.title || f.impact)}</td><td>${esc(CL[catOf(f)])}</td><td>${sevBadge(f.severity)}</td><td>${esc(L.eff[f.effort || 'medium'])}</td><td class="std">${esc(f.standard || '')}</td></tr>`).join('')}</tbody>
  </table>`
      : `<p class="muted">${L.none}</p>`
  }
</section>

<section>
  <h2>${L.quick}</h2>
  ${
    quick.length
      ? `<ol class="quick">${quick
          .map((f) => `<li><strong>${bidi(f.title || f.impact)}</strong> ${sevBadge(f.severity)} <span class="small muted">· ${esc(CL[catOf(f)])} · <span class="ltr">${esc(f.standard || '')}</span></span>
            <div>${bidi(f.recommendation)}</div>${f.code ? `<pre class="code">${esc(f.code)}</pre>` : ''}</li>`)
          .join('')}</ol>`
      : `<p class="muted">${L.none}</p>`
  }
</section>

${
  r.missing_analytics_events.length
    ? `<section><h2>${L.eventsTitle}</h2>
  <table class="data">
    <colgroup><col style="width:40mm"><col style="width:55mm"><col></colgroup>
    <thead><tr>${L.eventsCols.map((x) => `<th>${x}</th>`).join('')}</tr></thead>
    <tbody>${r.missing_analytics_events.map((e) => `<tr><td class="ltr code-cell">${esc(e.event_name)}</td><td>${bidi(e.when)}</td><td>${bidi(e.why)}</td></tr>`).join('')}</tbody>
  </table></section>`
    : ''
}

<section class="new-page">
  <h2>${L.checklist}</h2>
  <table class="data">
    <colgroup><col style="width:32mm"><col><col style="width:52mm"></colgroup>
    <thead><tr>${L.clCols.map((x) => `<th>${x}</th>`).join('')}</tr></thead>
    <tbody>${CATEGORIES.filter((k) => cl[k]).map((k) => cl[k].map(([item, tool], i) => `<tr><td>${i === 0 ? `<strong>${esc(CL[k])}</strong>` : ''}</td><td><span class="box"></span> ${bidi(item)}</td><td class="ltr small">${esc(tool)}</td></tr>`).join('')).join('')}</tbody>
  </table>
  ${r.insufficient_evidence.length ? `<h3>${L.unverified}</h3><ul class="plain">${r.insufficient_evidence.map((x) => `<li>${bidi(x)}</li>`).join('')}</ul>` : ''}
</section>

<section class="keep">
  <h2>${L.method}</h2>
  <div class="method-box">
    <p>${L.methodText}${r.meta.analysis_mode === 'model' ? L.methodModel : ''}</p>
    ${r.meta.scoring ? `<p><strong>${L.scoring}:</strong> ${esc(r.meta.scoring.method)}</p>` : ''}
  </div>
</section>

</body>
</html>`;
}

function hf(r, inner) {
  const dir = r.meta.lang === 'en' ? 'ltr' : 'rtl';
  return `<div style="width:100%;font-size:7.5pt;color:#7a766f;padding:0 16mm;direction:${dir};font-family:'Report Sans',sans-serif;display:flex;justify-content:space-between;">
    <style>${FONT_CSS}</style>${inner}</div>`;
}

export function headerTemplate(r) {
  const L = LABELS[r.meta.lang === 'en' ? 'en' : 'ar'];
  const bidi = r.meta.lang === 'en' ? bidiEn : bidiAr;
  return hf(r, `<span>${L.header} — ${bidi(r.product_name)}</span><span>${bidi(r.journey)}</span>`);
}

export function footerTemplate(r) {
  const L = LABELS[r.meta.lang === 'en' ? 'en' : 'ar'];
  return hf(r, `<span>${L.page} <span class="pageNumber"></span> ${L.of} <span class="totalPages"></span></span><span dir="ltr">${formatDate(r.meta.created_at)}</span>`);
}
