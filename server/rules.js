// محرك القواعد: يحوّل الدليل المجموع إلى ملاحظات مصنفة حسب المعايير.
// كل ملاحظة مشتقة من عنصر محدد في الدليل، وتحمل: الفئة، المعيار المخالَف، المكان، الشدة،
// الجهد التقديري، الإصلاح ومثال كود. ما لا يمكن التحقق منه يذهب إلى insufficient_evidence مع طريقة اختباره.
import { at } from './audit-text.js';
import { axeText } from './axe-rules.js';
import { wcag, nielsen, scFromAxeTag, METRICS, rateMetric, SEVERITY_RANK } from './standards.js';
import { list as tlist } from './i18n.js';

const ASSET_RE = /\.(ico|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|css|map)(\?|$)/i;
const ISO_EFF = 'ISO 9241-11:2018 — Effectiveness';

function sameOrigin(a, b) {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}
function siteOf(u) {
  try {
    return new URL(u).hostname.split('.').slice(-2).join('.');
  } catch {
    return '';
  }
}
function pathOf(u) {
  try {
    const x = new URL(u);
    return x.pathname + x.search;
  } catch {
    return String(u);
  }
}
const short = (u, n = 70) => {
  const s = pathOf(u);
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
};
const kb = (b) => Math.round(b / 1024);
const mb = (b) => Math.round((b / (1024 * 1024)) * 100) / 100;

// ---------- أدوات الألوان (WCAG + محاكاة عمى الألوان) ----------
const lin = (c) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
// مصفوفات Machado et al. (2009) بشدة 1.0 في فضاء RGB الخطي
const CVD = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
function toLab(linRgb) {
  const [r, g, b] = linRgb.map((v) => Math.min(1, Math.max(0, v)));
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  [x, y, z] = [f(x), f(y), f(z)];
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const deltaE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function simulate(rgb, m) {
  const l = rgb.slice(0, 3).map(lin);
  return m.map((row) => row[0] * l[0] + row[1] * l[1] + row[2] * l[2]);
}
const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
function parseRgb(s) {
  const m = String(s || '').match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
  return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null;
}

// ---------- بناء الملاحظة ----------
function make(ctx, f) {
  return {
    journey: ctx.input.journey,
    category: f.category,
    criterion: f.category,
    title: f.title,
    standard: f.standard,
    severity: f.severity,
    confidence: f.confidence || 'high',
    effort: f.effort || 'medium',
    step: f.step ?? 0,
    evidence_source: f.source || `step:${f.step ?? 0}`,
    evidence: f.evidence,
    where: f.where || '',
    impact: f.impact,
    recommendation: f.fix,
    code: f.code || '',
    recommendation_status: 'pending_human_review',
    origin: 'rule',
    rule: f.rule,
  };
}
// ملاحظة من نص جاهز في audit-text
function std(ctx, rule, base, params = {}, impactKey = 'i') {
  const tx = at(ctx.lang, rule);
  return make(ctx, {
    rule,
    title: tx.t,
    evidence: tx.e(params),
    impact: typeof tx[impactKey] === 'function' ? tx[impactKey](params) : tx[impactKey],
    fix: tx.r,
    ...base,
  });
}

// ---------- قابلية الاستخدام: الرحلة ----------
function journeyRules(ctx, collected, out, insufficient) {
  const L = ctx.lang;
  const base = collected.target_url;
  const seenErrors = new Set();
  for (const s of collected.steps) {
    const at0 = { step: s.number, source: `step:${s.number}`, where: (s.page && s.page.url) || '' };
    if (s.status === 'failed') {
      if (s.number === 0) {
        out.push(std(ctx, 'site_unreachable', { ...at0, category: 'usability', standard: ISO_EFF, severity: 'critical', effort: 'medium' }, { err: s.error }));
      } else if (s.auto && s.http_status) {
        const code = s.http_status;
        const q = L === 'en' ? ['“', '”'] : ['«', '»'];
        out.push(
          std(ctx, 'broken_link', { ...at0, category: 'usability', standard: `${ISO_EFF} · ${nielsen(4)}`, severity: code >= 500 ? 'high' : 'medium', effort: 'low', where: s.link ? s.link.path : '' }, {
            link: s.link ? `${q[0]}${s.link.text}${q[1]} (${s.link.path})` : s.text,
            code,
          }),
        );
      } else if (s.auto) {
        out.push(std(ctx, 'auto_failed', { ...at0, category: 'usability', standard: ISO_EFF, severity: s.kind === 'login' ? 'high' : 'medium', confidence: 'medium', effort: 'medium' }, { step: s.text, err: s.error }));
      } else if (s.error_code === 'unsupported' || !s.action) {
        insufficient.push((L === 'en' ? `Step ${s.number} “${s.text}” uses a format the browser automation cannot run, so the journey stopped there without judging the product.` : `الخطوة ${s.number} «${s.text}» مكتوبة بصيغة لا ينفذها المتصفح الآلي، فتوقفت الرحلة عندها دون حكم على المنتج.`));
      } else {
        out.push(
          std(ctx, 'step_failed', { ...at0, category: 'usability', standard: `${ISO_EFF} · ${nielsen(9)}`, severity: 'critical', confidence: s.error_code === 'not_found' ? 'medium' : 'high', effort: 'medium' }, { step: s.text, err: s.error }),
        );
      }
    }

    const reqs = (s.network || []).filter((n) => sameOrigin(n.url, base) && !ASSET_RE.test(n.url) && n.status && !(s.status === 'failed' && n.type === 'document'));
    const fmt = (r) => `${r.method} ${short(r.url, 50)} → ${r.status}`;
    const serverErr = reqs.filter((r) => r.status >= 500);
    const clientErr = reqs.filter((r) => r.status >= 400 && r.status < 500 && r.status !== 401 && r.status !== 403);
    if (serverErr.length) {
      const writes = serverErr.some((r) => r.method !== 'GET');
      out.push(
        std(ctx, 'server_error', { ...at0, category: 'usability', standard: `${ISO_EFF} · ${nielsen(9)}`, severity: writes ? 'critical' : 'high', effort: 'medium', where: serverErr.map((r) => short(r.url, 50)).join(', ') }, { list: tlist(L, serverErr.map(fmt), 4) }, writes ? 'iw' : 'ir'),
      );
    }
    if (clientErr.length)
      out.push(std(ctx, 'client_error', { ...at0, category: 'usability', standard: ISO_EFF, severity: 'medium', confidence: 'medium', effort: 'medium', where: clientErr.map((r) => short(r.url, 50)).join(', ') }, { list: tlist(L, clientErr.map(fmt), 4) }));

    const errs = ((s.page && s.page.error_messages) || []).filter((m) => !seenErrors.has(m));
    errs.forEach((m) => seenErrors.add(m));
    if (errs.length && !(s.auto && s.status === 'failed'))
      out.push(std(ctx, 'visible_error', { ...at0, category: 'usability', standard: `${nielsen(9)} · ${wcag('3.3.1')}`, severity: 'medium', confidence: 'medium', effort: 'low' }, { list: tlist(L, errs, 3) }));

    const js = (s.console_errors || []).filter((m) => !/Failed to load resource/i.test(m));
    if (js.length)
      out.push(std(ctx, 'js_errors', { ...at0, category: 'usability', standard: nielsen(5), severity: 'low', confidence: 'medium', effort: 'medium' }, { list: tlist(L, js.map((m) => (L === 'en' ? `“${m.slice(0, 100)}”` : `«${m.slice(0, 100)}»`)), 3) }));
  }
  insufficient.push(at(L, 'ins_satisfaction'));
  if (!ctx.modelUsed) insufficient.push(at(L, 'ins_heuristics'));
}

// تجميع ملاحظة تتكرر عبر الصفحات في ملاحظة واحدة
function groupByRule(items) {
  const m = new Map();
  for (const it of items) (m.get(it.key) || m.set(it.key, []).get(it.key)).push(it);
  return [...m.values()];
}

// ---------- إمكانية الوصول (axe + لوحة المفاتيح + الجداول + الرسوم) ----------
function accessibilityRules(ctx, audit, out, insufficient) {
  const L = ctx.lang;
  const pages = audit.pages.filter((p) => p.axe);
  const items = [];
  for (const p of pages) for (const v of p.axe.violations) items.push({ key: v.id, v, page: p });
  for (const group of groupByRule(items)) {
    const { v } = group[0];
    const firstPage = group[0].page;
    const count = group.reduce((s, g) => s + g.v.count, 0);
    const scs = [...new Set(v.tags.map(scFromAxeTag).filter(Boolean))];
    const tx = axeText(v.id, L);
    const sevMap = { critical: 'critical', serious: 'high', moderate: 'medium', minor: 'low' };
    const targets = [...new Set(group.flatMap((g) => g.v.nodes.map((n) => n.target)))].slice(0, 4);
    out.push(
      make(ctx, {
        rule: `axe:${v.id}`,
        category: 'accessibility',
        title: tx ? tx.issue : v.help,
        standard: scs.length ? scs.map(wcag).join(' · ') : `WCAG 2.2 (axe ${v.id})`,
        severity: sevMap[v.impact] || 'medium',
        confidence: 'high',
        effort: tx ? tx.effort : 'medium',
        step: firstPage.step,
        source: `step:${firstPage.step}`,
        evidence: at(L, 'axe').e({ count, pages: new Set(group.map((g) => g.page.url)).size, targets: targets.join(' | ') }),
        where: [...new Set(group.map((g) => short(g.page.url, 60)))].slice(0, 3).join(', '),
        impact: at(L, 'axe').i({ impact: v.impact }),
        fix: tx ? tx.fix : `${v.help} — ${v.help_url}`,
        code: tx ? tx.code : '',
      }),
    );
  }
  const incomplete = [...new Set(pages.flatMap((p) => p.axe.incomplete.map((i) => i.id)))];
  if (incomplete.length) insufficient.push(at(L, 'ins_axe_incomplete')({ n: incomplete.length, list: incomplete.slice(0, 5).join(', ') }));

  const kb = audit.keyboard;
  if (kb) {
    const src = { step: 0, source: 'step:0', where: ctx.collected.target_url };
    if (kb.focusable > 0 && kb.tabbed === 0)
      out.push(std(ctx, 'no_keyboard', { ...src, category: 'accessibility', standard: wcag('2.1.1'), severity: 'critical', effort: 'high', code: '<button type="button" onclick="…">Filter</button>' }, { n: kb.focusable }));
    if (kb.trap) out.push(std(ctx, 'keyboard_trap', { ...src, category: 'accessibility', standard: wcag('2.1.2'), severity: 'critical', effort: 'medium', where: kb.trap }, { sel: kb.trap }));
    if (kb.no_indicator.length)
      out.push(
        std(ctx, 'focus_not_visible', { ...src, category: 'accessibility', standard: wcag('2.4.7'), severity: 'high', confidence: 'medium', effort: 'low', where: kb.no_indicator.join(', '), code: ':focus-visible {\n  outline: 3px solid #1f6feb;\n  outline-offset: 2px;\n}' }, {
          n: kb.no_indicator.length,
          list: kb.no_indicator.slice(0, 4).join(', '),
        }),
      );
    if (kb.obscured.length)
      out.push(std(ctx, 'focus_obscured', { ...src, category: 'accessibility', standard: wcag('2.4.11'), severity: 'medium', confidence: 'medium', effort: 'low', where: kb.obscured.join(', '), code: 'html { scroll-padding-top: 80px; } /* = sticky header height */' }, { list: kb.obscured.slice(0, 4).join(', ') }));
    if (kb.hidden_focus.length)
      out.push(std(ctx, 'focus_hidden', { ...src, category: 'accessibility', standard: `${wcag('2.4.3')} · ${wcag('2.4.7')}`, severity: 'medium', confidence: 'medium', effort: 'low', where: kb.hidden_focus.join(', '), code: '<div class="drawer" hidden>…</div>\n<!-- or --> <div class="drawer" inert>…</div>' }, { list: kb.hidden_focus.slice(0, 4).join(', ') }));
  }

  // الرسوم بلا اسم، والجداول بلا رؤوس أو عنوان
  const charts = pages.flatMap((p) => (p.charts || []).map((c) => ({ ...c, page: p })));
  const unnamed = charts.filter((c) => !c.name);
  if (unnamed.length)
    out.push(
      std(ctx, 'chart_no_name', { category: 'accessibility', standard: `${wcag('1.1.1')} · ${wcag('4.1.2')}`, severity: 'high', effort: 'low', step: unnamed[0].page.step, source: `step:${unnamed[0].page.step}`, where: unnamed.map((c) => c.selector).slice(0, 4).join(', '), code: '<canvas role="img" aria-label="Monthly sessions, Jan–Jun: rising from 12k to 31k"></canvas>' }, {
        n: unnamed.length,
        list: unnamed.slice(0, 3).map((c) => c.selector).join(', '),
      }),
    );
  const tables = pages.flatMap((p) => (p.tables || []).map((tb) => ({ ...tb, page: p })));
  const noTh = tables.filter((tb) => !tb.has_th);
  if (noTh.length)
    out.push(
      std(ctx, 'table_no_headers', { category: 'accessibility', standard: wcag('1.3.1'), severity: 'medium', effort: 'low', step: noTh[0].page.step, source: `step:${noTh[0].page.step}`, where: noTh.map((tb) => tb.selector).slice(0, 3).join(', '), code: '<thead><tr><th scope="col">Campaign</th><th scope="col">Clicks</th></tr></thead>' }, {
        list: noTh.slice(0, 3).map((tb) => `${tb.selector} (${tb.rows}×${tb.cols})`).join(', '),
      }),
    );
  const noCap = tables.filter((tb) => !tb.has_caption && tb.has_th);
  if (noCap.length)
    out.push(
      std(ctx, 'table_no_caption', { category: 'accessibility', standard: wcag('1.3.1'), severity: 'low', effort: 'low', step: noCap[0].page.step, source: `step:${noCap[0].page.step}`, where: noCap.map((tb) => tb.selector).slice(0, 3).join(', '), code: '<table><caption>Campaign performance, last 30 days</caption>…</table>' }, {
        list: noCap.slice(0, 3).map((tb) => tb.selector).join(', '),
      }),
    );
  if (charts.length || tables.length) insufficient.push(at(L, 'ins_screen_reader'));
}

// ---------- الأداء ----------
function performanceRules(ctx, audit, out, insufficient) {
  const L = ctx.lang;
  const perf = audit.performance;
  if (!perf) {
    const err = (audit.errors.find((e) => e.part === 'performance') || {}).error || '—';
    insufficient.push(at(L, 'ins_perf_failed')({ err }));
    return;
  }
  const m = perf.metrics;
  const src = { step: 0, source: 'step:0', where: perf.url };
  const sec = (v) => Math.round((v / 1000) * 100) / 100;
  const metricFinding = (key, rule, fmt, extra = {}) => {
    const rating = rateMetric(key, m[key]);
    if (!rating || rating === 'good') return;
    const poor = rating === 'poor';
    const sev = { lcp: poor ? 'high' : 'medium', cls: poor ? 'high' : 'medium', tbt: poor ? 'high' : 'medium', fcp: poor ? 'medium' : 'low', ttfb: poor ? 'medium' : 'low' }[key];
    out.push(std(ctx, rule, { ...src, category: 'performance', standard: METRICS[key].standard, severity: sev, effort: key === 'ttfb' ? 'high' : 'medium', ...extra }, fmt));
  };
  metricFinding('lcp', 'lcp', { v: sec(m.lcp), th: 2.5, el: m.lcp_element ? `${m.lcp_element.selector}${m.lcp_element.url ? ` (${short(m.lcp_element.url, 50)})` : ''}` : '' }, { code: '<link rel="preload" as="image" href="/hero.webp" fetchpriority="high">\n<img src="/hero.webp" fetchpriority="high" width="1200" height="600" alt="…">', where: m.lcp_element ? m.lcp_element.selector : perf.url });
  metricFinding('cls', 'cls', { v: m.cls, th: 0.1 }, { code: '<img src="chart.png" width="800" height="400" alt="…">\n.ad-slot { min-height: 250px; }' });
  metricFinding('tbt', 'tbt', { v: m.tbt, th: 200 }, { code: '<script src="/analytics.js" defer></script>\n// split long work:\nawait scheduler.yield?.();' });
  metricFinding('fcp', 'fcp', { v: sec(m.fcp), th: 1.8 });
  metricFinding('ttfb', 'ttfb', { v: m.ttfb, th: 800 }, { code: 'Cache-Control: public, max-age=60, stale-while-revalidate=300' });
  insufficient.push(at(L, 'ins_inp'));

  const res = perf.resources;
  const total = res.reduce((s, r) => s + (r.bytes || 0), 0);
  const js = res.filter((r) => r.type === 'Script').reduce((s, r) => s + (r.bytes || 0), 0);
  const img = res.filter((r) => r.type === 'Image').reduce((s, r) => s + (r.bytes || 0), 0);
  if (total > 1600 * 1024)
    out.push(std(ctx, 'weight', { ...src, category: 'performance', standard: 'Lighthouse total-byte-weight ≤ 1,600 KiB', severity: total > 4 * 1024 * 1024 ? 'high' : 'medium', effort: 'medium' }, { mb: mb(total), n: res.length, js: mb(js), img: mb(img) }));

  const blocking = m.render_blocking || [];
  if (blocking.length)
    out.push(
      std(ctx, 'render_blocking', { ...src, category: 'performance', standard: 'Lighthouse render-blocking-resources', severity: blocking.length > 3 ? 'medium' : 'low', effort: 'medium', where: blocking.map((b) => short(b.url, 50)).slice(0, 4).join(', '), code: '<script src="/app.js" defer></script>\n<link rel="preload" href="/styles.css" as="style" onload="this.rel=\'stylesheet\'">' }, {
        n: blocking.length,
        list: blocking.slice(0, 4).map((b) => `${short(b.url, 50)} (${b.duration} ms)`).join(', '),
      }),
    );

  // الصور: نربط بيانات DOM بأحجام الشبكة
  const bytesOf = new Map(res.filter((r) => r.type === 'Image').map((r) => [r.url, r]));
  const imgs = (perf.images || []).map((i) => ({ ...i, net: bytesOf.get(i.src) })).filter((i) => i.net && i.net.bytes);
  const over = imgs.filter((i) => i.visible && i.rendered[0] > 0 && i.natural[0] > i.rendered[0] * perf.dpr * 1.5 && i.net.bytes > 50 * 1024);
  const wasted = over.reduce((s, i) => s + i.net.bytes * (1 - Math.min(1, (i.rendered[0] * perf.dpr * i.rendered[1] * perf.dpr) / (i.natural[0] * i.natural[1]))), 0);
  if (over.length && wasted > 50 * 1024)
    out.push(
      std(ctx, 'oversized_images', { ...src, category: 'performance', standard: 'Lighthouse uses-responsive-images', severity: wasted > 500 * 1024 ? 'medium' : 'low', effort: 'medium', where: over.map((i) => short(i.src, 50)).slice(0, 3).join(', '), code: '<img src="chart-800.webp"\n     srcset="chart-400.webp 400w, chart-800.webp 800w, chart-1600.webp 1600w"\n     sizes="(max-width: 600px) 100vw, 800px" width="800" height="400" alt="…">' }, {
        n: over.length,
        kb: kb(wasted),
        list: over.slice(0, 3).map((i) => `${short(i.src, 40)} (${i.natural[0]}px → ${i.rendered[0]}px)`).join(', '),
      }),
    );
  const legacy = imgs.filter((i) => /image\/(jpeg|png)/.test(i.net.mime || '') && i.net.bytes > 100 * 1024);
  if (legacy.length)
    out.push(
      std(ctx, 'legacy_images', { ...src, category: 'performance', standard: 'Lighthouse modern-image-formats', severity: 'low', effort: 'low', where: legacy.map((i) => short(i.src, 50)).slice(0, 3).join(', '), code: '<picture>\n  <source srcset="hero.avif" type="image/avif">\n  <source srcset="hero.webp" type="image/webp">\n  <img src="hero.jpg" width="1200" height="600" alt="…">\n</picture>' }, {
        n: legacy.length,
        kb: kb(legacy.reduce((s, i) => s + i.net.bytes, 0)),
        list: legacy.slice(0, 3).map((i) => short(i.src, 50)).join(', '),
      }),
    );
  const unsized = (perf.images || []).filter((i) => i.visible && !i.sized);
  if (unsized.length)
    out.push(
      std(ctx, 'unsized_images', { ...src, category: 'performance', standard: `${METRICS.cls.standard} · Lighthouse unsized-images`, severity: (m.cls || 0) > 0.1 ? 'medium' : 'low', effort: 'low', where: unsized.map((i) => short(i.src, 50)).slice(0, 3).join(', '), code: '<img src="logo.png" width="160" height="40" alt="…">' }, {
        n: unsized.length,
        list: unsized.slice(0, 3).map((i) => short(i.src, 50)).join(', '),
      }),
    );
  const offscreen = imgs.filter((i) => i.below_fold && i.loading !== 'lazy' && i.net.bytes > 20 * 1024);
  if (offscreen.length)
    out.push(
      std(ctx, 'offscreen_images', { ...src, category: 'performance', standard: 'Lighthouse offscreen-images', severity: 'low', effort: 'low', where: offscreen.map((i) => short(i.src, 50)).slice(0, 3).join(', '), code: '<img src="footer-chart.png" loading="lazy" width="600" height="300" alt="…">' }, {
        n: offscreen.length,
        list: offscreen.slice(0, 3).map((i) => short(i.src, 50)).join(', '),
      }),
    );
  if (m.lcp_element && m.lcp_element.url) {
    const lcpImg = (perf.images || []).find((i) => i.src === m.lcp_element.url);
    if (lcpImg && lcpImg.loading === 'lazy')
      out.push(std(ctx, 'lcp_lazy', { ...src, category: 'performance', standard: `${METRICS.lcp.standard} · Lighthouse lcp-lazy-loaded`, severity: 'high', effort: 'low', where: short(lcpImg.src, 60), code: '<img src="hero.webp" fetchpriority="high" width="1200" height="600" alt="…">' }, { src: short(lcpImg.src, 50) }));
  }

  // التخزين المؤقت والضغط للملفات من الموقع نفسه
  const site = siteOf(perf.url);
  const own = res.filter((r) => siteOf(r.url) === site && r.status === 200);
  const maxAge = (h) => {
    const cc = h['cache-control'] || '';
    if (/no-store|no-cache/.test(cc)) return 0;
    const m2 = cc.match(/(?:s-)?max-age=(\d+)/);
    if (m2) return +m2[1];
    if (h.expires) return Math.max(0, (Date.parse(h.expires) - Date.now()) / 1000);
    return 0;
  };
  const shortCache = own.filter((r) => ['Script', 'Stylesheet', 'Image', 'Font'].includes(r.type) && maxAge(r.headers || {}) < 7 * 86400);
  if (shortCache.length)
    out.push(
      std(ctx, 'cache', { ...src, category: 'performance', standard: 'Lighthouse uses-long-cache-ttl', severity: shortCache.length > 10 ? 'medium' : 'low', effort: 'low', where: shortCache.map((r) => short(r.url, 50)).slice(0, 3).join(', '), code: '# fingerprinted assets (app.3f9a1c.js)\nCache-Control: public, max-age=31536000, immutable' }, {
        n: shortCache.length,
        list: shortCache.slice(0, 3).map((r) => `${short(r.url, 45)} (${(r.headers || {})['cache-control'] || '—'})`).join(', '),
      }),
    );
  const textTypes = (r) => ['Document', 'Script', 'Stylesheet'].includes(r.type) || (/(XHR|Fetch)/.test(r.type) && /json|text|javascript|xml/.test(r.mime || ''));
  const uncompressed = own.filter((r) => textTypes(r) && (r.bytes || 0) > 1400 && !/(gzip|br|deflate|zstd)/i.test((r.headers || {})['content-encoding'] || ''));
  if (uncompressed.length)
    out.push(
      std(ctx, 'compression', { ...src, category: 'performance', standard: 'Lighthouse uses-text-compression', severity: 'medium', effort: 'low', where: uncompressed.map((r) => short(r.url, 50)).slice(0, 3).join(', '), code: '# nginx\ngzip on;\ngzip_types text/css application/javascript application/json;\nbrotli on;' }, {
        n: uncompressed.length,
        kb: kb(uncompressed.reduce((s, r) => s + (r.bytes || 0), 0)),
        list: uncompressed.slice(0, 3).map((r) => short(r.url, 50)).join(', '),
      }),
    );
  const bigData = res.filter((r) => /(XHR|Fetch)/.test(r.type) && (r.bytes || 0) > 500 * 1024);
  if (bigData.length)
    out.push(
      std(ctx, 'large_data', { ...src, category: 'performance', standard: 'web.dev — load large datasets incrementally (pagination / virtualization)', severity: 'high', effort: 'high', where: bigData.map((r) => short(r.url, 50)).slice(0, 3).join(', '), code: 'GET /api/campaigns?page=1&page_size=50\n// or aggregate on the server:\nGET /api/campaigns/summary?group_by=day' }, {
        list: bigData.slice(0, 3).map((r) => `${short(r.url, 50)} (${kb(r.bytes)} KB)`).join(', '),
      }),
    );

  for (const p of audit.pages) {
    if ((p.dom_nodes || 0) > 1500) {
      out.push(std(ctx, 'dom_size', { category: 'performance', standard: 'Lighthouse dom-size ≤ 1,500 elements', severity: p.dom_nodes > 3000 ? 'medium' : 'low', effort: 'high', step: p.step, source: `step:${p.step}`, where: short(p.url, 60) }, { n: p.dom_nodes, url: short(p.url, 60) }));
      break;
    }
  }
  const big = audit.pages.flatMap((p) => (p.tables || []).filter((tb) => tb.rows > 200 && !tb.paginated).map((tb) => ({ ...tb, page: p })));
  if (big.length)
    out.push(
      std(ctx, 'big_tables', { category: 'performance', standard: 'Lighthouse dom-size · web.dev virtualize long lists', severity: 'medium', effort: 'medium', step: big[0].page.step, source: `step:${big[0].page.step}`, where: big.map((tb) => tb.selector).slice(0, 3).join(', '), code: '// render only visible rows, e.g. @tanstack/react-virtual\nconst rows = useVirtualizer({ count: data.length, estimateSize: () => 40, getScrollElement });' }, {
        list: big.slice(0, 3).map((tb) => `${tb.selector} (${tb.rows})`).join(', '),
      }),
    );
}

// ---------- تصوير البيانات ----------
function dataVizRules(ctx, audit, out, insufficient, assessed) {
  const L = ctx.lang;
  const charts = audit.pages.flatMap((p) => (p.charts || []).map((c) => ({ ...c, page: p, bg: parseRgb(p.background) })));
  if (!charts.length) {
    insufficient.push(at(L, 'ins_no_charts'));
    return;
  }
  assessed.add('data_visualization');
  const loc = (c) => ({ step: c.page.step, source: `step:${c.page.step}`, where: c.selector });
  const noAlt = charts.filter((c) => !c.has_alternative);
  if (noAlt.length)
    out.push(
      std(ctx, 'chart_no_alt', { ...loc(noAlt[0]), category: 'data_visualization', standard: `${wcag('1.1.1')} · ${wcag('1.3.1')}`, severity: 'medium', effort: 'medium', where: noAlt.map((c) => c.selector).slice(0, 3).join(', '), code: '<figure>\n  <canvas role="img" aria-label="Sessions by month" aria-describedby="s1"></canvas>\n  <figcaption id="s1">Sessions rose 160% Jan–Jun.</figcaption>\n  <details><summary>View as table</summary><table>…</table></details>\n</figure>' }, {
        n: noAlt.length,
        list: noAlt.slice(0, 3).map((c) => c.selector).join(', '),
      }),
    );
  const unknown = charts.filter((c) => !c.library);
  if (unknown.length) insufficient.push(at(L, 'ins_chart_unknown')({ n: unknown.length, list: unknown.slice(0, 3).map((c) => c.selector).join(', ') }));

  for (const c of charts.filter((x) => x.library)) {
    const type = String(c.type || '').toLowerCase();
    const isBar = /bar|column/.test(type);
    const isPie = /pie|doughnut|donut|polar/.test(type);
    if (isBar && c.y_min != null && c.y_min > 0)
      out.push(std(ctx, 'bar_baseline', { ...loc(c), category: 'data_visualization', standard: 'Data-viz best practice: zero baseline for bar charts (Tufte — Lie Factor)', severity: 'medium', effort: 'low', code: 'options: { scales: { y: { beginAtZero: true } } }' }, { type: c.type, sel: c.selector, min: c.y_min }));
    if (isPie && c.points > 6)
      out.push(std(ctx, 'pie_slices', { ...loc(c), category: 'data_visualization', standard: 'Data-viz best practice: pie charts ≤ 5–6 categories', severity: 'low', effort: 'medium', code: "type: 'bar', options: { indexAxis: 'y' } // sorted horizontal bars" }, { type: c.type, sel: c.selector, n: c.points }));
    if (c.series > 1 && !c.legend && !isPie)
      out.push(std(ctx, 'no_legend', { ...loc(c), category: 'data_visualization', standard: `${wcag('1.4.1')} · data-viz labeling`, severity: 'medium', effort: 'low', code: 'options: { plugins: { legend: { display: true } } }' }, { sel: c.selector, n: c.series }));
    if (!isPie && (!c.x_title || !c.y_title)) {
      const axes = [!c.x_title && 'X', !c.y_title && 'Y'].filter(Boolean).join(L === 'en' ? ' and ' : ' و');
      out.push(std(ctx, 'no_axis_titles', { ...loc(c), category: 'data_visualization', standard: `${wcag('1.3.1')} · data-viz labeling (titles, axes, units)`, severity: 'low', effort: 'low', code: "scales: { y: { title: { display: true, text: 'Revenue (SAR)' } } }" }, { sel: c.selector, axes }));
    }
    const colors = (c.colors || []).filter((x) => x[3] > 0.2);
    // عمى الألوان: لونان متمايزان عادة لكن متشابهان تحت المحاكاة
    let worst = null;
    for (let i = 0; i < colors.length; i++)
      for (let j = i + 1; j < colors.length; j++) {
        const normal = deltaE(toLab(colors[i].slice(0, 3).map(lin)), toLab(colors[j].slice(0, 3).map(lin)));
        if (normal < 15) continue;
        for (const [name, mtx] of Object.entries(CVD)) {
          const d = deltaE(toLab(simulate(colors[i], mtx)), toLab(simulate(colors[j], mtx)));
          if (d < 10 && (!worst || d < worst.d)) worst = { d, a: hex(colors[i]), b: hex(colors[j]), name };
        }
      }
    if (worst)
      out.push(
        std(ctx, 'cvd_palette', { ...loc(c), category: 'data_visualization', standard: `${wcag('1.4.1')} · colour-blind-safe palette`, severity: 'medium', effort: 'low', code: "// Okabe–Ito colour-blind-safe palette\nconst palette = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#F0E442'];" }, {
          sel: c.selector,
          a: worst.a,
          b: worst.b,
          type: worst.name,
          de: Math.round(worst.d * 10) / 10,
        }),
      );
    const bg = c.bg && c.bg[3] > 0 ? c.bg : [255, 255, 255, 1];
    const low = colors.filter((x) => contrast(x, bg) < 3);
    if (low.length)
      out.push(
        std(ctx, 'chart_contrast', { ...loc(c), category: 'data_visualization', standard: wcag('1.4.11'), severity: 'medium', effort: 'low', code: "// darken light series colours to ≥ 3:1 against the background\nborderColor: '#2f6f9f'" }, {
          sel: c.selector,
          list: low.slice(0, 4).map((x) => `${hex(x)} (${Math.round(contrast(x, bg) * 10) / 10}:1)`).join(', '),
        }),
      );
  }
}

// ---------- التصميم المتجاوب ----------
function responsiveRules(ctx, audit, out) {
  const r = audit.responsive;
  const L = ctx.lang;
  const src = { step: 0, source: 'step:0', where: ctx.collected.target_url };
  const byName = Object.fromEntries((r || []).filter((v) => !v.error).map((v) => [v.viewport, v]));
  const reflow = byName['reflow-320'];
  if (reflow && reflow.overflow)
    out.push(
      std(ctx, 'reflow', { ...src, category: 'responsive', standard: wcag('1.4.10'), severity: 'high', effort: 'medium', where: reflow.overflow_elements.join(', '), code: 'img, canvas, video { max-width: 100%; height: auto; }\n.table-wrap { overflow-x: auto; }\n.toolbar { display: flex; flex-wrap: wrap; }' }, {
        sw: reflow.scroll_width,
        list: reflow.overflow_elements.slice(0, 4).join(', '),
      }),
    );
  const over = ['mobile', 'tablet'].filter((n) => byName[n] && byName[n].overflow);
  if (over.length)
    out.push(
      std(ctx, 'overflow', { ...src, category: 'responsive', standard: 'Google mobile-friendly: content sized to viewport', severity: over.includes('mobile') ? 'high' : 'medium', effort: 'medium', where: [...new Set(over.flatMap((n) => byName[n].overflow_elements))].slice(0, 4).join(', ') }, {
        list: over.map((n) => `${n} (${byName[n].width}px → ${byName[n].scroll_width}px: ${byName[n].overflow_elements.slice(0, 2).join(', ')})`).join('; '),
      }),
    );
  const mobile = byName.mobile;
  if (mobile) {
    if (!mobile.viewport_meta) out.push(std(ctx, 'no_viewport', { ...src, category: 'responsive', standard: 'Google mobile-friendly: viewport meta', severity: 'high', effort: 'low', code: '<meta name="viewport" content="width=device-width, initial-scale=1">' }, {}));
    if (mobile.small_text_ratio > 0.2)
      out.push(std(ctx, 'small_text', { ...src, category: 'responsive', standard: `Lighthouse font-size (≥ 60% of text ≥ 12px) · ${wcag('1.4.4')}`, severity: 'medium', effort: 'low', code: 'html { font-size: 100%; } body { font-size: 1rem; } small { font-size: 0.8125rem; }' }, { pct: Math.round(mobile.small_text_ratio * 100) }));
    if (mobile.small_targets > 0)
      out.push(
        std(ctx, 'small_targets', { ...src, category: 'responsive', standard: wcag('2.5.8'), severity: mobile.small_targets > 5 ? 'medium' : 'low', confidence: 'medium', effort: 'low', where: mobile.small_target_examples.join(', '), code: 'button, .icon-btn, a.chip { min-width: 24px; min-height: 24px; } /* 44px recommended */' }, {
          n: mobile.small_targets,
          list: mobile.small_target_examples.join(', '),
        }),
      );
  }
  return Boolean(r && r.some((v) => !v.error));
}

// ---------- الأمان والخصوصية ----------
const TRACKERS = /(google-analytics\.com|googletagmanager\.com|doubleclick\.net|facebook\.net|connect\.facebook|hotjar\.com|clarity\.ms|snap\.licdn|ads\.linkedin|analytics\.tiktok|sc-static\.net|segment\.(io|com)|mixpanel\.com|amplitude\.com|matomo|yandex\.ru\/metrika|bat\.bing\.com)/i;
function versionLt(v, target) {
  const a = String(v).split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const b = target.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] || 0) !== b[i]) return (a[i] || 0) < b[i];
  return false;
}
function securityRules(ctx, audit, out, insufficient) {
  const s = audit.security;
  if (!s) return false;
  const L = ctx.lang;
  const h = s.headers || {};
  const src = { step: 0, source: 'step:0', where: s.final_url };
  const add = (rule, base, params = {}) => out.push(std(ctx, rule, { ...src, category: 'security_privacy', ...base }, params));
  if (!s.https) add('no_https', { standard: 'OWASP A02:2021 Cryptographic Failures', severity: 'critical', effort: 'medium', code: '# nginx\nserver { listen 80; return 301 https://$host$request_uri; }' }, { url: s.final_url });
  else {
    if (s.http_redirects_to_https === false) add('no_redirect', { standard: 'OWASP A02:2021 Cryptographic Failures', severity: 'medium', effort: 'low', code: 'server { listen 80; return 301 https://$host$request_uri; }' }, { status: s.http_status });
    if (!h['strict-transport-security']) add('hsts', { standard: 'OWASP A05:2021 Security Misconfiguration (HSTS)', severity: 'medium', effort: 'low', code: 'Strict-Transport-Security: max-age=31536000; includeSubDomains' });
  }
  const csp = h['content-security-policy'] || '';
  if (!csp) add('csp', { standard: 'OWASP A03:2021 Injection (XSS mitigation) · A05:2021', severity: 'medium', effort: 'high', code: "Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'self'; base-uri 'self'" });
  if (!h['x-content-type-options']) add('xcto', { standard: 'OWASP A05:2021 Security Misconfiguration', severity: 'low', effort: 'low', code: 'X-Content-Type-Options: nosniff' });
  if (!h['x-frame-options'] && !/frame-ancestors/i.test(csp)) add('clickjacking', { standard: 'OWASP A05:2021 Security Misconfiguration (clickjacking, CWE-1021)', severity: 'medium', effort: 'low', code: "Content-Security-Policy: frame-ancestors 'self'\nX-Frame-Options: DENY" });
  if (!h['referrer-policy']) add('referrer', { standard: 'OWASP A05:2021 Security Misconfiguration', severity: 'low', effort: 'low', code: 'Referrer-Policy: strict-origin-when-cross-origin' });
  if (!h['permissions-policy']) add('permissions', { standard: 'OWASP A05:2021 Security Misconfiguration', severity: 'low', effort: 'low', code: 'Permissions-Policy: camera=(), microphone=(), geolocation=()' });
  const leaks = ['server', 'x-powered-by', 'x-aspnet-version'].filter((k) => h[k] && /\d/.test(h[k])).map((k) => `${k}: ${h[k]}`);
  if (leaks.length) add('version_leak', { standard: 'OWASP A05:2021 Security Misconfiguration (CWE-200)', severity: 'low', effort: 'low', code: '# nginx\nserver_tokens off;\n# express\napp.disable("x-powered-by");' }, { list: leaks.join(', ') });

  const res = (audit.performance && audit.performance.resources) || [];
  if (s.https) {
    const mixed = res.filter((r) => /^http:/i.test(r.url));
    if (mixed.length) add('mixed_content', { standard: 'OWASP A02:2021 Cryptographic Failures (mixed content)', severity: 'high', effort: 'low', where: mixed.map((r) => short(r.url, 50)).slice(0, 3).join(', '), code: 'Content-Security-Policy: upgrade-insecure-requests' }, { n: mixed.length, list: mixed.slice(0, 3).map((r) => r.url.slice(0, 70)).join(', ') });
  }
  const host = (() => {
    try {
      return new URL(s.final_url).hostname;
    } catch {
      return '';
    }
  })();
  const own = (s.cookies || []).filter((c) => host.endsWith(c.domain.replace(/^\./, '')));
  if (s.https) {
    const insecure = own.filter((c) => !c.secure);
    if (insecure.length) add('cookie_secure', { standard: 'OWASP A05:2021 Security Misconfiguration (CWE-614)', severity: 'medium', effort: 'low', code: 'Set-Cookie: session=…; Secure; HttpOnly; SameSite=Lax; Path=/' }, { list: insecure.map((c) => c.name).slice(0, 5).join(', ') });
  }
  const session = own.filter((c) => /sess|sid|token|auth|jwt|login/i.test(c.name) && !c.httpOnly);
  if (session.length) add('cookie_httponly', { standard: 'OWASP A07:2021 Identification and Authentication Failures (CWE-1004)', severity: 'high', confidence: 'medium', effort: 'low', code: 'Set-Cookie: session=…; Secure; HttpOnly; SameSite=Lax; Path=/' }, { list: session.map((c) => c.name).join(', ') });

  // ملفات الارتباط والموافقة: طلبات تتبع في التحميل الأول (بلا أي تفاعل)
  const trackers = [...new Set(res.filter((r) => TRACKERS.test(r.url)).map((r) => new URL(r.url).hostname))];
  const first = audit.pages.find((p) => p.step === 0);
  if (trackers.length) {
    const banner = first && first.consent_banner;
    add(banner ? 'consent_early' : 'consent_missing', { standard: 'GDPR Art. 6–7 · ePrivacy Art. 5(3) · Saudi PDPL (consent)', severity: banner ? 'medium' : 'high', confidence: 'medium', effort: 'medium', where: trackers.join(', '), code: "// Google Consent Mode v2: deny by default until the user consents\ngtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied' });" }, { list: trackers.slice(0, 4).join(', ') });
  }

  // بيانات حساسة في الروابط
  const SENSITIVE = /[?&](pass(word)?|pwd|token|access_token|api[_-]?key|secret|session(id)?|ssn|card(number)?|cvv|iban|national_?id)=([^&]+)/i;
  const urls = [...new Set([...ctx.collected.steps.flatMap((st) => (st.network || []).map((n) => n.url)), ...res.map((r) => r.url)])];
  const hits = urls.filter((u) => SENSITIVE.test(u)).map((u) => u.replace(/=([^&]{3})[^&]*/g, '=$1…'));
  if (hits.length) add('url_secrets', { standard: 'OWASP A04:2021 Insecure Design (CWE-598)', severity: 'high', confidence: 'medium', effort: 'medium', where: hits.slice(0, 2).map((u) => short(u, 60)).join(', ') }, { list: hits.slice(0, 3).map((u) => short(u, 70)).join(', ') });

  const secrets = [...new Set(audit.pages.flatMap((p) => p.inline_secrets || []))];
  if (secrets.length) add('inline_secrets', { standard: 'OWASP A02:2021 / A05:2021 (CWE-798 hard-coded credentials)', severity: 'critical', confidence: 'medium', effort: 'medium' }, { list: secrets.join(', ') });

  const libs = Object.assign({}, ...audit.pages.map((p) => p.libs || {}));
  const vulns = [];
  if (libs.jquery && versionLt(libs.jquery, '3.5.0')) vulns.push({ lib: 'jQuery', ver: libs.jquery, why: 'XSS — CVE-2020-11022 / CVE-2020-11023 (fixed in 3.5.0)' });
  if (libs.angularjs) vulns.push({ lib: 'AngularJS', ver: libs.angularjs, why: L === 'en' ? 'end of life since Dec 2021; no security fixes' : 'انتهى دعمه منذ ديسمبر 2021 ولا يتلقى إصلاحات أمنية' });
  if (libs.bootstrap && (versionLt(libs.bootstrap, '3.4.1') || (!versionLt(libs.bootstrap, '4.0.0') && versionLt(libs.bootstrap, '4.3.1')))) vulns.push({ lib: 'Bootstrap', ver: libs.bootstrap, why: 'XSS — CVE-2019-8331 (fixed in 3.4.1 / 4.3.1)' });
  for (const v of vulns) add('vuln_lib', { standard: 'OWASP A06:2021 Vulnerable and Outdated Components', severity: 'high', effort: 'medium', where: v.lib }, v);
  insufficient.push(at(L, 'ins_vuln_components'));

  const pwForms = audit.pages.flatMap((p) => p.password_forms || []).filter((f) => /^http:/i.test(f.action));
  if (pwForms.length) add('insecure_password_form', { standard: 'OWASP A02:2021 Cryptographic Failures (CWE-319)', severity: 'critical', effort: 'low', where: pwForms[0].selector }, { action: pwForms[0].action });
  return true;
}

// ---------- SEO والمحتوى ----------
function seoRules(ctx, audit, out) {
  const L = ctx.lang;
  const pages = audit.pages.filter((p) => p.seo);
  if (!pages.length) return false;
  const loc = (ps) => ({ step: ps[0].step, source: `step:${ps[0].step}`, where: ps.map((p) => short(p.url, 50)).slice(0, 3).join(', ') });
  const plist = (ps) => ps.map((p) => short(p.url, 50)).slice(0, 4).join(', ');
  const add = (rule, ps, base, params) => ps.length && out.push(std(ctx, rule, { ...loc(ps), category: 'seo_content', ...base }, params));

  const badTitle = pages.filter((p) => p.seo.title && (p.seo.title.length > 60 || p.seo.title.length < 10));
  if (badTitle.length) add('title_length', badTitle, { standard: `Google Search Essentials — title links · ${wcag('2.4.2')}`, severity: 'low', effort: 'low', code: '<title>Campaign performance — Acme Analytics</title>' }, { n: badTitle[0].seo.title.length, title: badTitle[0].seo.title.slice(0, 80), pages: badTitle.length });
  add('no_description', pages.filter((p) => !p.seo.description), { standard: 'Google Search Essentials — snippets (meta description)', severity: 'medium', effort: 'low', code: '<meta name="description" content="Track campaign clicks, conversions and spend across channels in one dashboard.">' }, { list: plist(pages.filter((p) => !p.seo.description)) });
  const badH1 = pages.filter((p) => p.seo.h1_count !== 1);
  add('h1', badH1, { standard: `${wcag('1.3.1')} · ${wcag('2.4.6')} · Google Search Essentials`, severity: badH1.some((p) => p.seo.h1_count === 0) ? 'medium' : 'low', effort: 'low', code: '<h1>Campaign performance</h1>' }, { detail: badH1.slice(0, 3).map((p) => `${p.seo.h1_count} (${short(p.url, 40)})`).join(', ') });
  const skips = pages.filter((p) => p.seo.heading_skips.length);
  add('heading_skips', skips, { standard: `${wcag('1.3.1')} · ${wcag('2.4.6')}`, severity: 'low', effort: 'low' }, { list: skips.flatMap((p) => p.seo.heading_skips).slice(0, 3).join('; ') });
  add('no_canonical', pages.filter((p) => !p.seo.canonical), { standard: 'Google Search Essentials — canonical URLs', severity: 'low', effort: 'low', code: '<link rel="canonical" href="https://example.com/dashboard">' }, { list: plist(pages.filter((p) => !p.seo.canonical)) });
  const noindex = pages.filter((p) => /noindex/i.test(p.seo.robots || ''));
  if (noindex.length) add('noindex', noindex, { standard: 'Google Search Essentials — indexing', severity: 'medium', confidence: 'medium', effort: 'low' }, { v: noindex[0].seo.robots, url: short(noindex[0].url, 60) });
  add('no_main', pages.filter((p) => !p.seo.has_main), { standard: `${wcag('1.3.1')} · ${wcag('2.4.1')} (landmarks)`, severity: 'low', effort: 'low', code: '<main id="main">…</main>' }, { list: plist(pages.filter((p) => !p.seo.has_main)) });
  const vague = pages.filter((p) => p.seo.vague_links.length);
  add('vague_links', vague, { standard: `${wcag('2.4.4')} · clear microcopy`, severity: 'low', effort: 'low', code: '<a href="/reports/q2">Read the Q2 campaign report</a>' }, { list: vague.flatMap((p) => p.seo.vague_links).slice(0, 4).join(', ') });
  add('no_og', pages.filter((p) => !p.seo.og_title), { standard: 'Open Graph protocol (social sharing)', severity: 'low', effort: 'low', code: '<meta property="og:title" content="Acme Analytics">\n<meta property="og:description" content="…">\n<meta property="og:image" content="https://…/og.png">' }, { list: plist(pages.filter((p) => !p.seo.og_title)) });
  return true;
}

// ---------- وضع الملفات (التجربة): قواعد مبسطة على HTML وHAR والسجلات ----------
function fileRules(ctx, collected, out, insufficient) {
  const L = ctx.lang;
  for (const f of collected.files) {
    const src = { step: 0, source: `file:${f.file}`, where: f.file };
    if (f.har) {
      const reqs = f.har.requests.filter((r) => !ASSET_RE.test(r.url));
      const fmt = (r) => `${r.method} ${short(r.url, 50)} → ${r.status}`;
      const se = reqs.filter((r) => r.status >= 500);
      if (se.length) {
        const writes = se.some((r) => r.method !== 'GET');
        out.push(std(ctx, 'server_error', { ...src, category: 'usability', standard: `${ISO_EFF} · ${nielsen(9)}`, severity: writes ? 'critical' : 'high', effort: 'medium' }, { list: tlist(L, se.map(fmt), 4) }, writes ? 'iw' : 'ir'));
      }
      const ce = reqs.filter((r) => r.status >= 400 && r.status < 500 && r.status !== 401 && r.status !== 403);
      if (ce.length) out.push(std(ctx, 'client_error', { ...src, category: 'usability', standard: ISO_EFF, severity: 'medium', confidence: 'medium', effort: 'medium' }, { list: tlist(L, ce.map(fmt), 4) }));
    } else if (f.html) {
      const a = f.html.accessibility;
      if (a.unlabeled_fields.length) {
        const tx = axeText('label', L);
        out.push(make(ctx, { ...src, rule: 'html:label', category: 'accessibility', title: tx.issue, standard: `${wcag('1.3.1')} · ${wcag('4.1.2')}`, severity: 'high', confidence: 'high', effort: 'low', evidence: `${tx.issue}: ${a.unlabeled_fields.join(', ')}`, impact: at(L, 'axe').i({ impact: 'critical' }), fix: tx.fix, code: tx.code }));
      }
      if (a.unnamed_buttons > 0) {
        const tx = axeText('button-name', L);
        out.push(make(ctx, { ...src, rule: 'html:button-name', category: 'accessibility', title: tx.issue, standard: wcag('4.1.2'), severity: 'high', confidence: 'high', effort: 'low', evidence: `${tx.issue}: ${a.unnamed_buttons}`, impact: at(L, 'axe').i({ impact: 'critical' }), fix: tx.fix, code: tx.code }));
      }
      if (a.images_without_alt > 0) {
        const tx = axeText('image-alt', L);
        out.push(make(ctx, { ...src, rule: 'html:image-alt', category: 'accessibility', title: tx.issue, standard: wcag('1.1.1'), severity: 'medium', confidence: 'high', effort: 'low', evidence: `${tx.issue}: ${a.images_without_alt}`, impact: at(L, 'axe').i({ impact: 'serious' }), fix: tx.fix, code: tx.code }));
      }
      if (f.html.error_messages.length)
        out.push(std(ctx, 'visible_error', { ...src, category: 'usability', standard: `${nielsen(9)} · ${wcag('3.3.1')}`, severity: 'medium', confidence: 'medium', effort: 'low' }, { list: tlist(L, f.html.error_messages, 3) }));
    } else if (f.kind === 'text' && f.type === 'txt') {
      const errs = f.content.text.split(/\r?\n/).filter((l) => /(Uncaught|TypeError|ReferenceError|Exception|\bError\b)/.test(l));
      if (errs.length) out.push(std(ctx, 'js_errors', { ...src, category: 'usability', standard: nielsen(5), severity: 'low', confidence: 'medium', effort: 'medium' }, { list: tlist(L, errs.map((l) => `«${l.trim().slice(0, 100)}»`), 3) }));
    }
  }
  insufficient.push((L === 'en' ? 'Rules alone cannot map file findings to journey steps; they are recorded on step 0 (general).' : 'ربط الملاحظات الآلية بخطوات الرحلة غير ممكن من الملفات بالقواعد وحدها؛ سُجلت على الخطوة 0 (عام).'));
}

export function ruleFindings(input, collected, { modelUsed = false } = {}) {
  const ctx = { lang: input.lang || 'ar', input, collected, modelUsed };
  const out = [];
  const insufficient = [];
  const assessed = new Set(['usability']);
  if (collected.source === 'url') {
    journeyRules(ctx, collected, out, insufficient);
    const audit = collected.audit || { pages: [], errors: [] };
    for (const e of audit.errors || []) insufficient.push(at(ctx.lang, 'ins_audit_failed')({ part: e.part, err: e.error }));
    if (audit.pages.some((p) => p.axe)) assessed.add('accessibility');
    accessibilityRules(ctx, audit, out, insufficient);
    if (audit.performance) assessed.add('performance');
    performanceRules(ctx, audit, out, insufficient);
    dataVizRules(ctx, audit, out, insufficient, assessed);
    if (responsiveRules(ctx, audit, out)) assessed.add('responsive');
    if (securityRules(ctx, audit, out, insufficient)) assessed.add('security_privacy');
    if (seoRules(ctx, audit, out)) assessed.add('seo_content');
  } else {
    fileRules(ctx, collected, out, insufficient);
    if (collected.files.some((f) => f.html)) assessed.add('accessibility');
    insufficient.push(at(ctx.lang, 'ins_not_assessed_file'));
  }
  if (input.expected_features && input.expected_features.length)
    insufficient.push(ctx.lang === 'en' ? 'Comparing expected stories and features with what appeared needs the AI model; the rules do not judge them.' : 'مقارنة القصص والميزات المتوقعة بما ظهر تحتاج حكم النموذج؛ القواعد الآلية لا تحكم عليها.');
  out.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.step - b.step);
  return { findings: out, insufficient, assessed };
}
