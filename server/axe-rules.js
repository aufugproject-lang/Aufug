// صياغة ثنائية اللغة لأكثر قواعد axe-core شيوعًا، مع إصلاح ومثال كود وتقدير الجهد.
// القواعد غير المدرجة تُعرض بنص axe الأصلي ورابط الشرح.

export const AXE_RULES = {
  'color-contrast': {
    ar: ['تباين النص مع خلفيته أقل من الحد المطلوب', 'ارفع التباين إلى 4.5:1 للنص العادي و3:1 للنص الكبير'],
    en: ['Text contrast against its background is below the minimum', 'Raise contrast to 4.5:1 for normal text and 3:1 for large text'],
    code: '/* before: color: #9aa0a6 on #ffffff (2.6:1) */\n.label { color: #5f6368; } /* 6.3:1 */',
    effort: 'low',
  },
  'image-alt': {
    ar: ['صور بلا نص بديل', 'أضف alt يصف معنى الصورة، أو alt="" للصور الزخرفية'],
    en: ['Images have no text alternative', 'Add alt describing the image’s purpose, or alt="" for decorative images'],
    code: '<img src="revenue.png" alt="Revenue grew 18% from Q1 to Q2">\n<img src="divider.svg" alt="">',
    effort: 'low',
  },
  label: {
    ar: ['حقول نموذج بلا تسمية', 'اربط كل حقل بعنصر label ظاهر'],
    en: ['Form fields have no label', 'Associate each field with a visible label'],
    code: '<label for="email">Email</label>\n<input id="email" type="email" autocomplete="email">',
    effort: 'low',
  },
  'select-name': {
    ar: ['قوائم اختيار بلا اسم يمكن الوصول إليه', 'أضف label مرتبطًا بالقائمة'],
    en: ['Select menus have no accessible name', 'Add a label associated with the select'],
    code: '<label for="range">Date range</label>\n<select id="range">…</select>',
    effort: 'low',
  },
  'button-name': {
    ar: ['أزرار بلا اسم يمكن الوصول إليه', 'أضف نصًا ظاهرًا أو aria-label للأزرار الأيقونية'],
    en: ['Buttons have no accessible name', 'Add visible text or an aria-label to icon buttons'],
    code: '<button type="button" aria-label="Export report">\n  <svg aria-hidden="true">…</svg>\n</button>',
    effort: 'low',
  },
  'link-name': {
    ar: ['روابط بلا نص يمكن الوصول إليه', 'أضف نصًا للرابط أو aria-label يصف وجهته'],
    en: ['Links have no discernible text', 'Give the link text or an aria-label describing its destination'],
    code: '<a href="/reports" aria-label="Reports"><svg aria-hidden="true">…</svg></a>',
    effort: 'low',
  },
  'html-has-lang': {
    ar: ['عنصر html بلا خاصية lang', 'حدد لغة الصفحة'],
    en: ['The html element has no lang attribute', 'Declare the page language'],
    code: '<html lang="ar" dir="rtl">',
    effort: 'low',
  },
  'html-lang-valid': {
    ar: ['قيمة lang غير صالحة', 'استخدم رمز لغة BCP 47 صحيحًا'],
    en: ['The lang attribute value is not valid', 'Use a valid BCP 47 language code'],
    code: '<html lang="en">',
    effort: 'low',
  },
  'document-title': {
    ar: ['الصفحة بلا عنوان', 'أضف عنصر title يصف الصفحة'],
    en: ['The page has no title', 'Add a descriptive title element'],
    code: '<title>Campaign performance — Dashboard</title>',
    effort: 'low',
  },
  'frame-title': {
    ar: ['إطارات iframe بلا عنوان', 'أضف title يصف محتوى الإطار'],
    en: ['iframes have no title', 'Add a title describing the frame content'],
    code: '<iframe src="…" title="Embedded sales report"></iframe>',
    effort: 'low',
  },
  'input-image-alt': {
    ar: ['أزرار صور بلا نص بديل', 'أضف alt يصف فعل الزر'],
    en: ['Image buttons have no alt text', 'Add alt describing the button action'],
    code: '<input type="image" src="search.png" alt="Search">',
    effort: 'low',
  },
  'aria-required-attr': {
    ar: ['عناصر ARIA تنقصها خصائص مطلوبة', 'أضف خصائص ARIA التي يتطلبها الدور'],
    en: ['ARIA roles are missing required attributes', 'Add the attributes the role requires'],
    code: '<div role="slider" aria-valuenow="40" aria-valuemin="0" aria-valuemax="100" tabindex="0"></div>',
    effort: 'low',
  },
  'aria-valid-attr-value': {
    ar: ['قيم خصائص ARIA غير صالحة', 'صحح قيم الخصائص أو المعرفات التي تشير إليها'],
    en: ['ARIA attributes have invalid values', 'Fix the values or the ids they reference'],
    code: '<input aria-describedby="email-help">\n<p id="email-help">We never share your email.</p>',
    effort: 'low',
  },
  'aria-valid-attr': {
    ar: ['خصائص ARIA غير موجودة في المواصفة', 'أزل الخصائص غير الصحيحة أو صحح كتابتها'],
    en: ['ARIA attributes are not valid', 'Remove or correct misspelled ARIA attributes'],
    code: '<!-- aria-labeledby ✗ → aria-labelledby ✓ -->',
    effort: 'low',
  },
  'aria-allowed-attr': {
    ar: ['خصائص ARIA غير مسموحة لدور العنصر', 'أزل الخاصية أو غيّر الدور'],
    en: ['ARIA attributes are not allowed on the element’s role', 'Remove the attribute or change the role'],
    code: '',
    effort: 'low',
  },
  'aria-roles': {
    ar: ['أدوار ARIA غير صالحة', 'استخدم دورًا موجودًا في مواصفة WAI-ARIA'],
    en: ['ARIA roles are not valid', 'Use a role defined in WAI-ARIA'],
    code: '',
    effort: 'low',
  },
  'aria-hidden-focus': {
    ar: ['عناصر مخفية عن قارئ الشاشة لكنها قابلة للتركيز', 'أزل aria-hidden أو اجعل العناصر غير قابلة للتركيز'],
    en: ['aria-hidden elements contain focusable content', 'Remove aria-hidden or make the content unfocusable'],
    code: '<div aria-hidden="true">\n  <a href="#" tabindex="-1">…</a>\n</div>',
    effort: 'medium',
  },
  'aria-command-name': {
    ar: ['عناصر أوامر ARIA بلا اسم', 'أضف aria-label أو نصًا ظاهرًا'],
    en: ['ARIA command elements have no accessible name', 'Add an aria-label or visible text'],
    code: '<div role="button" tabindex="0" aria-label="Refresh data">⟳</div>',
    effort: 'low',
  },
  'aria-input-field-name': {
    ar: ['حقول ARIA بلا اسم', 'أضف aria-label أو aria-labelledby'],
    en: ['ARIA input fields have no accessible name', 'Add aria-label or aria-labelledby'],
    code: '<div role="combobox" aria-label="Choose metric" …></div>',
    effort: 'low',
  },
  'role-img-alt': {
    ar: ['عناصر role="img" بلا نص بديل', 'أضف aria-label يصف الصورة أو الرسم'],
    en: ['role="img" elements have no text alternative', 'Add an aria-label describing the image or chart'],
    code: '<div role="img" aria-label="Line chart: sessions rose from 1.2k to 3.4k in March">…</div>',
    effort: 'low',
  },
  'svg-img-alt': {
    ar: ['رسوم SVG ذات role="img" بلا نص بديل', 'أضف عنصر title أو aria-label'],
    en: ['SVG images have no text alternative', 'Add a title element or aria-label'],
    code: '<svg role="img" aria-labelledby="t1"><title id="t1">Conversion funnel</title>…</svg>',
    effort: 'low',
  },
  list: {
    ar: ['قوائم تحتوي عناصر غير li', 'اجعل الأبناء المباشرين للقائمة عناصر li فقط'],
    en: ['Lists contain elements other than li', 'Only li elements should be direct children of ul/ol'],
    code: '<ul>\n  <li>…</li>\n</ul>',
    effort: 'low',
  },
  listitem: {
    ar: ['عناصر li خارج قائمة', 'ضع عناصر li داخل ul أو ol'],
    en: ['li elements are not inside a list', 'Wrap li elements in ul or ol'],
    code: '<ul><li>…</li></ul>',
    effort: 'low',
  },
  'definition-list': {
    ar: ['قوائم تعريف غير صحيحة البنية', 'استخدم dt وdd داخل dl فقط'],
    en: ['Definition lists are not structured correctly', 'Use only dt and dd inside dl'],
    code: '',
    effort: 'low',
  },
  'duplicate-id-aria': {
    ar: ['معرفات مكررة مستخدمة في ARIA', 'اجعل كل id فريدًا'],
    en: ['Duplicate ids are referenced by ARIA', 'Make every id unique'],
    code: '',
    effort: 'low',
  },
  'meta-viewport': {
    ar: ['وسم viewport يمنع التكبير', 'أزل user-scalable=no و maximum-scale'],
    en: ['The viewport meta tag disables zoom', 'Remove user-scalable=no and maximum-scale'],
    code: '<meta name="viewport" content="width=device-width, initial-scale=1">',
    effort: 'low',
  },
  'meta-refresh': {
    ar: ['الصفحة تُحدّث أو تُحوّل تلقائيًا بمؤقت', 'أزل meta refresh واستخدم تحويلًا من الخادم'],
    en: ['The page refreshes or redirects on a timer', 'Remove meta refresh; redirect server-side'],
    code: '',
    effort: 'low',
  },
  bypass: {
    ar: ['لا توجد طريقة لتجاوز الكتل المتكررة', 'أضف رابط "انتقل إلى المحتوى" وعنصر main'],
    en: ['No way to bypass repeated blocks', 'Add a skip link and a main landmark'],
    code: '<a class="skip" href="#main">Skip to content</a>\n…\n<main id="main">…</main>',
    effort: 'low',
  },
  'nested-interactive': {
    ar: ['عناصر تفاعلية متداخلة', 'لا تضع زرًا أو رابطًا داخل عنصر تفاعلي آخر'],
    en: ['Interactive controls are nested', 'Do not put a button or link inside another interactive control'],
    code: '',
    effort: 'medium',
  },
  'scrollable-region-focusable': {
    ar: ['مناطق قابلة للتمرير لا يصلها التركيز', 'أضف tabindex="0" واسمًا للمنطقة'],
    en: ['Scrollable regions are not keyboard accessible', 'Add tabindex="0" and a name to the region'],
    code: '<div class="table-scroll" tabindex="0" role="region" aria-label="Campaign table">…</div>',
    effort: 'low',
  },
  'target-size': {
    ar: ['أهداف لمس أصغر من 24×24 بكسل', 'كبّر الهدف أو المسافة حوله إلى 24 بكسل على الأقل'],
    en: ['Touch targets are smaller than 24×24 px', 'Make targets (or their spacing) at least 24 px'],
    code: '.icon-btn { min-width: 24px; min-height: 24px; } /* 44px recommended */',
    effort: 'low',
  },
  'link-in-text-block': {
    ar: ['روابط داخل النص تتميز باللون فقط', 'أضف خطًا تحتيًا أو مؤشرًا غير اللون'],
    en: ['Links in text are distinguished by colour only', 'Underline links or add a non-colour cue'],
    code: 'p a { text-decoration: underline; }',
    effort: 'low',
  },
  'th-has-data-cells': {
    ar: ['رؤوس جداول لا تصف خلايا بيانات', 'صحح بنية الجدول وربط الرؤوس'],
    en: ['Table headers do not describe data cells', 'Fix the table structure and header associations'],
    code: '',
    effort: 'medium',
  },
  'td-headers-attr': {
    ar: ['خلايا تشير برؤوس غير موجودة', 'اجعل headers تشير إلى th في الجدول نفسه'],
    en: ['Cells reference headers that do not exist', 'Point headers to th cells in the same table'],
    code: '',
    effort: 'medium',
  },
  'autocomplete-valid': {
    ar: ['قيم autocomplete غير صالحة', 'استخدم قيم autocomplete القياسية'],
    en: ['autocomplete values are invalid', 'Use standard autocomplete tokens'],
    code: '<input type="email" autocomplete="email">',
    effort: 'low',
  },
  'video-caption': {
    ar: ['فيديو بلا ترجمة نصية', 'أضف track للترجمة'],
    en: ['Videos have no captions', 'Add a captions track'],
    code: '<video controls><track kind="captions" src="ar.vtt" srclang="ar" label="العربية"></video>',
    effort: 'high',
  },
  'valid-lang': {
    ar: ['قيم lang غير صالحة داخل الصفحة', 'استخدم رموز لغة صحيحة'],
    en: ['lang values inside the page are invalid', 'Use valid language codes'],
    code: '<span lang="en">Dashboard</span>',
    effort: 'low',
  },
};

export function axeText(id, lang) {
  const r = AXE_RULES[id];
  if (!r) return null;
  const [issue, fix] = r[lang === 'en' ? 'en' : 'ar'];
  return { issue, fix, code: r.code || '', effort: r.effort || 'medium' };
}
