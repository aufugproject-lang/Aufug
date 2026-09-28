// قالب تقرير PDF: يحوّل JSON النتائج إلى HTML مخصص للطباعة.
// لا يستخدم أي ملف من واجهة التطبيق؛ أنماطه في report.css فقط.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const CSS = fs.readFileSync(path.join(here, 'report.css'), 'utf8');

function fontFace(weight) {
  try {
    const file = require.resolve(`@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-${weight}-normal.woff2`);
    const b64 = fs.readFileSync(file).toString('base64');
    return `@font-face{font-family:'Report Naskh';font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:U+0600-06FF,U+0750-077F,U+0870-08FF,U+FB50-FDFF,U+FE70-FEFF,U+200C-200F;}`;
  } catch {
    return '';
  }
}
export const FONT_CSS = fontFace(400) + fontFace(700);

export const CRITERION_LABELS = {
  UX: 'تجربة الاستخدام',
  CX: 'تجربة العميل',
  navigation: 'التنقل',
  accessibility: 'إمكانية الوصول',
  feature_completeness: 'اكتمال الميزات',
  friction: 'الاحتكاك',
  analytics: 'التحليلات',
};
export const SEVERITY_LABELS = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };
const CONFIDENCE_LABELS = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// نص عربي مع أسماء لاتينية: عزل الأجزاء اللاتينية لتحافظ على ترتيبها
const LATIN_RUN = /([A-Za-z0-9_/{"'][A-Za-z0-9_.,:;/\-=?&%#{}()"'\[\] ]*[A-Za-z0-9_}"'\]/]|[A-Za-z0-9_])/;
const bidi = (v) =>
  String(v ?? '')
    .split(LATIN_RUN)
    .map((part, i) => (i % 2 ? `<bdi>${esc(part)}</bdi>` : esc(part)))
    .join('');

export function formatDate(iso) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

function completionText(r) {
  if (r.completed === true && ['evidence_only', 'rules'].includes(r.meta.analysis_mode)) return 'نُفذت كل الخطوات — تحقق شرط النجاح يحتاج حكم النموذج';
  if (r.completed === true) return 'اكتملت الرحلة';
  if (r.completed === false) return r.stopped_at_step != null ? `لم تكتمل — توقفت عند الخطوة ${r.stopped_at_step}` : 'لم تكتمل';
  return 'غير محدد — الدليل لا يكفي للحكم';
}

function stepLabel(r, n) {
  if (n === 0) return 'الصفحة الأولى / عام';
  const s = (r.meta.steps || []).find((x) => x.number === n);
  return s ? s.text : '';
}

export function topRecommendations(findings, n = 3) {
  const order = { high: 0, medium: 1, low: 2 };
  const conf = { high: 0, medium: 1, low: 2 };
  const seen = new Set();
  return [...findings]
    .filter((f) => f.recommendation)
    .sort((a, b) => order[a.severity] - order[b.severity] || conf[a.confidence] - conf[b.confidence] || a.step - b.step)
    .filter((f) => (seen.has(f.recommendation) ? false : seen.add(f.recommendation)))
    .slice(0, n);
}

export function renderReport(r) {
  const date = formatDate(r.meta.created_at);
  const counts = { high: 0, medium: 0, low: 0 };
  for (const f of r.findings) counts[f.severity]++;
  const scoreText = r.score_out_of_5 == null ? 'غير محسوبة' : `${r.score_out_of_5} من 5`;
  const sourceText = r.source === 'url' ? (r.meta.auto_explored ? 'رابط الموقع (استكشاف تلقائي بمتصفح آلي)' : 'رابط الموقع (أتمتة متصفح)') : 'ملفات دليل مرفقة';
  const top = topRecommendations(r.findings);

  const findingsRows = r.findings
    .map(
      (f, i) => `<tr>
      <td>${i + 1}</td>
      <td>${esc(CRITERION_LABELS[f.criterion] || f.criterion)}<div class="code-tag">${esc(f.criterion)}</div></td>
      <td class="sev sev-${esc(f.severity)}">${esc(SEVERITY_LABELS[f.severity])}</td>
      <td>${f.step}<div class="small muted">${bidi(stepLabel(r, f.step))}</div></td>
      <td>${bidi(f.evidence)}<div class="small muted">المصدر: <span class="ltr">${esc(f.evidence_source)}</span>${f.origin === 'rule' ? ' · قاعدة آلية' : ''}</div></td>
      <td>${bidi(f.impact)}</td>
      <td>${bidi(f.recommendation)}</td>
      <td class="nowrap">${esc(CONFIDENCE_LABELS[f.confidence])}</td>
    </tr>`,
    )
    .join('');

  const eventsRows = r.missing_analytics_events
    .map(
      (e) => `<tr>
      <td class="ltr">${esc(e.event_name)}</td>
      <td>${bidi(e.when)}</td>
      <td>${bidi(e.why)}</td>
    </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>تقرير الجودة — ${esc(r.product_name)}</title>
<style>${FONT_CSS}${CSS}</style>
</head>
<body>

<div class="cover">
  <div class="kicker">تقرير مراجعة جودة المنتج الرقمي وتجربة العميل</div>
  <h1>${bidi(r.product_name)}</h1>
  <div class="journey">الرحلة: ${bidi(r.journey)}</div>
  <table class="meta">
    <tr><th>التاريخ</th><td class="ltr" style="text-align:right">${date}</td></tr>
    <tr><th>الدرجة</th><td class="score">${scoreText}</td></tr>
    <tr><th>حالة الرحلة</th><td>${esc(completionText(r))}</td></tr>
    <tr><th>مصدر الدليل</th><td>${sourceText}</td></tr>
  </table>
  ${r.meta.notice ? `<p class="note">${bidi(r.meta.notice)}</p>` : ''}
</div>

<section>
  <h2>الملخص التنفيذي</h2>
  <table class="kv">
    <tr><th>اكتمال الرحلة</th><td>${esc(completionText(r))}</td></tr>
    <tr><th>شرط النجاح</th><td>${r.meta.success_condition ? bidi(r.meta.success_condition) : 'غير محدد'}${r.meta.success_condition_basis ? `<div class="small muted">${bidi(r.meta.success_condition_basis)}</div>` : ''}</td></tr>
    <tr><th>الدرجة</th><td>${scoreText}${r.meta.scoring ? `<div class="small muted">محسوبة من ${r.meta.scoring.counted_findings} ملاحظة عالية الثقة. ${esc(r.meta.scoring.method)}</div>` : ''}</td></tr>
    <tr><th>الملاحظات حسب الشدة</th><td>
      <span class="sev sev-high">عالية: ${counts.high}</span> &nbsp;·&nbsp;
      <span class="sev sev-medium">متوسطة: ${counts.medium}</span> &nbsp;·&nbsp;
      <span class="sev sev-low">منخفضة: ${counts.low}</span>
      &nbsp;— الإجمالي ${r.findings.length}
    </td></tr>
    <tr><th>أحداث تحليلات ناقصة</th><td>${r.missing_analytics_events.length}</td></tr>
    <tr><th>بنود دليل غير كافٍ</th><td>${r.insufficient_evidence.length}</td></tr>
  </table>

  <h3>أهم 3 توصيات</h3>
  ${
    top.length
      ? `<ol class="recs">${top
          .map((f) => `<li>${bidi(f.recommendation)} <span class="small muted">(الخطوة ${f.step} — شدة <span class="sev sev-${f.severity}">${SEVERITY_LABELS[f.severity]}</span>)</span></li>`)
          .join('')}</ol>
         <p class="review-note">التوصيات مقترحات تخضع للمراجعة البشرية قبل اعتمادها.</p>`
      : '<p class="muted">لا توجد توصيات؛ لم تُسجل ملاحظات مبنية على دليل.</p>'
  }
</section>

<section class="new-page">
  <h2>جدول النتائج</h2>
  ${
    r.findings.length
      ? `<table class="data">
    <colgroup>
      <col style="width:5mm"><col style="width:20mm"><col style="width:13mm"><col style="width:18mm">
      <col><col style="width:28mm"><col style="width:32mm"><col style="width:13mm">
    </colgroup>
    <thead><tr><th>#</th><th>المعيار</th><th>الشدة</th><th>الخطوة</th><th>الدليل</th><th>الأثر</th><th>التوصية</th><th>الثقة</th></tr></thead>
    <tbody>${findingsRows}</tbody>
  </table>
  <p class="review-note">الرحلة لكل الملاحظات: ${bidi(r.journey)}. التوصيات للمراجعة البشرية.</p>`
      : `<p class="muted">لا توجد ملاحظات مسجلة.${r.meta.analysis_mode === 'rules' ? ' لم تكتشف القواعد الآلية مشاكل في الدليل المجموع.' : ''}</p>`
  }
</section>

<section>
  <h2>أحداث التحليلات الناقصة</h2>
  ${
    r.missing_analytics_events.length
      ? `<table class="data">
    <colgroup><col style="width:40mm"><col style="width:55mm"><col></colgroup>
    <thead><tr><th>اسم الحدث</th><th>متى يجب أن يُطلق</th><th>سبب اعتباره ناقصًا</th></tr></thead>
    <tbody>${eventsRows}</tbody>
  </table>`
      : '<p class="muted">لا توجد أحداث ناقصة مؤكدة من الدليل.</p>'
  }
</section>

<section>
  <h2>الدليل غير الكافي</h2>
  ${
    r.insufficient_evidence.length
      ? `<ul class="plain">${r.insufficient_evidence.map((s) => `<li>${bidi(s)}</li>`).join('')}</ul>`
      : '<p class="muted">لا توجد بنود.</p>'
  }
</section>

</body>
</html>`;
}

export function headerTemplate(r) {
  return `<div style="width:100%;font-size:8pt;color:#555;padding:0 16mm;direction:rtl;font-family:'Report Naskh','Noto Naskh Arabic',sans-serif;display:flex;justify-content:space-between;">
    <style>${FONT_CSS}</style>
    <span>تقرير الجودة — ${bidi(r.product_name)}</span>
    <span>${bidi(r.journey)}</span>
  </div>`;
}

export function footerTemplate(r) {
  return `<div style="width:100%;font-size:8pt;color:#555;padding:0 16mm;direction:rtl;font-family:'Report Naskh','Noto Naskh Arabic',sans-serif;display:flex;justify-content:space-between;">
    <style>${FONT_CSS}</style>
    <span>صفحة <span class="pageNumber"></span> من <span class="totalPages"></span></span>
    <span dir="ltr">${formatDate(r.meta.created_at)}</span>
  </div>`;
}
