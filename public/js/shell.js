// أساس مشترك للصفحتين: الأيقونات، اللغة (عربي/English)، والوضع الفاتح/الداكن.
(() => {
  const ICONS = {
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8M16 13H8M16 17H8"/>',
    zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    chart: '<path d="M4 20V14M10 20V8M16 20V11M22 20V4"/>',
    cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    pointer: '<path d="M4.04 4.95a.5.5 0 0 1 .65-.65l15 6a.5.5 0 0 1-.06.95l-6.2 1.6a2 2 0 0 0-1.43 1.43l-1.6 6.2a.5.5 0 0 1-.95.06z"/>',
    user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    access: '<circle cx="16" cy="4" r="1"/><path d="m18 19 1-7-6 1"/><path d="m5 8 3-3 5.5 3-2.36 3.5"/><path d="M4.24 14.5a5 5 0 0 0 6.88 6"/><path d="M13.76 17.5a5 5 0 0 0-6.88-6"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22V15"/>',
    star: '<path d="M11.5 2.9a.5.5 0 0 1 .9 0l2.3 4.7a2 2 0 0 0 1.5 1.1l5.2.8a.5.5 0 0 1 .3.9l-3.8 3.7a2 2 0 0 0-.6 1.8l.9 5.2a.5.5 0 0 1-.7.5l-4.6-2.5a2 2 0 0 0-1.9 0l-4.6 2.5a.5.5 0 0 1-.7-.5l.9-5.2a2 2 0 0 0-.6-1.8L1.3 10.4a.5.5 0 0 1 .3-.9l5.2-.8a2 2 0 0 0 1.5-1.1z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
  };
  const sprite = Object.entries(ICONS)
    .map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${v}</symbol>`)
    .join('');
  document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${sprite}</svg>`);
  const icon = (name, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  const DICT = {
    ar: {
      'brand.name': 'Quality Review',
      'brand.sub': 'مراجعة جودة المنتج وتجربة العميل',
      'lang.label': 'العربية',
      'theme.toggle': 'تبديل الوضع الفاتح والداكن',
      'lang.toggle': 'اللغة',
      'model.on': (m) => `النموذج مفعّل · ${m}`,
      'model.off': 'تحليل بالقواعد الآلية',
      'home.title1': 'حوّل تجربة المستخدم',
      'home.title2': 'إلى رؤى قابلة للتنفيذ',
      'home.lead': 'أدخل رابط المنصة التي تريد تحليل تجربة المستخدم وجودة المنتج فيها.',
      'home.url_ph': 'https://example.com',
      'home.start': 'ابدأ التحليل',
      'home.note': 'سيتم تحليل الموقع تلقائيًا واستخراج الملاحظات والتقارير.',
      'home.or_files': 'أو حلّل ملفات دليل بدل الرابط',
      'home.back_url': 'الرجوع إلى تحليل رابط',
      'tab.url': 'رابط الموقع',
      'tab.file': 'إرفاق ملفات',
      'drop.title': 'اسحب ملفات الدليل هنا أو اضغط للاختيار',
      'drop.demo': 'ملف تجربة',
      'drop.remove': 'إزالة',
      'opts.url': 'تخصيص الرحلة',
      'opts.file': 'بيانات الرحلة',
      'opts.optional': 'اختياري',
      'opts.required': 'مطلوبة',
      'f.user': 'مستخدم الحساب التجريبي',
      'f.pass': 'كلمة مرور الحساب التجريبي',
      'f.product': 'اسم المنتج',
      'f.product_ph_url': 'يؤخذ من عنوان الموقع إن تُرك فارغًا',
      'f.product_ph_file': 'مثال: متجر نخيل',
      'f.journey': 'اسم الرحلة',
      'f.journey_ph': 'مثال: التسجيل وإنشاء أول طلب',
      'f.steps': 'خطوات الرحلة',
      'f.steps_hint': 'خطوة في كل سطر',
      'f.steps_ph': 'اضغط «تسجيل الدخول»\nاكتب «{{username}}» في «البريد الإلكتروني»\nاكتب «{{password}}» في «كلمة المرور»\nاضغط «دخول»\nتحقق من ظهور «لوحة التحكم»',
      'f.condition': 'شرط النجاح',
      'f.condition_hint': 'جملة واحدة',
      'f.condition_ph': 'مثال: تظهر صفحة تأكيد تحتوي رقم الطلب',
      'f.features': 'القصص والميزات المتوقعة',
      'f.features_hint': 'بند في كل سطر',
      'f.events': 'أحداث التحليلات المتوقعة',
      'f.events_hint': 'اسم_الحدث — متى',
      'f.events_ph': 'sign_up — عند إنشاء الحساب',
      'syntax.title': 'الصيغ التي ينفذها المتصفح الآلي',
      'syntax.rows': [
        ['افتح /login', 'فتح مسار أو رابط'],
        ['اضغط «تسجيل الدخول»', 'ضغط زر أو رابط بنصه الظاهر'],
        ['اكتب «{{username}}» في «البريد الإلكتروني»', 'تعبئة حقل بتسميته أو placeholder أو name'],
        ['اختر «الرياض» من «المدينة»', 'اختيار من قائمة'],
        ['فعّل «أوافق على الشروط»', 'تفعيل خانة اختيار'],
        ['اضغط مفتاح Enter', 'ضغط مفتاح'],
        ['انتظر «تم الحفظ» · انتظر 2 ثانية', 'انتظار نص أو مدة'],
        ['تحقق من ظهور «رقم الطلب»', 'التحقق من ظهور نص'],
      ],
      'syntax.note': '{{username}} و {{password}} تُستبدل ببيانات الحساب التجريبي. أي خطوة بصيغة أخرى تُسجل خطوةً تعذر تنفيذها وتتوقف الرحلة عندها. بدون خطوات تستكشف الأداة الموقع تلقائيًا.',
      'feat.1.t': 'قرارات أفضل',
      'feat.1.d': 'ملاحظات مبنية على الدليل المجموع',
      'feat.2.t': 'نتائج أسرع',
      'feat.2.d': 'تحليل تلقائي خلال دقائق',
      'feat.3.t': 'تقارير احترافية',
      'feat.3.d': 'تقرير PDF واضح وقابل للمشاركة',
      'feat.4.t': 'تحليل شامل',
      'feat.4.d': 'UX و CX والتنقل وإمكانية الوصول والتحليلات',
      'flow.title': 'من رابط واحد .. إلى تقرير شامل',
      'flow.1': 'أدخل رابط المنصة',
      'flow.2': 'تحليل تلقائي',
      'flow.3': 'استخراج الملاحظات',
      'flow.4': 'تقرير قابل للتنفيذ',
      'demo.line': 'تجربة سريعة:',
      'demo.fill': 'تعبئة بيانات التجربة',
      'demo.or': 'أو',
      'demo.open': 'فتح نتيجة التجربة مباشرة',
      'wait.title': 'جارٍ التحليل',
      'wait.queued': 'في الانتظار',
      'wait.s1': 'جمع الدليل',
      'wait.s2': 'التحليل',
      'wait.s3': 'تجهيز النتائج',
      'wait.note': 'قد يستغرق وضع الرابط دقيقة أو أكثر حسب عدد الصفحات.',
      'err.connect': 'تعذر الاتصال بالخادم المحلي.',
      'err.start': 'تعذر بدء التحليل.',
      'err.fail': 'تعذر إكمال التحليل.',
      'err.no_id': 'لا يوجد معرّف نتيجة في الرابط.',
      'err.load': 'تعذر تحميل النتيجة.',
      'err.title': 'تعذر عرض النتيجة',
      'err.new': 'ابدأ مراجعة جديدة',
      // النتائج
      'r.title': 'نتائج التحليل',
      'r.subtitle': 'عرض شامل لجودة تجربة المستخدم وتجربة العميل بناءً على الرحلة المحددة.',
      'r.back': 'العودة',
      'r.new': 'مراجعة جديدة',
      'r.date': 'تاريخ التحليل',
      'r.pdf': 'تحميل التقرير بصيغة PDF',
      'r.journey': 'الرحلة',
      'r.src.url': 'رابط · رحلة مكتوبة',
      'r.src.auto': 'رابط · استكشاف تلقائي',
      'r.src.file': 'ملفات مرفقة',
      'r.mode.model': 'حكم بالنموذج',
      'r.mode.rules': 'قواعد آلية',
      'r.mode.demo': 'بيانات تجربة',
      'r.mode.evidence': 'دليل فقط',
      'r.lang_note': 'محتوى هذه النتيجة بالعربية لأن التحليل تم بهذه اللغة.',
      'k.completion': 'اكتمال الرحلة',
      'k.score': 'الدرجة الكلية',
      'k.total': 'إجمالي الملاحظات',
      'k.missing': 'أحداث التحليلات الناقصة',
      'c.completed': 'مكتملة',
      'c.ran': 'نُفذت الخطوات',
      'c.not': 'غير مكتملة',
      'c.unknown': 'غير محدد',
      'c.stopped': (n) => `توقفت عند الخطوة ${n}`,
      'c.all_ok': 'تم تنفيذ جميع الخطوات بنجاح',
      'c.no_condition': 'لم يُحدد شرط نجاح',
      'k.scored_from': (n) => `من ${n} ملاحظة عالية الثقة`,
      'k.not_scored': 'تُحسب بعد التحليل',
      'k.events_sub': (n) => (n ? 'متوقعة ولم تظهر في الدليل' : 'لا أحداث ناقصة مؤكدة'),
      'tabs.summary': 'الملخص التنفيذي',
      'tabs.findings': 'تفاصيل الملاحظات',
      'tabs.events': 'أحداث التحليلات',
      'tabs.insufficient': 'الدليل غير الكافي',
      'tabs.evidence': 'الدليل المجموع',
      's.title': 'ملخص تنفيذي',
      's.recs': 'أبرز التوصيات',
      's.recs_note': 'مقترحات للمراجعة البشرية قبل اعتمادها.',
      's.no_recs': 'لا توجد توصيات بعد.',
      's.dist': 'توزيع الملاحظات حسب الشدة',
      's.criteria': 'الملاحظات حسب المعيار',
      's.no_criteria': 'لا ملاحظات مسجلة.',
      's.top': 'أهم الملاحظات',
      's.view_all': 'عرض الكل',
      's.condition': 'شرط النجاح',
      's.basis': 'أساس الحكم',
      'of5': 'من 5',
      'sev.high': 'عالية',
      'sev.medium': 'متوسطة',
      'sev.low': 'منخفضة',
      'col.num': '#',
      'col.criterion': 'المعيار',
      'col.finding': 'الملاحظة',
      'col.step': 'الخطوة',
      'col.severity': 'الشدة',
      'col.evidence': 'الدليل',
      'col.impact': 'الأثر',
      'col.rec': 'التوصية المقترحة',
      'col.conf': 'الثقة',
      'col.event': 'اسم الحدث',
      'col.when': 'متى',
      'col.why': 'لماذا',
      'fl.all_sev': 'كل الشدات',
      'fl.all_crit': 'كل المعايير',
      'fl.none': 'لا توجد ملاحظات بهذه التصفية.',
      'f.source': 'المصدر',
      'f.rule': 'قاعدة آلية',
      'f.model': 'النموذج',
      'f.review': 'بانتظار مراجعة بشرية',
      'f.empty_rules': 'لم تكتشف القواعد الآلية مشاكل في الدليل المجموع.',
      'f.empty': 'لم تُسجل ملاحظات مبنية على الدليل.',
      'e.empty': 'لا توجد أحداث ناقصة مؤكدة من الدليل.',
      'e.observed': 'ظهرت في الدليل:',
      'i.empty': 'لا توجد بنود.',
      'w.title': 'تنبيهات الجمع',
      'ev.step_status': { done: 'نُفذت', failed: 'تعذر تنفيذها', not_run: 'لم تُنفذ' },
      'ev.failed_req': (n) => `${n} طلب فاشل`,
      'ev.errors': (n) => `${n} رسالة خطأ`,
      'ev.action': 'الإجراء',
      'ev.errors_h': 'رسائل الخطأ',
      'ev.buttons_h': 'الأزرار والروابط الظاهرة',
      'ev.net_h': (n) => `طلبات الشبكة (${n})`,
      'ev.no_failed': 'لا طلبات فاشلة.',
      'ev.console_h': 'أخطاء الكونسول',
      'ev.text_h': 'النص الظاهر',
      'ev.no_text': '(بلا نص)',
      'ev.har': (n, f) => `${n} طلب شبكة، منها ${f} فاشل.`,
      'ev.unlabeled': 'حقول بلا تسمية:',
      'ev.image': 'صورة',
      'raw.title': 'JSON الداخلي',
      'general': 'الصفحة الأولى / عام',
      'crit.UX': 'تجربة الاستخدام',
      'crit.CX': 'تجربة العميل',
      'crit.navigation': 'التنقل',
      'crit.accessibility': 'إمكانية الوصول',
      'crit.feature_completeness': 'اكتمال الميزات',
      'crit.friction': 'الاحتكاك',
      'crit.analytics': 'التحليلات',
    },
    en: {
      'brand.name': 'Quality Review',
      'brand.sub': 'Product quality & customer experience review',
      'lang.label': 'English',
      'theme.toggle': 'Toggle light and dark mode',
      'lang.toggle': 'Language',
      'model.on': (m) => `AI model on · ${m}`,
      'model.off': 'Rule-based analysis',
      'home.title1': 'Turn user experience',
      'home.title2': 'into actionable insights',
      'home.lead': 'Enter the link of the platform whose user experience and product quality you want to analyze.',
      'home.url_ph': 'https://example.com',
      'home.start': 'Start analysis',
      'home.note': 'The site is analyzed automatically, and findings and reports are generated.',
      'home.or_files': 'Or analyze evidence files instead of a link',
      'home.back_url': 'Back to analyzing a link',
      'tab.url': 'Site link',
      'tab.file': 'Attach files',
      'drop.title': 'Drag evidence files here or click to choose',
      'drop.demo': 'demo file',
      'drop.remove': 'Remove',
      'opts.url': 'Customize the journey',
      'opts.file': 'Journey details',
      'opts.optional': 'Optional',
      'opts.required': 'Required',
      'f.user': 'Test account username',
      'f.pass': 'Test account password',
      'f.product': 'Product name',
      'f.product_ph_url': 'Taken from the site title if left empty',
      'f.product_ph_file': 'e.g. Nakheel Store',
      'f.journey': 'Journey name',
      'f.journey_ph': 'e.g. Sign up and place a first order',
      'f.steps': 'Journey steps',
      'f.steps_hint': 'one step per line',
      'f.steps_ph': 'click "Sign in"\nfill "Email" with "{{username}}"\nfill "Password" with "{{password}}"\npress Enter\nexpect "Dashboard"',
      'f.condition': 'Success condition',
      'f.condition_hint': 'one sentence',
      'f.condition_ph': 'e.g. A confirmation page with the order number appears',
      'f.features': 'Expected stories and features',
      'f.features_hint': 'one per line',
      'f.events': 'Expected analytics events',
      'f.events_hint': 'event_name — when',
      'f.events_ph': 'sign_up — when the account is created',
      'syntax.title': 'Step formats the browser automation runs',
      'syntax.rows': [
        ['open /login', 'Open a path or URL'],
        ['click "Sign in"', 'Click a button or link by its visible text'],
        ['fill "Email" with "{{username}}"', 'Fill a field by label, placeholder or name'],
        ['select "Riyadh" in "City"', 'Pick from a list'],
        ['check "I agree"', 'Tick a checkbox'],
        ['press Enter', 'Press a key'],
        ['wait for "Saved" · wait 2 s', 'Wait for text or a duration'],
        ['expect "Order number"', 'Check that text appears'],
      ],
      'syntax.note': '{{username}} and {{password}} are replaced with the test account. Any other format is recorded as a step that could not run, and the journey stops there. Arabic step formats also work. Without steps, the tool explores the site automatically.',
      'feat.1.t': 'Better decisions',
      'feat.1.d': 'Findings grounded in collected evidence',
      'feat.2.t': 'Faster results',
      'feat.2.d': 'Automatic analysis in minutes',
      'feat.3.t': 'Professional reports',
      'feat.3.d': 'A clear, shareable PDF report',
      'feat.4.t': 'Full coverage',
      'feat.4.d': 'UX, CX, navigation, accessibility and analytics',
      'flow.title': 'From one link to a complete report',
      'flow.1': 'Enter the platform link',
      'flow.2': 'Automatic analysis',
      'flow.3': 'Findings extracted',
      'flow.4': 'Actionable report',
      'demo.line': 'Quick try:',
      'demo.fill': 'Fill in demo data',
      'demo.or': 'or',
      'demo.open': 'open the demo result',
      'wait.title': 'Analyzing',
      'wait.queued': 'Queued',
      'wait.s1': 'Collect evidence',
      'wait.s2': 'Analyze',
      'wait.s3': 'Prepare results',
      'wait.note': 'Link mode can take a minute or more depending on the number of pages.',
      'err.connect': 'Could not reach the local server.',
      'err.start': 'Could not start the analysis.',
      'err.fail': 'The analysis could not complete.',
      'err.no_id': 'No result id in the link.',
      'err.load': 'Could not load the result.',
      'err.title': 'Could not show the result',
      'err.new': 'Start a new review',
      'r.title': 'Analysis results',
      'r.subtitle': 'A full view of user and customer experience quality for the selected journey.',
      'r.back': 'Back',
      'r.new': 'New review',
      'r.date': 'Analyzed on',
      'r.pdf': 'Download PDF report',
      'r.journey': 'Journey',
      'r.src.url': 'Link · written journey',
      'r.src.auto': 'Link · automatic exploration',
      'r.src.file': 'Attached files',
      'r.mode.model': 'AI model verdict',
      'r.mode.rules': 'Rule-based',
      'r.mode.demo': 'Demo data',
      'r.mode.evidence': 'Evidence only',
      'r.lang_note': 'This result’s content is in Arabic because the analysis ran in Arabic.',
      'k.completion': 'Journey completion',
      'k.score': 'Overall score',
      'k.total': 'Total findings',
      'k.missing': 'Missing analytics events',
      'c.completed': 'Completed',
      'c.ran': 'Steps ran',
      'c.not': 'Not completed',
      'c.unknown': 'Undetermined',
      'c.stopped': (n) => `Stopped at step ${n}`,
      'c.all_ok': 'All steps ran successfully',
      'c.no_condition': 'No success condition set',
      'k.scored_from': (n) => `from ${n} high-confidence finding${n === 1 ? '' : 's'}`,
      'k.not_scored': 'Calculated after analysis',
      'k.events_sub': (n) => (n ? 'expected but not seen in evidence' : 'no confirmed missing events'),
      'tabs.summary': 'Executive summary',
      'tabs.findings': 'Findings',
      'tabs.events': 'Analytics events',
      'tabs.insufficient': 'Insufficient evidence',
      'tabs.evidence': 'Collected evidence',
      's.title': 'Executive summary',
      's.recs': 'Top recommendations',
      's.recs_note': 'Proposals for human review before adoption.',
      's.no_recs': 'No recommendations yet.',
      's.dist': 'Findings by severity',
      's.criteria': 'Findings by criterion',
      's.no_criteria': 'No findings recorded.',
      's.top': 'Top findings',
      's.view_all': 'View all',
      's.condition': 'Success condition',
      's.basis': 'Basis',
      'of5': 'of 5',
      'sev.high': 'High',
      'sev.medium': 'Medium',
      'sev.low': 'Low',
      'col.num': '#',
      'col.criterion': 'Criterion',
      'col.finding': 'Finding',
      'col.step': 'Step',
      'col.severity': 'Severity',
      'col.evidence': 'Evidence',
      'col.impact': 'Impact',
      'col.rec': 'Suggested recommendation',
      'col.conf': 'Confidence',
      'col.event': 'Event name',
      'col.when': 'When',
      'col.why': 'Why',
      'fl.all_sev': 'All severities',
      'fl.all_crit': 'All criteria',
      'fl.none': 'No findings match this filter.',
      'f.source': 'Source',
      'f.rule': 'rule',
      'f.model': 'AI model',
      'f.review': 'Pending human review',
      'f.empty_rules': 'The rules found no issues in the collected evidence.',
      'f.empty': 'No evidence-based findings were recorded.',
      'e.empty': 'No confirmed missing events in the evidence.',
      'e.observed': 'Seen in evidence:',
      'i.empty': 'None.',
      'w.title': 'Collection warnings',
      'ev.step_status': { done: 'Done', failed: 'Failed', not_run: 'Not run' },
      'ev.failed_req': (n) => `${n} failed request${n === 1 ? '' : 's'}`,
      'ev.errors': (n) => `${n} error message${n === 1 ? '' : 's'}`,
      'ev.action': 'Action',
      'ev.errors_h': 'Error messages',
      'ev.buttons_h': 'Visible buttons and links',
      'ev.net_h': (n) => `Network requests (${n})`,
      'ev.no_failed': 'No failed requests.',
      'ev.console_h': 'Console errors',
      'ev.text_h': 'Visible text',
      'ev.no_text': '(no text)',
      'ev.har': (n, f) => `${n} network requests, ${f} failed.`,
      'ev.unlabeled': 'Unlabeled fields:',
      'ev.image': 'Image',
      'raw.title': 'Internal JSON',
      'general': 'First page / general',
      'crit.UX': 'UX',
      'crit.CX': 'CX',
      'crit.navigation': 'Navigation',
      'crit.accessibility': 'Accessibility',
      'crit.feature_completeness': 'Feature completeness',
      'crit.friction': 'Friction',
      'crit.analytics': 'Analytics',
    },
  };

  const store = {
    get(k) {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, v);
      } catch {}
    },
  };

  let lang = store.get('qr.lang') === 'en' ? 'en' : 'ar';
  const t = (key, ...args) => {
    const v = DICT[lang][key] ?? DICT.ar[key];
    if (v === undefined) return key;
    return typeof v === 'function' ? v(...args) : v;
  };

  const listeners = [];
  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    listeners.forEach((fn) => fn(lang));
  }

  // الوضع: فاتح أو داكن، يُحفظ عند المستخدم
  function applyTheme(theme) {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    document.querySelectorAll('.theme-btn use').forEach((u) => u.setAttribute('href', dark ? '#i-moon' : '#i-sun'));
  }

  function mountHeader() {
    const header = document.querySelector('.topbar');
    if (!header) return;
    header.innerHTML = `
      <a href="/" class="brand">
        <svg class="logo" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 6c9 0 16 6 16 15v13C15 34 8 28 8 19z" fill="var(--logo-a)"/><path d="M32 10c-6 1-10 6-10 12v12c6-1 10-6 10-12z" fill="var(--logo-b)"/></svg>
        <span class="brand-text"><strong data-i18n="brand.name"></strong><small data-i18n="brand.sub"></small></span>
      </a>
      <div class="top-actions">
        <span id="model-status" class="pill" hidden><span class="dot"></span><span class="txt"></span></span>
        <button type="button" class="icon-btn theme-btn" data-i18n-aria="theme.toggle">${icon('sun')}</button>
        <span class="sep" aria-hidden="true"></span>
        <div class="lang-menu">
          <button type="button" class="lang-btn" aria-haspopup="true" aria-expanded="false" data-i18n-aria="lang.toggle">
            ${icon('globe')}<span data-i18n="lang.label"></span>${icon('chevron', 'chev')}
          </button>
          <ul class="lang-list" role="menu" hidden>
            <li><button type="button" role="menuitem" data-lang="ar">العربية</button></li>
            <li><button type="button" role="menuitem" data-lang="en">English</button></li>
          </ul>
        </div>
      </div>`;
    const themeBtn = header.querySelector('.theme-btn');
    themeBtn.addEventListener('click', () => {
      const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const next = cur === 'dark' ? 'light' : 'dark';
      store.set('qr.theme', next);
      applyTheme(next);
    });
    const btn = header.querySelector('.lang-btn');
    const menu = header.querySelector('.lang-list');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      btn.setAttribute('aria-expanded', String(!menu.hidden));
    });
    document.addEventListener('click', () => {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    });
    menu.querySelectorAll('[data-lang]').forEach((b) =>
      b.addEventListener('click', () => {
        lang = b.dataset.lang;
        store.set('qr.lang', lang);
        applyLang();
      }),
    );

    fetch('/api/status')
      .then((r) => r.json())
      .then((s) => {
        const el = document.getElementById('model-status');
        el.hidden = false;
        el.classList.add(s.model_configured ? 'ok' : 'warn');
        const upd = () => (el.querySelector('.txt').textContent = s.model_configured ? t('model.on', s.model) : t('model.off'));
        upd();
        listeners.push(upd);
      })
      .catch(() => {});
  }

  window.QR = {
    t,
    icon,
    get lang() {
      return lang;
    },
    onLang: (fn) => listeners.push(fn),
    applyLang,
  };

  mountHeader();
  applyTheme(store.get('qr.theme'));
  applyLang();
})();
