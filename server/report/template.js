// قالب تقرير PDF: يحوّل JSON النتائج إلى HTML مخصص للطباعة بلغة التحليل.
// لا يستخدم أي ملف من واجهة التطبيق؛ أنماطه في report.css فقط.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { counts, byCriterion, topRecommendations, executiveSummary } from '../summary.js';

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
    kicker: 'تقرير مراجعة جودة المنتج الرقمي وتجربة العميل',
    journey: 'الرحلة',
    date: 'تاريخ الإصدار',
    score: 'الدرجة',
    of5: 'من 5',
    notScored: 'غير محسوبة',
    status: 'حالة الرحلة',
    source: 'مصدر الدليل',
    srcUrl: 'رابط الموقع (أتمتة متصفح)',
    srcAuto: 'رابط الموقع (استكشاف تلقائي بمتصفح آلي)',
    srcFile: 'ملفات دليل مرفقة',
    completed: 'اكتملت الرحلة',
    stepsRan: 'نُفذت كل الخطوات — تحقق شرط النجاح يحتاج حكم النموذج',
    notCompleted: 'لم تكتمل',
    stoppedAt: (n) => `لم تكتمل — توقفت عند الخطوة ${n}`,
    undetermined: 'غير محدد — الدليل لا يكفي للحكم',
    summary: 'الملخص التنفيذي',
    condition: 'شرط النجاح',
    notSet: 'غير محدد',
    bySeverity: 'الملاحظات حسب الشدة',
    byCriterion: 'الملاحظات حسب المعيار',
    total: 'الإجمالي',
    missingEvents: 'أحداث تحليلات ناقصة',
    insufficient: 'بنود دليل غير كافٍ',
    topRecs: 'أهم 3 توصيات',
    recsNote: 'التوصيات مقترحات تخضع للمراجعة البشرية قبل اعتمادها.',
    noRecs: 'لا توجد توصيات؛ لم تُسجل ملاحظات مبنية على دليل.',
    findings: 'جدول النتائج',
    cols: ['#', 'المعيار', 'الشدة', 'الخطوة', 'الدليل', 'الأثر', 'التوصية', 'الثقة'],
    sourceLbl: 'المصدر',
    ruleTag: 'قاعدة آلية',
    modelTag: 'النموذج',
    journeyAll: 'الرحلة لكل الملاحظات',
    noFindings: 'لا توجد ملاحظات مسجلة.',
    plan: 'خطة العمل المقترحة',
    now: 'الآن',
    nowSub: 'ملاحظات عالية الشدة',
    next: 'السبرنت القادم',
    nextSub: 'ملاحظات متوسطة الشدة',
    later: 'لاحقًا',
    laterSub: 'ملاحظات منخفضة الشدة',
    stepN: (n) => `الخطوة ${n}`,
    eventsTitle: 'أحداث التحليلات الناقصة',
    eventsCols: ['اسم الحدث', 'متى يجب أن يُطلق', 'سبب اعتباره ناقصًا'],
    noEvents: 'لا توجد أحداث ناقصة مؤكدة من الدليل.',
    insTitle: 'الدليل غير الكافي',
    none: 'لا توجد بنود.',
    method: 'منهجية التقييم',
    methodText: (r) =>
      r.source === 'url'
        ? 'فتحت الأداة الموقع بمتصفح آلي (Playwright) وجمعت من كل خطوة النص الظاهر والأزرار ورسائل الخطأ وطلبات الشبكة وأخطاء الكونسول. '
        : 'قرأت الأداة ملفات الدليل المرفقة فقط (صفحات HTML، طلبات الشبكة HAR، السجلات، البيانات). ',
    methodRules: 'طُبقت قواعد ثابتة على الدليل المجموع، وكل ملاحظة مرتبطة بمصدر محدد فيه.',
    methodModel: 'طُبقت قواعد ثابتة على الدليل، ثم راجعه نموذج ذكاء اصطناعي بقواعد تمنع أي ملاحظة بلا مصدر في الدليل.',
    methodDemo: 'هذه بيانات تجربة: الحكم من تحليل مسجل مسبقًا لملفات التجربة.',
    scoring: 'حساب الدرجة',
    general: 'الصفحة الأولى / عام',
    sev: { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' },
    conf: { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' },
    crit: { UX: 'تجربة الاستخدام', CX: 'تجربة العميل', navigation: 'التنقل', accessibility: 'إمكانية الوصول', feature_completeness: 'اكتمال الميزات', friction: 'الاحتكاك', analytics: 'التحليلات' },
    header: 'تقرير الجودة',
    page: 'صفحة',
    of: 'من',
  },
  en: {
    kicker: 'Digital product quality & customer experience review',
    journey: 'Journey',
    date: 'Issued',
    score: 'Score',
    of5: 'of 5',
    notScored: 'Not scored',
    status: 'Journey status',
    source: 'Evidence source',
    srcUrl: 'Site URL (browser automation)',
    srcAuto: 'Site URL (automatic exploration)',
    srcFile: 'Attached evidence files',
    completed: 'Journey completed',
    stepsRan: 'All steps ran — the success condition needs the AI model',
    notCompleted: 'Not completed',
    stoppedAt: (n) => `Not completed — stopped at step ${n}`,
    undetermined: 'Undetermined — not enough evidence',
    summary: 'Executive summary',
    condition: 'Success condition',
    notSet: 'Not set',
    bySeverity: 'Findings by severity',
    byCriterion: 'Findings by criterion',
    total: 'Total',
    missingEvents: 'Missing analytics events',
    insufficient: 'Insufficient-evidence items',
    topRecs: 'Top 3 recommendations',
    recsNote: 'Recommendations are proposals for human review before adoption.',
    noRecs: 'No recommendations; no evidence-based findings were recorded.',
    findings: 'Findings',
    cols: ['#', 'Criterion', 'Severity', 'Step', 'Evidence', 'Impact', 'Recommendation', 'Confidence'],
    sourceLbl: 'Source',
    ruleTag: 'rule',
    modelTag: 'AI model',
    journeyAll: 'Journey for all findings',
    noFindings: 'No findings recorded.',
    plan: 'Suggested action plan',
    now: 'Now',
    nowSub: 'High-severity findings',
    next: 'Next sprint',
    nextSub: 'Medium-severity findings',
    later: 'Later',
    laterSub: 'Low-severity findings',
    stepN: (n) => `Step ${n}`,
    eventsTitle: 'Missing analytics events',
    eventsCols: ['Event name', 'When it should fire', 'Why it is considered missing'],
    noEvents: 'No confirmed missing events in the evidence.',
    insTitle: 'Insufficient evidence',
    none: 'None.',
    method: 'Methodology',
    methodText: (r) =>
      r.source === 'url'
        ? 'The tool opened the site in an automated browser (Playwright) and collected, for each step, the visible text, buttons, error messages, network requests and console errors. '
        : 'The tool read only the attached evidence files (HTML pages, HAR network logs, logs, data). ',
    methodRules: 'Fixed rules were applied to the collected evidence; every finding links to a specific source in it.',
    methodModel: 'Fixed rules were applied to the evidence, then an AI model reviewed it under rules that reject any finding without a source in the evidence.',
    methodDemo: 'This is demo data: the verdict comes from a pre-recorded analysis of the demo files.',
    scoring: 'Scoring',
    general: 'First page / general',
    sev: { high: 'High', medium: 'Medium', low: 'Low' },
    conf: { high: 'High', medium: 'Medium', low: 'Low' },
    crit: { UX: 'UX', CX: 'CX', navigation: 'Navigation', accessibility: 'Accessibility', feature_completeness: 'Feature completeness', friction: 'Friction', analytics: 'Analytics' },
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
  const pct = score == null ? 0 : Math.max(0, Math.min(1, score / 5));
  const color = score == null ? '#d9d2c7' : score >= 4 ? '#2f7a55' : score >= 2.5 ? '#c07a2c' : '#b3413a';
  return `<svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="#ece5da" stroke-width="9"/>
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"
      stroke-dasharray="${(c * pct).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)"/>
    <text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-size="24" font-weight="700" fill="#1d2b27">${score == null ? '—' : score}</text>
  </svg>`;
}

const LOGO = `<svg class="logo" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 6c9 0 16 6 16 15v13C15 34 8 28 8 19z" fill="#1f4d43"/><path d="M32 10c-6 1-10 6-10 12v12c6-1 10-6 10-12z" fill="#c9895f"/></svg>`;

export function renderReport(r) {
  const lang = r.meta.lang === 'en' ? 'en' : 'ar';
  const L = LABELS[lang];
  const bidi = lang === 'en' ? bidiEn : bidiAr;
  const dir = lang === 'en' ? 'ltr' : 'rtl';
  const date = formatDate(r.meta.created_at);
  const c = counts(r.findings);
  const crit = byCriterion(r.findings);
  const maxCrit = Math.max(1, ...Object.values(crit).map((x) => x.count));
  const scoreText = r.score_out_of_5 == null ? L.notScored : `${r.score_out_of_5} ${L.of5}`;
  const sourceText = r.source === 'url' ? (r.meta.auto_explored ? L.srcAuto : L.srcUrl) : L.srcFile;
  const top = topRecommendations(r.findings);
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

  const findingsRows = r.findings
    .map(
      (f, i) => `<tr class="row-${esc(f.severity)}">
      <td>${i + 1}</td>
      <td>${esc(L.crit[f.criterion] || f.criterion)}<div class="code-tag">${esc(f.criterion)}</div></td>
      <td><span class="sev sev-${esc(f.severity)}">${esc(L.sev[f.severity])}</span></td>
      <td>${f.step}<div class="small muted">${bidi(stepLabel(f.step))}</div></td>
      <td>${bidi(f.evidence)}<div class="small muted">${L.sourceLbl}: <span class="ltr">${esc(f.evidence_source)}</span>${f.origin === 'rule' ? ` · ${L.ruleTag}` : f.origin === 'model' ? ` · ${L.modelTag}` : ''}</div></td>
      <td>${bidi(f.impact)}</td>
      <td>${bidi(f.recommendation)}</td>
      <td class="nowrap">${esc(L.conf[f.confidence])}</td>
    </tr>`,
    )
    .join('');

  const planGroup = (sev, title, sub, cls) => {
    const seen = new Set();
    const items = r.findings.filter((f) => f.severity === sev && f.recommendation && !seen.has(f.recommendation) && seen.add(f.recommendation));
    if (!items.length) return '';
    return `<div class="plan-group">
      <div class="plan-head"><span class="plan-dot ${cls}"></span><strong>${title}</strong> <span class="muted small">${sub}</span></div>
      <ul>${items.map((f) => `<li>${bidi(f.recommendation)} <span class="muted small">(${L.stepN(f.step)})</span></li>`).join('')}</ul>
    </div>`;
  };
  const plan = planGroup('high', L.now, L.nowSub, 'p1') + planGroup('medium', L.next, L.nextSub, 'p2') + planGroup('low', L.later, L.laterSub, 'p3');

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
  <div class="journey">${L.journey}: ${bidi(r.journey)}</div>
  <div class="cover-score">
    ${ring(r.score_out_of_5)}
    <div><div class="big">${esc(scoreText)}</div><div class="muted">${L.score}</div></div>
  </div>
  <table class="meta">
    <tr><th>${L.date}</th><td><span class="ltr">${date}</span></td></tr>
    <tr><th>${L.status}</th><td>${esc(completion)}</td></tr>
    <tr><th>${L.source}</th><td>${sourceText}</td></tr>
  </table>
  ${r.meta.notice ? `<p class="note">${bidi(r.meta.notice)}</p>` : ''}
</div>

<section>
  <h2>${L.summary}</h2>
  <p class="lead">${bidi(summaryText)}</p>
  <div class="two-col">
    <div class="box">
      <h3>${L.bySeverity}</h3>
      <div class="sev-row">
        ${ring(r.score_out_of_5)}
        <table class="bars">
          ${['high', 'medium', 'low']
            .map(
              (s) => `<tr><td class="sev sev-${s}">${L.sev[s]}</td><td class="bar-cell"><div class="bar"><span class="fill-${s}" style="width:${r.findings.length ? (c[s] / r.findings.length) * 100 : 0}%"></span></div></td><td class="num">${c[s]}</td></tr>`,
            )
            .join('')}
          <tr><td class="muted">${L.total}</td><td></td><td class="num">${r.findings.length}</td></tr>
        </table>
      </div>
    </div>
    <div class="box">
      <h3>${L.byCriterion}</h3>
      ${
        Object.keys(crit).length
          ? `<table class="bars">${Object.entries(crit)
              .sort((a, b) => b[1].count - a[1].count)
              .map(
                ([k, v]) => `<tr><td>${esc(L.crit[k] || k)}</td><td class="bar-cell"><div class="bar"><span class="fill-${v.worst}" style="width:${(v.count / maxCrit) * 100}%"></span></div></td><td class="num">${v.count}</td></tr>`,
              )
              .join('')}</table>`
          : `<p class="muted">${L.noFindings}</p>`
      }
    </div>
  </div>
  <table class="kv">
    <tr><th>${L.status}</th><td>${esc(completion)}</td></tr>
    <tr><th>${L.condition}</th><td>${r.meta.success_condition ? bidi(r.meta.success_condition) : L.notSet}${r.meta.success_condition_basis ? `<div class="small muted">${bidi(r.meta.success_condition_basis)}</div>` : ''}</td></tr>
    <tr><th>${L.missingEvents}</th><td>${r.missing_analytics_events.length}</td></tr>
    <tr><th>${L.insufficient}</th><td>${r.insufficient_evidence.length}</td></tr>
  </table>

  <h3>${L.topRecs}</h3>
  ${
    top.length
      ? `<ol class="recs">${top
          .map((f) => `<li>${bidi(f.recommendation)} <span class="small muted">(${L.stepN(f.step)} — <span class="sev sev-${f.severity}">${L.sev[f.severity]}</span>)</span></li>`)
          .join('')}</ol>
         <p class="review-note">${L.recsNote}</p>`
      : `<p class="muted">${L.noRecs}</p>`
  }
</section>

<section class="new-page">
  <h2>${L.findings}</h2>
  ${
    r.findings.length
      ? `<table class="data findings">
    <colgroup>
      <col style="width:5mm"><col style="width:21mm"><col style="width:14mm"><col style="width:18mm">
      <col><col style="width:28mm"><col style="width:32mm"><col style="width:14mm">
    </colgroup>
    <thead><tr>${L.cols.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${findingsRows}</tbody>
  </table>
  <p class="review-note">${L.journeyAll}: ${bidi(r.journey)}. ${L.recsNote}</p>`
      : `<p class="muted">${L.noFindings}</p>`
  }
</section>

${plan ? `<section class="keep"><h2>${L.plan}</h2><div class="plan">${plan}</div><p class="review-note">${L.recsNote}</p></section>` : ''}

<section>
  <h2>${L.eventsTitle}</h2>
  ${
    r.missing_analytics_events.length
      ? `<table class="data">
    <colgroup><col style="width:40mm"><col style="width:55mm"><col></colgroup>
    <thead><tr>${L.eventsCols.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${r.missing_analytics_events.map((e) => `<tr><td class="ltr code">${esc(e.event_name)}</td><td>${bidi(e.when)}</td><td>${bidi(e.why)}</td></tr>`).join('')}</tbody>
  </table>`
      : `<p class="muted">${L.noEvents}</p>`
  }
</section>

<section>
  <h2>${L.insTitle}</h2>
  ${r.insufficient_evidence.length ? `<ul class="plain">${r.insufficient_evidence.map((s) => `<li>${bidi(s)}</li>`).join('')}</ul>` : `<p class="muted">${L.none}</p>`}
</section>

<section class="keep">
  <h2>${L.method}</h2>
  <div class="method-box">
    <p>${L.methodText(r)}${r.meta.analysis_mode === 'model' ? L.methodModel : r.meta.analysis_mode === 'recorded_demo' ? L.methodDemo : L.methodRules}</p>
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
