// تدقيق قائم على المعايير لكل رابط: axe (WCAG 2.2 AA)، لوحة المفاتيح والتركيز،
// Core Web Vitals بتشغيل جوال مقيّد، التصميم المتجاوب، الأمان والخصوصية، SEO، والرسوم البيانية.
// كل دالة تعيد بيانات خام فقط؛ تحويلها إلى ملاحظات يتم في rules.js.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let AXE_SOURCE = null;
function axeSource() {
  if (!AXE_SOURCE) AXE_SOURCE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  return AXE_SOURCE;
}

const urlKey = (u) => String(u || '').split('#')[0];

// ---------- حقائق الصفحة (تُنفذ داخل الصفحة) ----------

function pageFactsInPage() {
  const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  const visible = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  };
  const sel = (el) => {
    const parts = [];
    for (let e = el, i = 0; e && e.nodeType === 1 && i < 3; e = e.parentElement, i++) {
      let p = e.tagName.toLowerCase();
      if (e.id) {
        parts.unshift(`${p}#${e.id}`);
        break;
      }
      const cls = [...e.classList].filter((c) => /^[a-zA-Z][\w-]{1,30}$/.test(c)).slice(0, 2);
      if (cls.length) p += '.' + cls.join('.');
      parts.unshift(p);
    }
    return parts.join(' > ');
  };
  const meta = (n) => {
    const m = document.querySelector(`meta[name="${n}" i], meta[property="${n}" i]`);
    return m ? m.getAttribute('content') : null;
  };

  // SEO والمحتوى
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible).map((h) => ({ level: +h.tagName[1], text: clean(h.innerText).slice(0, 80) }));
  const skips = [];
  for (let i = 1; i < headings.length; i++) if (headings[i].level - headings[i - 1].level > 1) skips.push(`h${headings[i - 1].level} → h${headings[i].level} («${headings[i].text}»)`);
  const VAGUE = /^(click here|here|read more|more|learn more|details|link|اضغط هنا|انقر هنا|هنا|المزيد|اقرأ المزيد|اعرف المزيد|التفاصيل)$/i;
  const vague = [...document.querySelectorAll('a[href]')].filter(visible).filter((a) => VAGUE.test(clean(a.innerText)) && !a.getAttribute('aria-label')).map((a) => `«${clean(a.innerText)}» → ${a.getAttribute('href')}`);
  const seo = {
    title: document.title,
    description: meta('description'),
    robots: meta('robots'),
    canonical: (document.querySelector('link[rel="canonical"]') || {}).href || null,
    viewport: meta('viewport'),
    lang: document.documentElement.getAttribute('lang') || '',
    og_title: meta('og:title'),
    h1_count: headings.filter((h) => h.level === 1).length,
    heading_skips: skips.slice(0, 5),
    has_main: Boolean(document.querySelector('main, [role="main"]')),
    vague_links: [...new Set(vague)].slice(0, 8),
  };

  // الجداول
  const tables = [...document.querySelectorAll('table')]
    .filter(visible)
    .map((tb) => ({
      selector: sel(tb),
      rows: tb.rows.length,
      cols: tb.rows[0] ? tb.rows[0].cells.length : 0,
      has_th: Boolean(tb.querySelector('th')),
      has_caption: Boolean(tb.caption || tb.getAttribute('aria-label') || tb.getAttribute('aria-labelledby')),
      paginated: Boolean(tb.closest('section, div') && tb.closest('section, div').querySelector('[class*="pagination" i], nav[aria-label*="page" i], [aria-label*="pagination" i]')),
    }))
    .filter((tb) => tb.rows > 2 && tb.cols > 1);

  // الرسوم البيانية: المكتبات المعروفة ثم العناصر العامة
  const toRgb = (c) => {
    if (typeof c !== 'string') return null;
    const d = document.createElement('div');
    d.style.color = c;
    document.body.appendChild(d);
    const v = getComputedStyle(d).color;
    d.remove();
    const m = v.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
    return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null;
  };
  const nameOf = (el) => {
    const lb = el.getAttribute('aria-labelledby');
    const byId = lb ? lb.split(/\s+/).map((id) => (document.getElementById(id) || {}).textContent || '').join(' ') : '';
    const fig = el.closest('figure');
    const svgTitle = el.tagName.toLowerCase() === 'svg' ? (el.querySelector(':scope > title') || {}).textContent : '';
    return clean(el.getAttribute('aria-label') || byId || el.getAttribute('title') || svgTitle || (fig && fig.querySelector('figcaption') ? fig.querySelector('figcaption').textContent : ''));
  };
  const altNear = (el) => {
    if (el.getAttribute('aria-describedby')) return true;
    if (el.tagName.toLowerCase() === 'canvas' && clean(el.textContent).length > 10) return true;
    // يُبحث في حاوية الرسم القريبة فقط، لا في الصفحة كلها
    let box = el.parentElement;
    for (let i = 0; i < 3 && box && box !== document.body && !box.matches('main, [role="main"], html'); i++, box = box.parentElement) {
      if (box.querySelector('table')) return true;
      if ([...box.querySelectorAll('a, button')].some((b) => /table|csv|excel|download|export|data|جدول|تحميل|تصدير|بيانات/i.test(clean(b.innerText) + ' ' + (b.getAttribute('aria-label') || '')))) return true;
    }
    return false;
  };
  const charts = [];
  const covered = new Set();
  const pushChart = (el, info) => {
    if (!el) return;
    covered.add(el);
    charts.push({
      selector: sel(el),
      element: el.tagName.toLowerCase(),
      name: nameOf(el),
      role: el.getAttribute('role') || '',
      has_alternative: altNear(el),
      ...info,
      colors: (info.colors || []).map(toRgb).filter(Boolean).slice(0, 12),
    });
  };
  try {
    if (window.Chart) {
      const inst = window.Chart.instances ? Object.values(window.Chart.instances) : [];
      for (const c of inst) {
        const o = c.options || {};
        const sc = o.scales || {};
        const y = sc.y || sc.yAxes || {};
        const x = sc.x || sc.xAxes || {};
        const ds = (c.data && c.data.datasets) || [];
        const type = (c.config && c.config.type) || '';
        const colorList = [];
        for (const d of ds) for (const k of ['backgroundColor', 'borderColor']) [].concat(d[k] || []).forEach((v) => typeof v === 'string' && colorList.push(v));
        pushChart(c.canvas, {
          library: 'Chart.js',
          type,
          series: ds.length,
          points: ((c.data && c.data.labels) || []).length,
          y_min: c.scales && c.scales.y ? c.scales.y.min : null,
          y_begin_at_zero: y.beginAtZero === true,
          x_title: Boolean(x.title && x.title.display),
          y_title: Boolean(y.title && y.title.display),
          legend: !(o.plugins && o.plugins.legend && o.plugins.legend.display === false),
          colors: [...new Set(colorList)],
        });
      }
    }
  } catch {}
  try {
    if (window.Highcharts && window.Highcharts.charts) {
      for (const hc of window.Highcharts.charts.filter(Boolean)) {
        const ya = hc.yAxis && hc.yAxis[0];
        const xa = hc.xAxis && hc.xAxis[0];
        pushChart(hc.renderTo, {
          library: 'Highcharts',
          type: (hc.options.chart && hc.options.chart.type) || (hc.series[0] && hc.series[0].type) || '',
          series: hc.series.length,
          points: hc.series[0] ? hc.series[0].points.length : 0,
          y_min: ya ? ya.min : null,
          y_begin_at_zero: ya ? ya.min === 0 : false,
          x_title: Boolean(xa && xa.options.title && xa.options.title.text),
          y_title: Boolean(ya && ya.options.title && ya.options.title.text),
          legend: !(hc.legend && hc.legend.options && hc.legend.options.enabled === false),
          colors: hc.series.map((s) => s.color).filter((v) => typeof v === 'string'),
        });
      }
    }
  } catch {}
  try {
    if (window.echarts) {
      document.querySelectorAll('[_echarts_instance_]').forEach((el) => {
        const inst = window.echarts.getInstanceByDom(el);
        if (!inst) return;
        const opt = inst.getOption();
        const series = opt.series || [];
        pushChart(el, {
          library: 'ECharts',
          type: series[0] ? series[0].type : '',
          series: series.length,
          points: series[0] && series[0].data ? series[0].data.length : 0,
          y_min: opt.yAxis && opt.yAxis[0] ? opt.yAxis[0].min : null,
          y_begin_at_zero: opt.yAxis && opt.yAxis[0] ? opt.yAxis[0].scale !== true : true,
          x_title: Boolean(opt.xAxis && opt.xAxis[0] && opt.xAxis[0].name),
          y_title: Boolean(opt.yAxis && opt.yAxis[0] && opt.yAxis[0].name),
          legend: Boolean(opt.legend && opt.legend.length && opt.legend[0].show !== false),
          colors: (opt.color || []).slice(0, Math.max(series.length, 1)),
        });
      });
    }
  } catch {}
  const CHART_HINT = /chart|graph|plot|highcharts|recharts|apexcharts|nvd3|c3|plotly|vega|echarts|amcharts|d3/i;
  document.querySelectorAll('canvas, svg').forEach((el) => {
    if (covered.has(el) || [...covered].some((c) => c.contains(el) || el.contains(c))) return;
    if (!visible(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width < 160 || r.height < 100) return;
    const hint = CHART_HINT.test(`${el.getAttribute('class') || ''} ${el.id} ${el.parentElement ? el.parentElement.className : ''}`);
    const shapes = el.tagName.toLowerCase() === 'svg' ? el.querySelectorAll('rect, path, circle, line, polyline').length : 0;
    if (el.tagName.toLowerCase() === 'canvas' || hint || shapes > 15) {
      if (el.tagName.toLowerCase() === 'svg' && !hint && el.closest('[aria-hidden="true"]')) return;
      pushChart(el, { library: null, type: '' });
    }
  });

  // الصور (للأداء والتصميم المتجاوب)
  const vh = innerHeight;
  const images = [...document.images]
    .filter((img) => img.currentSrc || img.src)
    .slice(0, 200)
    .map((img) => {
      const r = img.getBoundingClientRect();
      const cs = getComputedStyle(img);
      return {
        src: img.currentSrc || img.src,
        natural: [img.naturalWidth, img.naturalHeight],
        rendered: [Math.round(r.width), Math.round(r.height)],
        sized: (img.hasAttribute('width') && img.hasAttribute('height')) || (cs.aspectRatio && cs.aspectRatio !== 'auto'),
        loading: img.getAttribute('loading') || 'eager',
        top: Math.round(r.top + scrollY),
        visible: visible(img),
        below_fold: r.top + scrollY > vh,
      };
    });

  // الأمان: مكتبات معروفة الإصدار، نماذج كلمات مرور، أسرار في السكربتات المضمنة، لافتة الموافقة
  const libs = {};
  try {
    if (window.jQuery && window.jQuery.fn) libs.jquery = window.jQuery.fn.jquery;
  } catch {}
  try {
    if (window.angular && window.angular.version) libs.angularjs = window.angular.version.full;
  } catch {}
  try {
    libs.bootstrap =
      (window.bootstrap && window.bootstrap.Tooltip && window.bootstrap.Tooltip.VERSION) ||
      (window.jQuery && window.jQuery.fn && window.jQuery.fn.tooltip && window.jQuery.fn.tooltip.Constructor && window.jQuery.fn.tooltip.Constructor.VERSION) ||
      undefined;
  } catch {}
  const forms = [...document.querySelectorAll('form')]
    .filter((f) => f.querySelector('input[type="password"]'))
    .map((f) => ({ selector: sel(f), action: f.action || location.href, method: (f.method || 'get').toLowerCase() }));
  const SECRET = /(AKIA[0-9A-Z]{16}|sk_live_[0-9a-zA-Z]{20,}|ghp_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----)/g;
  const secrets = [];
  document.querySelectorAll('script:not([src])').forEach((s) => {
    for (const m of (s.textContent || '').matchAll(SECRET)) secrets.push(m[1].slice(0, 12) + '…');
  });
  const CONSENT = /cookie|consent|gdpr|onetrust|cookiebot|didomi|usercentrics|termly|iubenda|quantcast|cmp/i;
  const consentEl = [...document.querySelectorAll('div, section, aside, dialog, form')].find(
    (el) => (CONSENT.test(el.id) || CONSENT.test(el.className)) && visible(el) && clean(el.innerText).length > 20,
  );
  const consentText = /(cookie|cookies|ملفات تعريف الارتباط|ملفات الارتباط|الكوكيز)/i.test(clean(document.body ? document.body.innerText : '').slice(0, 20000));

  return {
    url: location.href,
    seo,
    tables,
    charts,
    images,
    dom_nodes: document.getElementsByTagName('*').length,
    libs,
    password_forms: forms,
    inline_secrets: [...new Set(secrets)].slice(0, 5),
    consent_banner: Boolean(consentEl) || consentText,
    background: getComputedStyle(document.body || document.documentElement).backgroundColor,
  };
}

async function runAxe(page) {
  await page.evaluate(axeSource());
  return page.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      resultTypes: ['violations', 'incomplete'],
    });
    return {
      violations: r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        help_url: v.helpUrl,
        tags: v.tags,
        count: v.nodes.length,
        nodes: v.nodes.slice(0, 4).map((n) => ({ target: [].concat(n.target).join(' '), html: String(n.html).slice(0, 180) })),
      })),
      incomplete: r.incomplete.map((v) => ({ id: v.id, help: v.help, count: v.nodes.length, tags: v.tags })),
    };
  });
}

// تدقيق صفحة واحدة: axe + الحقائق
export async function pageAudit(page) {
  const out = { url: page.url() };
  try {
    out.axe = await runAxe(page);
  } catch (e) {
    out.axe_error = String(e.message || e).split('\n')[0];
  }
  try {
    Object.assign(out, await page.evaluate(pageFactsInPage));
  } catch (e) {
    out.facts_error = String(e.message || e).split('\n')[0];
  }
  return out;
}

// ---------- لوحة المفاتيح والتركيز ----------

function focusInfoInPage() {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return { body: true };
  const sel = (e) => {
    const parts = [];
    for (let x = e, i = 0; x && x.nodeType === 1 && i < 3; x = x.parentElement, i++) {
      let p = x.tagName.toLowerCase();
      if (x.id) {
        parts.unshift(`${p}#${x.id}`);
        break;
      }
      const cls = [...x.classList].filter((c) => /^[a-zA-Z][\w-]{1,30}$/.test(c)).slice(0, 2);
      if (cls.length) p += '.' + cls.join('.');
      parts.unshift(p);
    }
    return parts.join(' > ');
  };
  const pick = (s) => [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderTopColor, s.borderBottomColor, s.backgroundColor, s.color, s.textDecorationLine].join('|');
  const s1 = pick(getComputedStyle(el));
  const st = getComputedStyle(el);
  const hasOutline = st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0;
  el.blur();
  const s2 = pick(getComputedStyle(el));
  el.focus({ preventScroll: true });
  const r = el.getBoundingClientRect();
  let obscured = false;
  if (r.width > 0 && r.height > 0) {
    const cx = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2));
    const cy = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
    const hit = document.elementFromPoint(cx, cy);
    if (hit && !el.contains(hit) && !hit.contains(el)) {
      for (let x = hit; x; x = x.parentElement) {
        const p = getComputedStyle(x).position;
        if (p === 'fixed' || p === 'sticky') {
          obscured = true;
          break;
        }
      }
    }
  }
  const text = (el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return {
    selector: sel(el),
    text,
    href: el.getAttribute('href') || '',
    indicator: hasOutline || s1 !== s2,
    zero_size: r.width < 1 || r.height < 1,
    offscreen: r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth,
    obscured,
  };
}

export async function keyboardAudit(page, maxTabs = 30) {
  await page.evaluate(() => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  const focusable = await page.evaluate(
    () =>
      [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]')].filter((el) => {
        const r = el.getBoundingClientRect();
        return !el.disabled && r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
      }).length,
  );
  const stops = [];
  let trap = null;
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(focusInfoInPage).catch(() => null);
    if (!info) break;
    if (info.body) {
      if (stops.length) break; // دار التركيز إلى بداية الصفحة
      continue;
    }
    stops.push(info);
    const n = stops.length;
    if (n >= 3 && stops[n - 1].selector === stops[n - 2].selector && stops[n - 2].selector === stops[n - 3].selector && focusable > 1) {
      trap = info.selector;
      break;
    }
  }
  const first = stops[0];
  return {
    focusable,
    tabbed: stops.length,
    no_indicator: [...new Set(stops.filter((s) => !s.indicator && !s.zero_size).map((s) => s.selector))].slice(0, 8),
    hidden_focus: [...new Set(stops.filter((s) => s.zero_size || s.offscreen).map((s) => s.selector))].slice(0, 8),
    obscured: [...new Set(stops.filter((s) => s.obscured).map((s) => s.selector))].slice(0, 8),
    trap,
    skip_link: Boolean(first && /^#/.test(first.href) && /skip|main|content|تخط|انتقل|المحتوى/i.test(first.text)),
  };
}

// ---------- الأداء: تشغيل جوال مقيّد مثل Lighthouse ----------

function perfObserversInit() {
  const P = (window.__qaPerf = { lcp: null, lcpEl: null, cls: 0, longTasks: [] });
  const sel = (e) => {
    if (!e || e.nodeType !== 1) return '';
    let p = e.tagName.toLowerCase();
    if (e.id) return `${p}#${e.id}`;
    const cls = [...e.classList].filter((c) => /^[a-zA-Z][\w-]{1,30}$/.test(c)).slice(0, 2);
    return cls.length ? `${p}.${cls.join('.')}` : p;
  };
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        P.lcp = e.renderTime || e.loadTime || e.startTime;
        P.lcpEl = { selector: sel(e.element), url: e.url || '', size: e.size };
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
  try {
    // CLS: أكبر نافذة جلسة (فجوة < 1 ث، مدة ≤ 5 ث)
    let win = 0;
    let first = 0;
    let last = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.hadRecentInput) continue;
        if (win && e.startTime - last < 1000 && e.startTime - first < 5000) {
          win += e.value;
        } else {
          win = e.value;
          first = e.startTime;
        }
        last = e.startTime;
        P.cls = Math.max(P.cls, win);
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) P.longTasks.push([e.startTime, e.duration]);
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
}

function perfResultsInPage() {
  const P = window.__qaPerf || {};
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const fcpE = performance.getEntriesByName('first-contentful-paint')[0];
  const fcp = fcpE ? fcpE.startTime : null;
  const tbt = (P.longTasks || []).filter(([s]) => fcp == null || s >= fcp).reduce((sum, [, d]) => sum + Math.max(0, d - 50), 0);
  const blocking = performance
    .getEntriesByType('resource')
    .filter((r) => r.renderBlockingStatus === 'blocking')
    .map((r) => ({ url: r.name, type: r.initiatorType, duration: Math.round(r.duration) }));
  return {
    ttfb: nav.responseStart ? Math.round(nav.responseStart) : null,
    fcp: fcp != null ? Math.round(fcp) : null,
    lcp: P.lcp != null ? Math.round(P.lcp) : null,
    lcp_element: P.lcpEl,
    cls: Math.round((P.cls || 0) * 1000) / 1000,
    tbt: Math.round(tbt),
    dom_content_loaded: nav.domContentLoadedEventEnd ? Math.round(nav.domContentLoadedEventEnd) : null,
    load: nav.loadEventEnd ? Math.round(nav.loadEventEnd) : null,
    render_blocking: blocking.slice(0, 15),
    long_tasks: (P.longTasks || []).length,
  };
}

const MOBILE = {
  viewport: { width: 412, height: 823 },
  deviceScaleFactor: 1.75,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
};

export async function perfAudit(browser, url) {
  const ctx = await browser.newContext({ ...MOBILE, ignoreHTTPSErrors: true, bypassCSP: true, locale: 'ar' });
  try {
    await ctx.addInitScript(perfObserversInit);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    const reqs = new Map();
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    // 4G بطيء كما في Lighthouse: RTT 150ms، 1.6Mbps تنزيل، 750Kbps رفع، وتقييد المعالج ×4
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    cdp.on('Network.requestWillBeSent', (e) => {
      if (!reqs.has(e.requestId)) reqs.set(e.requestId, { url: e.request.url, method: e.request.method, type: e.type || 'Other', bytes: 0 });
    });
    cdp.on('Network.responseReceived', (e) => {
      const r = reqs.get(e.requestId) || { url: e.response.url, type: e.type };
      const headers = {};
      for (const [k, v] of Object.entries(e.response.headers || {})) headers[k.toLowerCase()] = String(v);
      Object.assign(r, { status: e.response.status, mime: e.response.mimeType, headers, from_cache: e.response.fromDiskCache || false, type: e.type || r.type });
      reqs.set(e.requestId, r);
    });
    cdp.on('Network.loadingFinished', (e) => {
      const r = reqs.get(e.requestId);
      if (r) r.bytes = e.encodedDataLength || 0;
    });
    cdp.on('Network.loadingFailed', (e) => {
      const r = reqs.get(e.requestId);
      if (r) r.failed = e.errorText;
    });
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'load', timeout: 90000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const metrics = await page.evaluate(perfResultsInPage);
    const images = await page.evaluate(() => {
      const vh = innerHeight;
      return [...document.images]
        .filter((i) => i.currentSrc || i.src)
        .slice(0, 200)
        .map((img) => {
          const r = img.getBoundingClientRect();
          const cs = getComputedStyle(img);
          return {
            src: img.currentSrc || img.src,
            natural: [img.naturalWidth, img.naturalHeight],
            rendered: [Math.round(r.width), Math.round(r.height)],
            sized: (img.hasAttribute('width') && img.hasAttribute('height')) || (cs.aspectRatio && cs.aspectRatio !== 'auto'),
            loading: img.getAttribute('loading') || 'eager',
            below_fold: r.top + scrollY > vh * 1.2,
            visible: r.width > 0 && r.height > 0,
          };
        });
    });
    const dpr = MOBILE.deviceScaleFactor;
    const resources = [...reqs.values()].filter((r) => r.status);
    return { url, wall_ms: Date.now() - t0, conditions: 'mobile 412×823, slow 4G (150ms RTT, 1.6 Mbps), CPU ×4', dpr, metrics, resources, images };
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ---------- التصميم المتجاوب ----------

function layoutFactsInPage() {
  const W = innerWidth;
  const sel = (e) => {
    let p = e.tagName.toLowerCase();
    if (e.id) return `${p}#${e.id}`;
    const cls = [...e.classList].filter((c) => /^[a-zA-Z][\w-]{1,30}$/.test(c)).slice(0, 2);
    return cls.length ? `${p}.${cls.join('.')}` : p;
  };
  const vis = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  };
  const overflow = document.documentElement.scrollWidth > W + 2;
  const wide = [];
  if (overflow) {
    for (const el of document.body.querySelectorAll('*')) {
      if (wide.length >= 5) break;
      const r = el.getBoundingClientRect();
      if ((r.right > W + 2 || r.left < -2) && r.width > 0 && vis(el) && getComputedStyle(el).position !== 'fixed') {
        if (![...wide].some((w) => w.el.contains(el))) wide.push({ el, selector: sel(el), width: Math.round(r.width) });
      }
    }
  }
  let small = 0;
  let total = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(), i = 0; n && i < 4000; n = walker.nextNode(), i++) {
    const txt = n.textContent.trim();
    if (!txt || !n.parentElement || !vis(n.parentElement)) continue;
    total += txt.length;
    if (parseFloat(getComputedStyle(n.parentElement).fontSize) < 12) small += txt.length;
  }
  const targets = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, [role=button]')].filter(vis);
  const tiny = targets.filter((el) => {
    const r = el.getBoundingClientRect();
    return (r.width < 24 || r.height < 24) && !(el.tagName === 'A' && getComputedStyle(el).display === 'inline');
  });
  const vp = document.querySelector('meta[name="viewport" i]');
  return {
    width: W,
    scroll_width: document.documentElement.scrollWidth,
    overflow,
    overflow_elements: wide.map((w) => `${w.selector} (${w.width}px)`),
    small_text_ratio: total ? Math.round((small / total) * 100) / 100 : 0,
    small_targets: tiny.length,
    small_target_examples: tiny.slice(0, 5).map(sel),
    viewport_meta: vp ? vp.getAttribute('content') : null,
  };
}

const VIEWPORTS = [
  { name: 'reflow-320', width: 320, height: 640, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  { name: 'tablet', width: 820, height: 1180, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1440, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
];

export async function responsiveAudit(browser, url) {
  const out = [];
  for (const v of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: v.width, height: v.height },
      isMobile: v.isMobile,
      hasTouch: v.hasTouch,
      deviceScaleFactor: v.deviceScaleFactor,
      ignoreHTTPSErrors: true,
      locale: 'ar',
    });
    try {
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(500);
      out.push({ viewport: v.name, ...(await page.evaluate(layoutFactsInPage)) });
    } catch (e) {
      out.push({ viewport: v.name, error: String(e.message || e).split('\n')[0] });
    } finally {
      await ctx.close().catch(() => {});
    }
  }
  return out;
}

// ---------- الأمان: ترويسات الاستجابة الرئيسية وإعادة التوجيه إلى HTTPS ----------

export async function securityAudit(context, mainResponse, url) {
  const out = { url, final_url: mainResponse ? mainResponse.url() : url };
  try {
    out.headers = mainResponse ? await mainResponse.allHeaders() : {};
  } catch {
    out.headers = {};
  }
  try {
    const u = new URL(out.final_url);
    out.https = u.protocol === 'https:';
    if (out.https) {
      const httpUrl = `http://${u.host}${u.pathname}${u.search}`;
      const res = await context.request.get(httpUrl, { maxRedirects: 0, timeout: 10000 }).catch(() => null);
      if (res) {
        const loc = res.headers().location || '';
        out.http_redirects_to_https = res.status() >= 300 && res.status() < 400 && /^https:/i.test(new URL(loc, httpUrl).href);
        out.http_status = res.status();
      } else {
        out.http_redirects_to_https = null; // المنفذ 80 غير متاح: لا خطر تحميل غير مشفر
      }
    }
  } catch {}
  try {
    out.cookies = (await context.cookies()).map((c) => ({ name: c.name, domain: c.domain, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite }));
  } catch {
    out.cookies = [];
  }
  return out;
}

export { urlKey };
