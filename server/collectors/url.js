import { chromium } from 'playwright';
import { config } from '../config.js';
import { parseAction, runAction } from './actions.js';

const SKIP_TYPES = new Set(['image', 'font', 'stylesheet', 'media']);
const MAX_TEXT = 4000;
const MAX_POST = 800;

// يُنفَّذ داخل الصفحة: يجمع النص الظاهر والأزرار ورسائل الخطأ وملاحظات الوصول.
function snapshotInPage(maxText) {
  const visible = (el) => {
    const s = window.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  };
  const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();
  const nameOf = (el) =>
    clean(el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('title') || '');

  const buttons = [];
  document
    .querySelectorAll('button, [role=button], input[type=submit], input[type=button], a[href]')
    .forEach((el) => {
      if (!visible(el) || buttons.length >= 60) return;
      buttons.push({
        kind: el.tagName === 'A' ? 'link' : 'button',
        text: nameOf(el).slice(0, 80),
        disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      });
    });

  const errors = new Set();
  document
    .querySelectorAll('[role=alert], [aria-live=assertive], [aria-live=polite], .error, .errors, .invalid-feedback, .field-error, .alert-danger, [class*="error" i], [data-error]')
    .forEach((el) => {
      if (!visible(el)) return;
      const t = clean(el.innerText);
      if (t && t.length < 400) errors.add(t);
    });
  const invalidFields = [];
  document.querySelectorAll('[aria-invalid=true], :invalid').forEach((el) => {
    if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || !visible(el)) return;
    invalidFields.push({ name: el.name || el.id || '', message: el.validationMessage || '' });
  });

  const labelFor = (el) => {
    if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return true;
    if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return true;
    return Boolean(el.closest('label'));
  };
  const a11y = { unlabeled_fields: [], images_without_alt: 0, unnamed_buttons: 0 };
  document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea').forEach((el) => {
    if (visible(el) && !labelFor(el) && a11y.unlabeled_fields.length < 20)
      a11y.unlabeled_fields.push(el.name || el.id || el.getAttribute('placeholder') || el.type);
  });
  document.querySelectorAll('img').forEach((el) => {
    if (visible(el) && !el.hasAttribute('alt')) a11y.images_without_alt++;
  });
  document.querySelectorAll('button, [role=button]').forEach((el) => {
    if (visible(el) && !nameOf(el)) a11y.unnamed_buttons++;
  });

  let dataLayer = [];
  try {
    if (Array.isArray(window.dataLayer)) dataLayer = JSON.parse(JSON.stringify(window.dataLayer.slice(-50)));
  } catch {}

  const text = clean(document.body ? document.body.innerText : '');
  return {
    url: location.href,
    title: document.title,
    lang: document.documentElement.lang || '',
    visible_text: text.slice(0, maxText),
    visible_text_truncated: text.length > maxText,
    buttons,
    error_messages: [...errors].slice(0, 20),
    invalid_fields: invalidFields.slice(0, 20),
    accessibility: a11y,
    data_layer: dataLayer,
  };
}

export async function collectFromUrl(input, onProgress = () => {}) {
  const browser = await chromium.launch({ headless: config.headless, executablePath: config.chromiumPath });
  let current = 0; // رقم الخطوة الجاري جمع أحداثها (0 = التحميل الأول)
  const network = new Map();
  const consoleErrors = new Map();
  const push = (map, key, v) => (map.get(key) || map.set(key, []).get(key)).push(v);

  let context;
  try {
    context = await browser.newContext({ locale: 'ar', viewport: { width: 1366, height: 900 }, ignoreHTTPSErrors: true });
  } catch (e) {
    await browser.close().catch(() => {});
    throw e;
  }
  // التقاط استدعاءات dataLayer.push (ومنها gtag) لحظة حدوثها، لأنها تضيع عند الانتقال بين الصفحات
  const trackerCalls = new Map();
  await context.exposeBinding('__qaTrack', (src, kind, payload) => {
    push(trackerCalls, current, { kind, payload: String(payload).slice(0, MAX_POST) });
  });
  await context.addInitScript(() => {
    const send = (kind, v) => {
      try {
        window.__qaTrack(kind, JSON.stringify(v));
      } catch {}
    };
    const hook = (arr) => {
      if (!Array.isArray(arr) || arr.__qaHooked) return arr;
      const orig = arr.push.bind(arr);
      arr.push = (...items) => {
        send('dataLayer.push', items.length === 1 ? items[0] : items);
        return orig(...items);
      };
      Object.defineProperty(arr, '__qaHooked', { value: true });
      arr.forEach((item) => send('dataLayer.initial', item));
      return arr;
    };
    let dl = hook(window.dataLayer);
    Object.defineProperty(window, 'dataLayer', {
      configurable: true,
      get: () => dl,
      set: (v) => {
        dl = hook(v);
      },
    });
  });
  const page = await context.newPage();

  page.on('requestfinished', async (req) => {
    if (SKIP_TYPES.has(req.resourceType())) return;
    const stepNo = current;
    const res = await req.response().catch(() => null);
    const status = res ? res.status() : null;
    push(network, stepNo, {
      method: req.method(),
      url: req.url().slice(0, 400),
      type: req.resourceType(),
      status,
      post_data: (req.postData() || '').slice(0, MAX_POST) || undefined,
    });
  });
  page.on('requestfailed', (req) => {
    push(network, current, {
      method: req.method(),
      url: req.url().slice(0, 400),
      type: req.resourceType(),
      status: null,
      failure: req.failure()?.errorText || 'failed',
      post_data: (req.postData() || '').slice(0, MAX_POST) || undefined,
    });
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') push(consoleErrors, current, msg.text().slice(0, 300));
  });
  page.on('pageerror', (err) => push(consoleErrors, current, String(err.message || err).slice(0, 300)));

  const steps = [];
  let stoppedAt = null;
  const timeout = config.stepTimeoutMs;

  const settle = async () => {
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);
  };
  const snapshot = async () => {
    try {
      return await page.evaluate(snapshotInPage, MAX_TEXT);
    } catch (e) {
      return { url: page.url(), snapshot_error: String(e.message || e) };
    }
  };

  try {
    onProgress('فتح الموقع');
    let initialError = null;
    try {
      await page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: timeout * 3 });
      await settle();
    } catch (e) {
      initialError = String(e.message || e).split('\n')[0];
    }
    steps.push({
      number: 0,
      text: `فتح الرابط ${input.url}`,
      status: initialError ? 'failed' : 'done',
      action_result: initialError ? null : 'تم تحميل الصفحة',
      error: initialError,
      page: await snapshot(),
    });
    if (initialError) stoppedAt = 0;

    for (const step of input.steps) {
      if (stoppedAt !== null) {
        steps.push({ number: step.number, text: step.text, status: 'not_run' });
        continue;
      }
      current = step.number;
      onProgress(`تنفيذ الخطوة ${step.number} من ${input.steps.length}`);
      const action = parseAction(step.text);
      const record = { number: step.number, text: step.text, action: action ? action.type : null };
      if (!action) {
        record.status = 'failed';
        record.error = 'صيغة الخطوة غير مدعومة في وضع الأتمتة، فلم تُنفذ. راجع الصيغ المدعومة في صفحة الإدخال.';
      } else {
        try {
          record.action_result = await runAction(page, action, input.account, page.url() || input.url, timeout);
          record.status = 'done';
        } catch (e) {
          record.status = 'failed';
          record.error = String(e.message || e).split('\n')[0];
        }
      }
      await settle();
      record.page = await snapshot();
      steps.push(record);
      if (record.status === 'failed') stoppedAt = step.number;
    }
  } finally {
    await browser.close().catch(() => {});
  }

  for (const s of steps) {
    s.network = network.get(s.number) || [];
    s.console_errors = consoleErrors.get(s.number) || [];
    s.tracking_calls = trackerCalls.get(s.number) || [];
  }

  return {
    source: 'url',
    target_url: input.url,
    steps,
    all_steps_executed: stoppedAt === null,
    stopped_at_step: stoppedAt,
  };
}
