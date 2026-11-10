import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction } from '../server/collectors/actions.js';
import { parseAnalyticsEvents, parseSteps } from '../server/input.js';
import { validateFindings, computeScores } from '../server/analyzer.js';
import { metricScore, performanceScore, scFromAxeTag, wcag } from '../server/standards.js';
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
const base = { category: 'usability', standard: 'Nielsen heuristic #9', severity: 'high', step: 1, evidence_source: 'file:a.har', evidence: 'دليل', impact: 'أثر', recommendation: 'توصية', confidence: 'high', effort: 'low' };

test('validateFindings يستبعد ما لا يرتبط بدليل ويزيل التكرار', () => {
  const { findings, rejected } = validateFindings(
    [base, { ...base }, { ...base, evidence_source: 'file:missing.png' }, { ...base, step: 9 }, { ...base, category: 'SEO' }, { ...base, evidence: 'x2', standard: '' }],
    collected,
    input,
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].journey, 'رحلة');
  assert.equal(rejected.length, 4);
});

test('الدرجات: الفئات من 100، والأداء من المقاييس، وغير المُقيّم خارج المتوسط', () => {
  const findings = [
    { ...base, category: 'accessibility', severity: 'critical', confidence: 'high' },
    { ...base, category: 'accessibility', severity: 'medium', confidence: 'medium' },
    { ...base, category: 'usability', severity: 'high', confidence: 'high' },
  ];
  const s = computeScores(findings, new Set(['usability', 'accessibility', 'performance']), { lcp: 2000, cls: 0.05, tbt: 100, fcp: 1500, ttfb: 500 });
  assert.equal(s.categories.accessibility.score, 70);
  assert.equal(s.categories.usability.score, 85);
  assert.equal(s.categories.performance.score, 100);
  assert.equal(s.categories.data_visualization.score, null);
  assert.equal(s.overall, 85);
});

test('معايير: وسوم axe وعتبات Core Web Vitals', () => {
  assert.equal(scFromAxeTag('wcag1410'), '1.4.10');
  assert.equal(scFromAxeTag('wcag2411'), '2.4.11');
  assert.equal(scFromAxeTag('wcag2aa'), null);
  assert.equal(wcag('1.4.3'), 'WCAG 2.2 SC 1.4.3 Contrast (Minimum) (AA)');
  assert.equal(metricScore('lcp', 2500), 100);
  assert.equal(metricScore('lcp', 4000), 50);
  assert.equal(metricScore('cls', 0.5), 0);
  assert.equal(performanceScore({ lcp: 4000, cls: 0.1, tbt: 200, fcp: 1800, ttfb: 800 }), 88);
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

test('القواعد: الرحلة والتدقيق يُنتجان ملاحظات بمعايير محددة', async () => {
  const { ruleFindings } = await import('../server/rules.js');
  const input = { lang: 'en', journey: 'J', steps: [{ number: 1, text: 'open pricing' }], expected_features: [] };
  const page = { url: 'https://s.test/', error_messages: [] };
  const collected = {
    source: 'url',
    target_url: 'https://s.test/',
    steps: [
      { number: 0, status: 'done', page, network: [{ method: 'POST', url: 'https://s.test/api/orders', status: 500 }], console_errors: [] },
      { number: 1, auto: true, kind: 'link', link: { text: 'Pricing', path: '/pricing' }, http_status: 404, text: 'open pricing', status: 'failed', error: 'x', page, network: [], console_errors: [] },
    ],
    audit: {
      errors: [],
      pages: [
        {
          step: 0,
          url: 'https://s.test/',
          axe: { violations: [{ id: 'color-contrast', impact: 'serious', help: 'h', help_url: 'u', tags: ['wcag2aa', 'wcag143'], count: 3, nodes: [{ target: '.muted', html: '' }] }], incomplete: [] },
          seo: { title: 'Home', description: null, robots: null, canonical: 'x', viewport: 'width=device-width', lang: 'en', og_title: 't', h1_count: 1, heading_skips: [], has_main: true, vague_links: [] },
          charts: [{ selector: 'canvas#c', name: '', has_alternative: false, library: 'Chart.js', type: 'bar', series: 2, points: 3, y_min: 40, x_title: true, y_title: true, legend: true, colors: [[214, 39, 40, 1], [44, 160, 44, 1]] }],
          tables: [],
          dom_nodes: 100,
          libs: { jquery: '1.12.4' },
          inline_secrets: [],
          password_forms: [],
          consent_banner: false,
          background: 'rgb(255, 255, 255)',
        },
      ],
      keyboard: { focusable: 5, tabbed: 5, no_indicator: ['button.go'], hidden_focus: [], obscured: [], trap: null, skip_link: false },
      performance: {
        url: 'https://s.test/',
        dpr: 1.75,
        conditions: 'mobile',
        metrics: { lcp: 5200, cls: 0.02, tbt: 150, fcp: 1500, ttfb: 300, render_blocking: [], lcp_element: null },
        resources: [{ url: 'https://www.google-analytics.com/g/collect?x', type: 'Fetch', status: 200, bytes: 100, headers: {} }],
        images: [],
      },
      responsive: [{ viewport: 'reflow-320', width: 320, scroll_width: 600, overflow: true, overflow_elements: ['div.wide (600px)'], small_text_ratio: 0, small_targets: 0, small_target_examples: [], viewport_meta: 'x' }],
      security: { url: 'https://s.test/', final_url: 'https://s.test/', https: true, http_redirects_to_https: true, headers: { 'strict-transport-security': 'x', 'content-security-policy': "frame-ancestors 'self'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'x', 'permissions-policy': 'x' }, cookies: [] },
    },
  };
  const { findings, assessed } = ruleFindings(input, collected);
  const rules = new Set(findings.map((f) => f.rule));
  for (const r of ['server_error', 'broken_link', 'axe:color-contrast', 'focus_not_visible', 'lcp', 'bar_baseline', 'cvd_palette', 'chart_no_name', 'reflow', 'vuln_lib', 'consent_missing', 'no_description'])
    assert.ok(rules.has(r), `missing ${r}`);
  assert.ok(findings.every((f) => f.standard && f.category && f.evidence && f.effort));
  assert.equal(findings.find((f) => f.rule === 'axe:color-contrast').standard, 'WCAG 2.2 SC 1.4.3 Contrast (Minimum) (AA)');
  assert.equal(findings.find((f) => f.rule === 'server_error').severity, 'critical');
  for (const c of ['accessibility', 'performance', 'data_visualization', 'responsive', 'security_privacy', 'seo_content']) assert.ok(assessed.has(c), c);
});
