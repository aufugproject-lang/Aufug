// ملخص تنفيذي نصي يُبنى من بيانات النتيجة فقط (بدون نموذج)، ويُعرض في الواجهة والتقرير.

export function counts(findings) {
  const c = { high: 0, medium: 0, low: 0 };
  for (const f of findings) c[f.severity]++;
  return c;
}

export function byCriterion(findings) {
  const out = {};
  const rank = { high: 3, medium: 2, low: 1 };
  for (const f of findings) {
    const e = (out[f.criterion] ||= { count: 0, worst: 'low' });
    e.count++;
    if (rank[f.severity] > rank[e.worst]) e.worst = f.severity;
  }
  return out;
}

export function topRecommendations(findings, n = 3) {
  const order = { high: 0, medium: 1, low: 2 };
  const seen = new Set();
  return [...findings]
    .filter((f) => f.recommendation)
    .sort((a, b) => order[a.severity] - order[b.severity] || order[a.confidence] - order[b.confidence] || a.step - b.step)
    .filter((f) => (seen.has(f.recommendation) ? false : seen.add(f.recommendation)))
    .slice(0, n);
}

export function executiveSummary(r, lang) {
  const c = counts(r.findings);
  const total = r.findings.length;
  const miss = r.missing_analytics_events.length;
  const auto = r.meta.auto_explored;
  if (lang === 'en') {
    const how = r.source === 'url' ? (auto ? 'by automatically exploring the site' : 'by running the written journey in a real browser') : 'from the attached evidence files';
    const done =
      r.completed === true
        ? 'The journey completed.'
        : r.completed === false
          ? `The journey did not complete${r.stopped_at_step != null ? ` and stopped at step ${r.stopped_at_step}` : ''}.`
          : 'Journey completion could not be judged from the evidence.';
    const f = total
      ? `${total} evidence-based finding${total > 1 ? 's were' : ' was'} recorded: ${c.high} high, ${c.medium} medium and ${c.low} low severity.`
      : 'No evidence-based findings were recorded.';
    const s = r.score_out_of_5 != null ? ` The score is ${r.score_out_of_5} out of 5.` : '';
    const m = miss ? ` ${miss} expected analytics event${miss > 1 ? 's are' : ' is'} missing.` : '';
    return `“${r.product_name}” was reviewed on the “${r.journey}” journey ${how}. ${done} ${f}${s}${m}`;
  }
  const how = r.source === 'url' ? (auto ? 'باستكشاف الموقع تلقائيًا' : 'بتنفيذ الرحلة المكتوبة في متصفح حقيقي') : 'من ملفات الدليل المرفقة';
  const done =
    r.completed === true
      ? 'اكتملت الرحلة.'
      : r.completed === false
        ? `لم تكتمل الرحلة${r.stopped_at_step != null ? ` وتوقفت عند الخطوة ${r.stopped_at_step}` : ''}.`
        : 'لم يكفِ الدليل للحكم على اكتمال الرحلة.';
  const f = total ? `سُجلت ${total} ملاحظة مبنية على الدليل: ${c.high} عالية، و${c.medium} متوسطة، و${c.low} منخفضة.` : 'لم تُسجل ملاحظات مبنية على الدليل.';
  const s = r.score_out_of_5 != null ? ` الدرجة ${r.score_out_of_5} من 5.` : '';
  const m = miss ? ` هناك ${miss} من أحداث التحليلات المتوقعة غير موجودة.` : '';
  return `رُوجع «${r.product_name}» على رحلة «${r.journey}» ${how}. ${done} ${f}${s}${m}`;
}
