import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction } from '../server/collectors/actions.js';
import { parseAnalyticsEvents, parseSteps } from '../server/input.js';
import { validateFindings, computeScore } from '../server/analyzer.js';
import { checkAnalytics, deterministicAnalytics } from '../server/analytics.js';
import { reportFilename } from '../server/report/pdf.js';

test('parseAction يفهم الصيغ المدعومة ويرفض غيرها', () => {
  assert.deepEqual(parseAction('اضغط «تسجيل الدخول»'), { type: 'click', text: 'تسجيل الدخول' });
  assert.deepEqual(parseAction('اكتب «{{username}}» في «البريد»'), { type: 'fill', value: '{{username}}', field: 'البريد' });
  assert.deepEqual(parseAction('افتح /login'), { type: 'goto', target: '/login' });
  assert.equal(parseAction('انتظر 2 ثانية').type, 'wait_ms');
  assert.equal(parseAction('تحقق من ظهور "رقم الطلب"').type, 'expect');
  assert.equal(parseAction('املأ النموذج'), null);
});

test('parseSteps و parseAnalyticsEvents', () => {
  assert.deepEqual(parseSteps('1. أولى\n\n2) ثانية').map((s) => s.text), ['أولى', 'ثانية']);
  assert.deepEqual(parseAnalyticsEvents('sign_up — عند التسجيل\npurchase\nsign_up'), [
    { event_name: 'sign_up', when: 'عند التسجيل' },
    { event_name: 'purchase', when: '' },
  ]);
});

const collected = { source: 'file', files: [{ file: 'a.har', kind: 'network', har: { requests: [{ url: 'https://x/collect?en=view_item', post_data: '' }] } }] };
const input = { journey: 'رحلة', steps: [{ number: 1, text: 'x' }, { number: 2, text: 'y' }] };
const base = { criterion: 'UX', severity: 'high', step: 1, evidence_source: 'file:a.har', evidence: 'دليل', impact: 'أثر', recommendation: 'توصية', confidence: 'high' };

test('validateFindings يستبعد ما لا يرتبط بدليل ويزيل التكرار', () => {
  const { findings, rejected } = validateFindings(
    [base, { ...base }, { ...base, evidence_source: 'file:missing.png' }, { ...base, step: 9 }, { ...base, criterion: 'SEO' }],
    collected,
    input,
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].journey, 'رحلة');
  assert.equal(rejected.length, 3);
});

test('computeScore يحتسب الملاحظات عالية الثقة فقط', () => {
  const s = computeScore([
    { ...base, severity: 'high', confidence: 'high' },
    { ...base, severity: 'medium', confidence: 'high' },
    { ...base, severity: 'high', confidence: 'medium' },
  ]);
  assert.equal(s.score, 2.8);
  assert.equal(s.counted_findings, 2);
});

test('فحص التحليلات: الظاهر لا يُعد ناقصًا، ومسار الرابط ليس دليلًا', () => {
  const checks = checkAnalytics([{ event_name: 'view_item', when: '' }, { event_name: 'collect', when: '' }, { event_name: 'purchase', when: '' }], collected);
  assert.deepEqual(checks.map((c) => c.observed), [true, false, false]);
  const { missing } = deterministicAnalytics(checks, collected);
  assert.deepEqual(missing.map((m) => m.event_name), ['collect', 'purchase']);
  const noNet = deterministicAnalytics(checks, { source: 'file', files: [{ file: 'n.md', kind: 'text', type: 'md', content: { text: '' } }] });
  assert.equal(noNet.missing.length, 0);
  assert.equal(noNet.insufficient.length, 2);
});

test('اسم ملف التقرير', () => {
  assert.equal(reportFilename({ product_name: 'متجر نخيل', meta: { created_at: '2026-09-28T10:00:00Z' } }), 'Quality-Report-متجر-نخيل-2026-09-28.pdf');
});

test('وضع الرابط يكفيه الرابط وحده', async () => {
  const { normalizeInput, validateInput, completeUrlInput } = await import('../server/input.js');
  const input = normalizeInput({ source: 'url', url: 'https://staging.example.test/' });
  assert.deepEqual(validateInput(input, 0), []);
  completeUrlInput(input, { auto_explored: true, discovered_title: 'متجر', steps: [{ number: 0, text: 'x' }, { number: 1, text: 'افتح «من نحن»' }] });
  assert.equal(input.product_name, 'متجر');
  assert.equal(input.journey, 'استكشاف تلقائي للموقع');
  assert.deepEqual(input.steps, [{ number: 1, text: 'افتح «من نحن»' }]);
  assert.ok(validateInput(normalizeInput({ source: 'file' }), 0).length >= 4);
});

test('القواعد الآلية تُنتج ملاحظات مرتبطة بالدليل فقط', async () => {
  const { ruleFindings } = await import('../server/rules.js');
  const input = { journey: 'استكشاف', steps: [{ number: 1, text: 'افتح «الأسعار» (/pricing)' }], expected_features: [] };
  const page = { url: 'https://s.test/', lang: 'ar', error_messages: [], accessibility: { unlabeled_fields: ['phone'], images_without_alt: 0, unnamed_buttons: 0 } };
  const collected = {
    source: 'url',
    target_url: 'https://s.test/',
    steps: [
      { number: 0, status: 'done', page, network: [{ method: 'POST', url: 'https://s.test/api/orders', status: 500 }], console_errors: [] },
      { number: 1, auto: true, kind: 'link', link: { text: 'الأسعار', path: '/pricing' }, http_status: 404, text: 'افتح «الأسعار» (/pricing)', status: 'failed', error: 'الصفحة /pricing أعادت الحالة 404.', page, network: [], console_errors: [] },
    ],
  };
  const { findings } = ruleFindings(input, collected);
  const rules = findings.map((f) => f.rule).sort();
  assert.deepEqual(rules, ['broken_link', 'server_error', 'unlabeled_fields']);
  assert.ok(findings.every((f) => f.evidence && f.evidence_source.startsWith('step:') && f.origin === 'rule'));
  assert.equal(findings.find((f) => f.rule === 'server_error').severity, 'high');
});

test('القواعد تكتب بلغة التحليل', async () => {
  const { ruleFindings } = await import('../server/rules.js');
  const page = { url: 'https://s.test/', lang: '', error_messages: [], accessibility: { unlabeled_fields: [], images_without_alt: 2, unnamed_buttons: 0 } };
  const collected = { source: 'url', target_url: 'https://s.test/', steps: [{ number: 0, status: 'done', page, network: [], console_errors: [] }] };
  const { findings } = ruleFindings({ lang: 'en', journey: 'J', steps: [], expected_features: [] }, collected);
  assert.equal(findings.find((f) => f.rule === 'images_without_alt').evidence, '2 image(s) without an alt attribute.');
  assert.ok(findings.some((f) => f.rule === 'missing_lang'));
});
