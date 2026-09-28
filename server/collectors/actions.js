// تفسير خطوة مكتوبة إلى إجراء متصفح محدد.
// الصيغ المدعومة موثقة في واجهة الإدخال. أي خطوة لا تطابق صيغة معروفة
// تُسجَّل كخطوة تعذر تنفيذها بدل تخمين معناها.

const Q = `["«“'](.+?)["»”']`;

const PATTERNS = [
  { type: 'goto', re: /^(?:افتح|اذهب\s+إلى|انتقل\s+إلى|open|goto|go\s+to|visit)\s+(\S+)$/i, map: (m) => ({ target: m[1] }) },
  { type: 'fill', re: new RegExp(`^(?:اكتب|أدخل|ادخل)\\s+${Q}\\s+(?:في|فى|بـ?)\\s*${Q}$`, 'i'), map: (m) => ({ value: m[1], field: m[2] }) },
  { type: 'fill', re: new RegExp(`^(?:fill|type)\\s+${Q}\\s+(?:with|=)\\s*${Q}$`, 'i'), map: (m) => ({ field: m[1], value: m[2] }) },
  { type: 'select', re: new RegExp(`^(?:اختر)\\s+${Q}\\s+(?:من|في)\\s*${Q}$`, 'i'), map: (m) => ({ value: m[1], field: m[2] }) },
  { type: 'select', re: new RegExp(`^select\\s+${Q}\\s+(?:in|from)\\s*${Q}$`, 'i'), map: (m) => ({ value: m[1], field: m[2] }) },
  { type: 'check', re: new RegExp(`^(?:فعّل|فعل|حدد|check)\\s+${Q}$`, 'i'), map: (m) => ({ field: m[1] }) },
  { type: 'press', re: /^(?:اضغط\s+مفتاح|press)\s+([A-Za-z]+)$/i, map: (m) => ({ key: m[1] }) },
  { type: 'click', re: new RegExp(`^(?:اضغط(?:\\s+على)?|انقر(?:\\s+على)?|click)\\s+${Q}$`, 'i'), map: (m) => ({ text: m[1] }) },
  { type: 'wait_text', re: new RegExp(`^(?:انتظر(?:\\s+ظهور)?|wait\\s+for|wait)\\s+${Q}$`, 'i'), map: (m) => ({ text: m[1] }) },
  { type: 'wait_ms', re: /^(?:انتظر|wait)\s+(\d+(?:\.\d+)?)\s*(?:ثانية|ثوان|ثواني|s|sec|seconds?)$/i, map: (m) => ({ ms: Math.min(Number(m[1]) * 1000, 30000) }) },
  { type: 'expect', re: new RegExp(`^(?:تحقق(?:\\s+من)?(?:\\s+ظهور)?|تأكد(?:\\s+من)?(?:\\s+ظهور)?|expect|assert)\\s+${Q}$`, 'i'), map: (m) => ({ text: m[1] }) },
];

export function parseAction(text) {
  const t = text.trim();
  for (const p of PATTERNS) {
    const m = t.match(p.re);
    if (m) return { type: p.type, ...p.map(m) };
  }
  return null;
}

export function substitute(value, account) {
  return String(value)
    .replace(/\{\{\s*(username|user|email|اسم_المستخدم)\s*\}\}/gi, account.username || '')
    .replace(/\{\{\s*(password|pass|كلمة_المرور)\s*\}\}/gi, account.password || '');
}

function cssAttr(v) {
  return String(v).replace(/["\\]/g, '\\$&');
}

async function firstVisible(candidates, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const loc of candidates) {
      const n = await loc.count().catch(() => 0);
      for (let i = 0; i < Math.min(n, 5); i++) {
        const el = loc.nth(i);
        if (await el.isVisible().catch(() => false)) return el;
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

function fieldCandidates(page, field) {
  return [
    page.getByLabel(field, { exact: true }),
    page.getByPlaceholder(field, { exact: true }),
    page.locator(`[name="${cssAttr(field)}"], [id="${cssAttr(field)}"]`),
    page.getByLabel(field),
    page.getByPlaceholder(field),
  ];
}

export async function runAction(page, action, account, baseUrl, timeout) {
  switch (action.type) {
    case 'goto': {
      const target = new URL(substitute(action.target, account), baseUrl).toString();
      await page.goto(target, { waitUntil: 'domcontentloaded', timeout: timeout * 2 });
      return `فتح ${target}`;
    }
    case 'click': {
      const text = substitute(action.text, account);
      const el = await firstVisible(
        [
          page.getByRole('button', { name: text, exact: true }),
          page.getByRole('link', { name: text, exact: true }),
          page.getByRole('button', { name: text }),
          page.getByRole('link', { name: text }),
          page.getByRole('menuitem', { name: text }),
          page.getByRole('tab', { name: text }),
          page.locator(`input[type=submit][value="${cssAttr(text)}"], input[type=button][value="${cssAttr(text)}"]`),
          page.getByText(text, { exact: true }),
          page.getByText(text),
        ],
        timeout,
      );
      if (!el) throw new Error(`لم يُعثر على عنصر ظاهر قابل للضغط بالنص «${text}».`);
      await el.click({ timeout });
      return `ضغط «${text}»`;
    }
    case 'fill': {
      const el = await firstVisible(fieldCandidates(page, action.field), timeout);
      if (!el) throw new Error(`لم يُعثر على حقل ظاهر باسم أو تسمية «${action.field}».`);
      await el.fill(substitute(action.value, account), { timeout });
      const shown = /\{\{\s*(password|pass|كلمة_المرور)/i.test(action.value) ? '••••' : substitute(action.value, account);
      return `كتابة «${shown}» في «${action.field}»`;
    }
    case 'select': {
      const el = await firstVisible(fieldCandidates(page, action.field), timeout);
      if (!el) throw new Error(`لم يُعثر على قائمة ظاهرة باسم «${action.field}».`);
      const value = substitute(action.value, account);
      await el.selectOption({ label: value }, { timeout }).catch(() => el.selectOption(value, { timeout }));
      return `اختيار «${value}» من «${action.field}»`;
    }
    case 'check': {
      const el = await firstVisible(
        [page.getByLabel(action.field, { exact: true }), page.getByRole('checkbox', { name: action.field }), page.getByLabel(action.field)],
        timeout,
      );
      if (!el) throw new Error(`لم يُعثر على خانة اختيار باسم «${action.field}».`);
      await el.check({ timeout });
      return `تفعيل «${action.field}»`;
    }
    case 'press':
      await page.keyboard.press(action.key);
      return `ضغط مفتاح ${action.key}`;
    case 'wait_ms':
      await page.waitForTimeout(action.ms);
      return `انتظار ${action.ms / 1000} ثانية`;
    case 'wait_text':
    case 'expect': {
      const text = substitute(action.text, account);
      const el = await firstVisible([page.getByText(text, { exact: false })], timeout);
      if (!el) throw new Error(`النص «${text}» لم يظهر في الصفحة خلال ${Math.round(timeout / 1000)} ثوانٍ.`);
      return `ظهور «${text}»`;
    }
    default:
      throw new Error('نوع إجراء غير معروف.');
  }
}
