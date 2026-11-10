// كتالوج المعايير التي تُقاس عليها كل ملاحظة: الفئات، معايير WCAG 2.2، استدلالات نيلسن،
// عتبات Core Web Vitals، أوزان الشدة والدرجات، وقائمة الاختبار القابلة لإعادة الاستخدام.

export const CATEGORIES = ['accessibility', 'usability', 'performance', 'data_visualization', 'responsive', 'security_privacy', 'seo_content'];
export const SEVERITIES = ['critical', 'high', 'medium', 'low'];
export const EFFORTS = ['low', 'medium', 'high'];

export const CATEGORY_LABELS = {
  ar: {
    accessibility: 'إمكانية الوصول',
    usability: 'قابلية الاستخدام',
    performance: 'الأداء',
    data_visualization: 'تصوير البيانات',
    responsive: 'التصميم المتجاوب',
    security_privacy: 'الأمان والخصوصية',
    seo_content: 'SEO والمحتوى',
  },
  en: {
    accessibility: 'Accessibility',
    usability: 'Usability',
    performance: 'Performance',
    data_visualization: 'Data visualization',
    responsive: 'Responsive design',
    security_privacy: 'Security & privacy',
    seo_content: 'SEO & content',
  },
};

export const CATEGORY_STANDARDS = {
  accessibility: 'WCAG 2.2 Level AA',
  usability: "Nielsen's 10 heuristics + ISO 9241-11",
  performance: 'Core Web Vitals (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1) + Lighthouse audits',
  data_visualization: 'WCAG 1.1.1 / 1.4.1 / 1.4.11 + data-visualization best practice',
  responsive: 'WCAG 1.4.4 / 1.4.10 / 2.5.8 + mobile-friendly guidelines',
  security_privacy: 'OWASP Top 10 (2021) + HTTPS + cookie consent (GDPR / ePrivacy / PDPL)',
  seo_content: 'Google Search Essentials + semantic HTML (WCAG 1.3.1 / 2.4.2 / 2.4.6)',
};

// معايير نجاح WCAG 2.2 من المستويين A و AA (4.1.1 أُلغي في 2.2)
export const WCAG = {
  '1.1.1': ['Non-text Content', 'A'],
  '1.2.1': ['Audio-only and Video-only (Prerecorded)', 'A'],
  '1.2.2': ['Captions (Prerecorded)', 'A'],
  '1.2.3': ['Audio Description or Media Alternative (Prerecorded)', 'A'],
  '1.2.4': ['Captions (Live)', 'AA'],
  '1.2.5': ['Audio Description (Prerecorded)', 'AA'],
  '1.3.1': ['Info and Relationships', 'A'],
  '1.3.2': ['Meaningful Sequence', 'A'],
  '1.3.3': ['Sensory Characteristics', 'A'],
  '1.3.4': ['Orientation', 'AA'],
  '1.3.5': ['Identify Input Purpose', 'AA'],
  '1.4.1': ['Use of Color', 'A'],
  '1.4.2': ['Audio Control', 'A'],
  '1.4.3': ['Contrast (Minimum)', 'AA'],
  '1.4.4': ['Resize Text', 'AA'],
  '1.4.5': ['Images of Text', 'AA'],
  '1.4.10': ['Reflow', 'AA'],
  '1.4.11': ['Non-text Contrast', 'AA'],
  '1.4.12': ['Text Spacing', 'AA'],
  '1.4.13': ['Content on Hover or Focus', 'AA'],
  '2.1.1': ['Keyboard', 'A'],
  '2.1.2': ['No Keyboard Trap', 'A'],
  '2.1.4': ['Character Key Shortcuts', 'A'],
  '2.2.1': ['Timing Adjustable', 'A'],
  '2.2.2': ['Pause, Stop, Hide', 'A'],
  '2.3.1': ['Three Flashes or Below Threshold', 'A'],
  '2.4.1': ['Bypass Blocks', 'A'],
  '2.4.2': ['Page Titled', 'A'],
  '2.4.3': ['Focus Order', 'A'],
  '2.4.4': ['Link Purpose (In Context)', 'A'],
  '2.4.5': ['Multiple Ways', 'AA'],
  '2.4.6': ['Headings and Labels', 'AA'],
  '2.4.7': ['Focus Visible', 'AA'],
  '2.4.11': ['Focus Not Obscured (Minimum)', 'AA'],
  '2.5.1': ['Pointer Gestures', 'A'],
  '2.5.2': ['Pointer Cancellation', 'A'],
  '2.5.3': ['Label in Name', 'A'],
  '2.5.4': ['Motion Actuation', 'A'],
  '2.5.7': ['Dragging Movements', 'AA'],
  '2.5.8': ['Target Size (Minimum)', 'AA'],
  '3.1.1': ['Language of Page', 'A'],
  '3.1.2': ['Language of Parts', 'AA'],
  '3.2.1': ['On Focus', 'A'],
  '3.2.2': ['On Input', 'A'],
  '3.2.3': ['Consistent Navigation', 'AA'],
  '3.2.4': ['Consistent Identification', 'AA'],
  '3.2.6': ['Consistent Help', 'A'],
  '3.3.1': ['Error Identification', 'A'],
  '3.3.2': ['Labels or Instructions', 'A'],
  '3.3.3': ['Error Suggestion', 'AA'],
  '3.3.4': ['Error Prevention (Legal, Financial, Data)', 'AA'],
  '3.3.7': ['Redundant Entry', 'A'],
  '3.3.8': ['Accessible Authentication (Minimum)', 'AA'],
  '4.1.2': ['Name, Role, Value', 'A'],
  '4.1.3': ['Status Messages', 'AA'],
};

export function wcag(sc) {
  const [name, level] = WCAG[sc] || ['', ''];
  return `WCAG 2.2 SC ${sc}${name ? ` ${name}` : ''}${level ? ` (${level})` : ''}`;
}

// وسم axe مثل wcag143 أو wcag1410 أو wcag2411 → 1.4.3 / 1.4.10 / 2.4.11
export function scFromAxeTag(tag) {
  const m = /^wcag(\d)(\d)(\d{1,2})$/.exec(tag);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
}

export const NIELSEN = {
  1: 'Visibility of system status',
  2: 'Match between system and the real world',
  3: 'User control and freedom',
  4: 'Consistency and standards',
  5: 'Error prevention',
  6: 'Recognition rather than recall',
  7: 'Flexibility and efficiency of use',
  8: 'Aesthetic and minimalist design',
  9: 'Help users recognize, diagnose, and recover from errors',
  10: 'Help and documentation',
};
export const nielsen = (n) => `Nielsen heuristic #${n}: ${NIELSEN[n]}`;

// عتبات المقاييس: [جيد حتى, ضعيف بعد] — Core Web Vitals وعتبات Lighthouse للجوال
export const METRICS = {
  lcp: { good: 2500, poor: 4000, unit: 'ms', weight: 25, standard: 'Core Web Vitals — LCP ≤ 2.5 s' },
  cls: { good: 0.1, poor: 0.25, unit: '', weight: 25, standard: 'Core Web Vitals — CLS ≤ 0.1' },
  tbt: { good: 200, poor: 600, unit: 'ms', weight: 30, standard: 'Lighthouse TBT ≤ 200 ms (lab proxy for INP ≤ 200 ms)' },
  fcp: { good: 1800, poor: 3000, unit: 'ms', weight: 10, standard: 'Lighthouse / web.dev — FCP ≤ 1.8 s' },
  ttfb: { good: 800, poor: 1800, unit: 'ms', weight: 10, standard: 'web.dev — TTFB ≤ 0.8 s' },
};

export function rateMetric(key, value) {
  const m = METRICS[key];
  if (value == null || !m) return null;
  return value <= m.good ? 'good' : value <= m.poor ? 'needs_improvement' : 'poor';
}

// درجة المقياس من 0 إلى 100: 100 عند حد "جيد" أو أفضل، 0 عند ضعف حد "ضعيف"، وخطي بينهما بنقطة 50 عند حد "ضعيف"
export function metricScore(key, value) {
  const m = METRICS[key];
  if (value == null || !m) return null;
  if (value <= m.good) return 100;
  if (value <= m.poor) return Math.round(100 - ((value - m.good) / (m.poor - m.good)) * 50);
  return Math.max(0, Math.round(50 - ((value - m.poor) / m.poor) * 50));
}

export function performanceScore(metrics) {
  let sum = 0;
  let weights = 0;
  for (const key of Object.keys(METRICS)) {
    const s = metricScore(key, metrics[key]);
    if (s == null) continue;
    sum += s * METRICS[key].weight;
    weights += METRICS[key].weight;
  }
  return weights ? Math.round(sum / weights) : null;
}

// خصم الشدة لدرجات الفئات غير الأداء (من 100)، من الملاحظات عالية الثقة فقط
export const SEVERITY_PENALTY = { critical: 30, high: 15, medium: 7, low: 2 };
export const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };
const EFFORT_COST = { low: 1, medium: 2, high: 3 };
const CONFIDENCE_FACTOR = { high: 1, medium: 0.7, low: 0.4 };

export function categoryScore(findings) {
  const penalty = findings.filter((f) => f.confidence === 'high').reduce((s, f) => s + (SEVERITY_PENALTY[f.severity] || 0), 0);
  return Math.max(0, 100 - penalty);
}

// الأولوية = الأثر ÷ الجهد؛ الأثر من الشدة والثقة
export function priorityValue(f) {
  const impact = (SEVERITY_PENALTY[f.severity] || 1) * (CONFIDENCE_FACTOR[f.confidence] || 0.5);
  return impact / (EFFORT_COST[f.effort] || 2);
}

// قائمة اختبار قابلة لإعادة الاستخدام لكل إصدار: [البند, الأداة]
export const CHECKLIST = {
  ar: {
    accessibility: [
      ['افحص كل الصفحات الأساسية حتى صفر مخالفات WCAG 2.2 AA', 'axe DevTools, WAVE'],
      ['نفّذ المهام الرئيسية بلوحة المفاتيح فقط (Tab وShift+Tab وEnter وSpace وEsc) وتأكد أن التركيز ظاهر دائمًا وغير مغطى', 'لوحة المفاتيح + Chrome DevTools'],
      ['استمع للرسوم البيانية والجداول والنماذج ورسائل الخطأ بقارئ شاشة', 'NVDA (Windows), VoiceOver (macOS/iOS), TalkBack (Android)'],
      ['تحقق من تباين النصوص 4.5:1 والعناصر غير النصية 3:1', 'WebAIM Contrast Checker, Chrome DevTools'],
      ['كبّر الصفحة إلى 200% و400% (عرض 320px) بلا فقدان محتوى أو تمرير أفقي', 'زوم المتصفح'],
    ],
    usability: [
      ['اختبر المهام الرئيسية مع 5 مستخدمين على الأقل وقِس نسبة النجاح والوقت والأخطاء (ISO 9241-11)', 'جلسات اختبار مستخدمين'],
      ['قِس الرضا باستبيان SUS بعد كل جلسة', 'System Usability Scale'],
      ['راجع الواجهة مقابل استدلالات نيلسن العشرة', 'مراجعة خبير'],
    ],
    performance: [
      ['شغّل Lighthouse بوضع الجوال على الصفحات الأساسية وثبّت ميزانية أداء', 'Lighthouse, PageSpeed Insights'],
      ['راجع بيانات المستخدمين الحقيقيين (p75) لـ LCP وINP وCLS', 'PageSpeed Insights (CrUX), Search Console'],
      ['قِس INP بتفاعلات حقيقية على المهام الرئيسية', 'Web Vitals extension, Chrome DevTools Performance'],
      ['اختبر التحميل على 4G بطيء وراجع شريط الإطارات', 'WebPageTest'],
      ['اختبر أكبر حجم بيانات واقعي (تقسيم صفحات أو عرض افتراضي)', 'Chrome DevTools Performance'],
    ],
    data_visualization: [
      ['اعرض كل رسم بمحاكاة عمى الألوان', 'Chrome DevTools › Rendering › Emulate vision deficiencies, Coblis'],
      ['تأكد أن لكل رسم عنوانًا وتسميات محاور ووحدات، وأن الأعمدة تبدأ من الصفر', 'مراجعة يدوية'],
      ['وفّر ملخصًا نصيًا أو جدول بيانات بديلًا لكل رسم', 'قارئ شاشة + مراجعة يدوية'],
    ],
    responsive: [
      ['اختبر العروض 320 و390 و768 و1024 و1440 بكسل', 'Chrome DevTools Device Mode'],
      ['اختبر على أجهزة حقيقية وبالاتجاهين', 'iOS Safari, Android Chrome'],
      ['تأكد أن أهداف اللمس 24×24 بكسل على الأقل (44 مستحسن)', 'Lighthouse, axe'],
    ],
    security_privacy: [
      ['افحص ترويسات الأمان وشهادة TLS', 'securityheaders.com, Mozilla Observatory, SSL Labs'],
      ['شغّل فحصًا أساسيًا لـ OWASP', 'OWASP ZAP baseline scan'],
      ['افحص المكتبات المعروفة الثغرات', 'npm audit, Snyk, Retire.js'],
      ['تحقق أن لا تتبع قبل الموافقة على ملفات الارتباط، وأن ملفات الجلسة Secure وHttpOnly', 'Chrome DevTools › Network / Application'],
    ],
    seo_content: [
      ['شغّل تدقيق SEO وراجع العناوين والوصف والعناوين الرئيسية', 'Lighthouse SEO, HeadingsMap'],
      ['راجع الفهرسة والأخطاء', 'Google Search Console'],
      ['تحقق من صحة HTML', 'W3C Markup Validator'],
    ],
  },
  en: {
    accessibility: [
      ['Scan every key page to zero WCAG 2.2 AA violations', 'axe DevTools, WAVE'],
      ['Run the key tasks with the keyboard only (Tab, Shift+Tab, Enter, Space, Esc); focus is always visible and never hidden', 'Keyboard + Chrome DevTools'],
      ['Listen to charts, tables, forms and error messages with a screen reader', 'NVDA (Windows), VoiceOver (macOS/iOS), TalkBack (Android)'],
      ['Check text contrast 4.5:1 and non-text contrast 3:1', 'WebAIM Contrast Checker, Chrome DevTools'],
      ['Zoom to 200% and 400% (320px width) with no lost content or horizontal scrolling', 'Browser zoom'],
    ],
    usability: [
      ['Test the key tasks with at least 5 users; measure success rate, time and errors (ISO 9241-11)', 'User testing sessions'],
      ['Measure satisfaction with the SUS questionnaire after each session', 'System Usability Scale'],
      ['Review the interface against Nielsen’s 10 heuristics', 'Expert review'],
    ],
    performance: [
      ['Run Lighthouse (mobile) on key pages and enforce a performance budget', 'Lighthouse, PageSpeed Insights'],
      ['Review real-user (p75) LCP, INP and CLS', 'PageSpeed Insights (CrUX), Search Console'],
      ['Measure INP with real interactions on the key tasks', 'Web Vitals extension, Chrome DevTools Performance'],
      ['Test loading on slow 4G and review the filmstrip', 'WebPageTest'],
      ['Test with the largest realistic dataset (pagination or virtualization)', 'Chrome DevTools Performance'],
    ],
    data_visualization: [
      ['View every chart under colour-blindness simulation', 'Chrome DevTools › Rendering › Emulate vision deficiencies, Coblis'],
      ['Every chart has a title, axis labels and units; bars start at zero', 'Manual review'],
      ['Provide a text summary or data-table alternative for every chart', 'Screen reader + manual review'],
    ],
    responsive: [
      ['Test widths 320, 390, 768, 1024 and 1440 px', 'Chrome DevTools Device Mode'],
      ['Test on real devices in both orientations', 'iOS Safari, Android Chrome'],
      ['Touch targets are at least 24×24 px (44 recommended)', 'Lighthouse, axe'],
    ],
    security_privacy: [
      ['Check security headers and the TLS certificate', 'securityheaders.com, Mozilla Observatory, SSL Labs'],
      ['Run a baseline OWASP scan', 'OWASP ZAP baseline scan'],
      ['Scan for libraries with known vulnerabilities', 'npm audit, Snyk, Retire.js'],
      ['No tracking before cookie consent; session cookies are Secure and HttpOnly', 'Chrome DevTools › Network / Application'],
    ],
    seo_content: [
      ['Run an SEO audit; review titles, descriptions and headings', 'Lighthouse SEO, HeadingsMap'],
      ['Review indexing and errors', 'Google Search Console'],
      ['Validate the HTML', 'W3C Markup Validator'],
    ],
  },
};
