// تحويل حقول النموذج النصية إلى بنية مرتبة يستخدمها الجامع والمحلل.

function lines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

// يزيل الترقيم في بداية السطر: "1. " أو "1) " أو "- " أو "• "
function stripBullet(line) {
  return line.replace(/^\s*(?:[-*•]|\d+[.)\-:]|[٠-٩]+[.)\-:])\s*/, '').trim();
}

export function parseSteps(text) {
  return lines(text).map((l, i) => ({ number: i + 1, text: stripBullet(l) }));
}

export function parseList(text) {
  return lines(text).map(stripBullet).filter(Boolean);
}

// سطر الحدث: "event_name — متى يُطلق" أو "event_name: متى" أو "event_name"
export function parseAnalyticsEvents(text) {
  const seen = new Set();
  const out = [];
  for (const raw of parseList(text)) {
    const m = raw.match(/^([^\s:—–|,]+)\s*(?:[:—–|,-]\s*(.*))?$/);
    const name = (m ? m[1] : raw).trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ event_name: name, when: (m && m[2] ? m[2] : '').trim() });
  }
  return out;
}

export function normalizeInput(body) {
  const source = body.source === 'url' ? 'url' : 'file';
  const input = {
    source,
    product_name: String(body.product_name || '').trim(),
    journey: String(body.journey || '').trim(),
    steps: parseSteps(body.steps),
    success_condition: String(body.success_condition || '').trim(),
    expected_features: parseList(body.expected_features),
    expected_events: parseAnalyticsEvents(body.expected_events),
    url: String(body.url || '').trim(),
    account: {
      username: String(body.test_username || '').trim(),
      password: String(body.test_password || ''),
    },
  };
  return input;
}

export function validateInput(input, fileCount) {
  const errors = [];
  if (input.source === 'url') {
    // في وضع الرابط يكفي الرابط؛ باقي الحقول اختيارية وتُكمل تلقائيًا بعد الاستكشاف
    try {
      const u = new URL(input.url);
      if (!/^https?:$/.test(u.protocol)) throw new Error();
    } catch {
      errors.push('رابط الموقع غير صالح. استخدم رابطًا يبدأ بـ http أو https.');
    }
    return errors;
  }
  if (!input.product_name) errors.push('اسم المنتج مطلوب.');
  if (!input.journey) errors.push('اسم الرحلة مطلوب.');
  if (!input.steps.length) errors.push('اكتب خطوة واحدة على الأقل للرحلة.');
  if (!input.success_condition) errors.push('شرط النجاح مطلوب.');
  if (!fileCount) errors.push('أرفق ملف دليل واحدًا على الأقل.');
  return errors;
}

// يُكمل الحقول الفارغة في وضع الرابط من الدليل المجموع، ويجعل الخطوات المستكشفة خطوات الرحلة
export function completeUrlInput(input, collected) {
  if (!input.product_name) {
    let host = input.url;
    try {
      host = new URL(input.url).hostname;
    } catch {}
    input.product_name = collected.discovered_title || host;
  }
  if (collected.auto_explored) {
    if (!input.journey) input.journey = 'استكشاف تلقائي للموقع';
    input.steps = collected.steps.filter((s) => s.number > 0).map((s) => ({ number: s.number, text: s.text }));
  }
  if (!input.journey) input.journey = 'رحلة بدون اسم';
  return input;
}
