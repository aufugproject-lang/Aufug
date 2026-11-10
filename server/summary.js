// ملخص تنفيذي نصي يُبنى من بيانات النتيجة فقط (بدون نموذج)، ويُعرض في الواجهة والتقرير.
import { CATEGORIES, CATEGORY_LABELS, SEVERITY_RANK } from './standards.js';

export function counts(findings) {
  const c = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) if (c[f.severity] != null) c[f.severity]++;
  return c;
}

export function byCriterion(findings) {
  const out = {};
  for (const f of findings) {
    const k = f.category || f.criterion;
    const e = (out[k] ||= { count: 0, worst: 'low' });
    e.count++;
    if ((SEVERITY_RANK[f.severity] || 0) > (SEVERITY_RANK[e.worst] || 0)) e.worst = f.severity;
  }
  return out;
}

export function topRecommendations(findings, n = 3) {
  const conf = { high: 0, medium: 1, low: 2 };
  const seen = new Set();
  return [...findings]
    .filter((f) => f.recommendation)
    .sort((a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0) || conf[a.confidence] - conf[b.confidence] || a.step - b.step)
    .filter((f) => (seen.has(f.recommendation) ? false : seen.add(f.recommendation)))
    .slice(0, n);
}

function categoryLine(r, lang) {
  const cs = r.category_scores || {};
  const labels = CATEGORY_LABELS[lang];
  const parts = CATEGORIES.filter((c) => cs[c] && cs[c].score != null).map((c) => `${labels[c]} ${cs[c].score}`);
  const missing = CATEGORIES.filter((c) => cs[c] && cs[c].score == null).map((c) => labels[c]);
  if (lang === 'en')
    return `${parts.length ? `Category scores: ${parts.join(', ')}.` : ''}${missing.length ? ` Not assessed (no evidence): ${missing.join(', ')}.` : ''}`;
  return `${parts.length ? `درجات الفئات: ${parts.join('، ')}.` : ''}${missing.length ? ` لم تُقيّم لعدم توفر الدليل: ${missing.join('، ')}.` : ''}`;
}

export function executiveSummary(r, lang) {
  const c = counts(r.findings);
  const total = r.findings.length;
  const overall = r.overall_score_out_of_100;
  const worst = [...CATEGORIES].filter((k) => r.category_scores && r.category_scores[k] && r.category_scores[k].score != null).sort((a, b) => r.category_scores[a].score - r.category_scores[b].score)[0];
  const labels = CATEGORY_LABELS[lang === 'en' ? 'en' : 'ar'];
  if (lang === 'en') {
    const s1 = `“${r.product_name}” scored ${overall != null ? `${overall}/100` : 'no overall score'} against WCAG 2.2 AA, Nielsen’s heuristics, Core Web Vitals, data-visualization, responsive, security and SEO standards.`;
    const s2 = total
      ? `${total} evidence-based findings were recorded: ${c.critical} critical, ${c.high} high, ${c.medium} medium and ${c.low} low.`
      : 'No evidence-based findings were recorded.';
    const s3 = worst ? `The weakest area is ${labels[worst]} (${r.category_scores[worst].score}/100).` : '';
    return [s1, s2, s3, categoryLine(r, 'en')].filter(Boolean).join(' ');
  }
  const s1 = `حصل «${r.product_name}» على ${overall != null ? `${overall} من 100` : 'درجة كلية غير محسوبة'} مقابل معايير WCAG 2.2 AA واستدلالات نيلسن و Core Web Vitals وتصوير البيانات والتصميم المتجاوب والأمان و SEO.`;
  const s2 = total ? `سُجلت ${total} ملاحظة مبنية على الدليل: ${c.critical} حرجة، و${c.high} عالية، و${c.medium} متوسطة، و${c.low} منخفضة.` : 'لم تُسجل ملاحظات مبنية على الدليل.';
  const s3 = worst ? `أضعف جانب هو ${labels[worst]} (${r.category_scores[worst].score} من 100).` : '';
  return [s1, s2, s3, categoryLine(r, 'ar')].filter(Boolean).join(' ');
}
