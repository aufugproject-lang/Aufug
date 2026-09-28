// محلل بقواعد ثابتة: يعمل دائمًا، بدون نموذج ذكاء اصطناعي.
// كل ملاحظة هنا مشتقة مباشرة من عنصر محدد في الدليل المجموع، ولا تُبنى على افتراضات.
// ما لا تستطيع القواعد الحكم عليه (جودة المحتوى، اكتمال الميزات، الصور) يذهب إلى insufficient_evidence.
import { t, list as tlist } from './i18n.js';

const ASSET_RE = /\.(ico|png|jpe?g|gif|svg|webp|woff2?|ttf|css|map)(\?|$)/i;

function sameOrigin(a, b) {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

function pathOf(u) {
  try {
    const x = new URL(u);
    return x.pathname + x.search;
  } catch {
    return u;
  }
}

function finding(input, f) {
  return {
    journey: input.journey,
    criterion: f.criterion,
    severity: f.severity,
    step: f.step,
    evidence: f.evidence,
    evidence_source: f.source,
    impact: f.impact,
    recommendation: f.recommendation,
    recommendation_status: 'pending_human_review',
    confidence: f.confidence,
    origin: 'rule',
    rule: f.rule,
  };
}

// ملاحظة من قاعدة: النصوص الثلاثة (دليل، أثر، توصية) من مفاتيح الترجمة
function push(ctx, out, base, key, params = {}, impactKey = `${key}.i`) {
  const L = ctx.lang;
  out.push({
    ...base,
    step: ctx.step,
    source: ctx.source,
    evidence: t(L, `${key}.e`, params),
    impact: t(L, impactKey),
    recommendation: t(L, `${key}.r`),
  });
}

// ---------- قواعد مشتركة لصفحة (لقطة من المتصفح أو ملف HTML) ----------

function pageRules(page, ctx, out) {
  const L = ctx.lang;
  // رسالة الخطأ نفسها قد تبقى ظاهرة عبر عدة خطوات؛ تُسجل عند أول ظهور فقط
  const newErrors = (page.error_messages || []).filter((m) => !ctx.seenErrors.has(m));
  newErrors.forEach((m) => ctx.seenErrors.add(m));
  if (newErrors.length)
    push(ctx, out, { rule: 'visible_error', criterion: 'UX', severity: 'medium', confidence: 'medium' }, 'r.visible_error', {
      list: tlist(L, newErrors, 3),
    });

  // ملاحظات الوصول تُسجل مرة واحدة لكل صفحة حتى لا تتكرر مع كل خطوة
  const pageKey = page.url || ctx.source;
  if (ctx.seenPages.has(pageKey)) return;
  ctx.seenPages.add(pageKey);
  const a = page.accessibility || {};
  if (a.unlabeled_fields && a.unlabeled_fields.length)
    push(ctx, out, { rule: 'unlabeled_fields', criterion: 'accessibility', severity: 'medium', confidence: 'high' }, 'r.unlabeled', {
      list: tlist(L, a.unlabeled_fields),
    });
  if (a.unnamed_buttons > 0)
    push(ctx, out, { rule: 'unnamed_buttons', criterion: 'accessibility', severity: 'medium', confidence: 'high' }, 'r.unnamed', { n: a.unnamed_buttons });
  if (a.images_without_alt > 0)
    push(ctx, out, { rule: 'images_without_alt', criterion: 'accessibility', severity: 'low', confidence: 'high' }, 'r.alt', { n: a.images_without_alt });
  if (page.lang === '' && !ctx.langReported) {
    ctx.langReported = true;
    push(ctx, out, { rule: 'missing_lang', criterion: 'accessibility', severity: 'low', confidence: 'high' }, 'r.lang');
  }
}

function networkRules(ctx, out, requests) {
  const L = ctx.lang;
  const fmt = (r) => `${r.method} ${pathOf(r.url)} → ${r.status}`;
  const serverErr = requests.filter((r) => r.status >= 500);
  const clientErr = requests.filter((r) => r.status >= 400 && r.status < 500 && r.status !== 401 && r.status !== 403);
  if (serverErr.length) {
    const writes = serverErr.some((r) => r.method !== 'GET');
    push(
      ctx,
      out,
      { rule: 'server_error', criterion: 'friction', severity: writes ? 'high' : 'medium', confidence: 'high' },
      'r.server',
      { list: tlist(L, serverErr.map((r) => fmt(r) + (r.response_excerpt ? ` ${r.response_excerpt.slice(0, 80)}` : '')), 4) },
      writes ? 'r.server.iw' : 'r.server.ir',
    );
  }
  if (clientErr.length)
    push(ctx, out, { rule: 'client_error', criterion: 'friction', severity: 'medium', confidence: 'medium' }, 'r.client', {
      list: tlist(L, clientErr.map(fmt), 4),
    });
}

// ---------- وضع الرابط ----------

function urlRules(input, collected, out, insufficient, ctx) {
  const L = ctx.lang;
  const base = collected.target_url;
  for (const s of collected.steps) {
    ctx.step = s.number;
    ctx.source = `step:${s.number}`;

    if (s.status === 'failed') {
      if (s.number === 0) {
        push(ctx, out, { rule: 'site_unreachable', criterion: 'friction', severity: 'high', confidence: 'high' }, 'r.unreachable', { err: s.error });
      } else if (s.auto && s.http_status) {
        const code = s.http_status;
        const q = L === 'en' ? ['“', '”'] : ['«', '»'];
        const link = s.link ? `${q[0]}${s.link.text}${q[1]} (${s.link.path})` : s.text;
        push(
          ctx,
          out,
          { rule: 'broken_link', criterion: 'navigation', severity: code >= 500 ? 'high' : 'medium', confidence: 'high' },
          'r.broken',
          { link, code },
          code >= 500 ? 'r.broken.i5' : 'r.broken.i4',
        );
      } else if (s.auto) {
        push(
          ctx,
          out,
          { rule: 'auto_step_failed', criterion: 'friction', severity: s.kind === 'login' ? 'high' : 'medium', confidence: 'medium' },
          'r.auto_failed',
          { step: s.text, err: s.error },
        );
      } else if (s.error_code === 'unsupported' || !s.action) {
        insufficient.push(t(L, 'r.unsupported.ins', { n: s.number, step: s.text }));
      } else {
        push(
          ctx,
          out,
          { rule: 'journey_step_failed', criterion: 'friction', severity: 'high', confidence: s.error_code === 'not_found' ? 'medium' : 'high' },
          'r.step_failed',
          { step: s.text, err: s.error },
        );
      }
    }

    // طلبات الشبكة الفاشلة من نفس الموقع (بدون الملفات الثابتة، وبدون صفحة الرابط المعطوب نفسها)
    const reqs = (s.network || []).filter(
      (n) => sameOrigin(n.url, base) && !ASSET_RE.test(n.url) && n.status && !(s.status === 'failed' && n.type === 'document'),
    );
    networkRules(ctx, out, reqs);

    const jsErrors = (s.console_errors || []).filter((m) => !/Failed to load resource/i.test(m));
    if (jsErrors.length)
      push(ctx, out, { rule: 'js_errors', criterion: 'UX', severity: 'low', confidence: 'medium' }, 'r.js', {
        list: tlist(L, jsErrors.map((m) => (L === 'en' ? `“${m.slice(0, 120)}”` : `«${m.slice(0, 120)}»`)), 3),
      });

    // صفحة رابط معطوب ليست صفحة من المنتج، فلا تُفحص
    if (s.page && !s.page.snapshot_error && !(s.auto && s.status === 'failed')) pageRules(s.page, ctx, out);
  }
}

// ---------- وضع الملفات ----------

function fileRules(input, collected, out, insufficient, ctx) {
  const L = ctx.lang;
  ctx.step = 0;
  for (const f of collected.files) {
    ctx.source = `file:${f.file}`;
    if (f.har) {
      networkRules(ctx, out, f.har.requests.filter((r) => !ASSET_RE.test(r.url)));
    } else if (f.html) {
      pageRules({ ...f.html, url: ctx.source }, ctx, out);
    } else if (f.kind === 'text' && f.type === 'txt') {
      const errs = f.content.text.split(/\r?\n/).filter((l) => /(Uncaught|TypeError|ReferenceError|Exception|\bError\b)/.test(l));
      if (errs.length)
        push(ctx, out, { rule: 'log_errors', criterion: 'UX', severity: 'low', confidence: 'medium' }, 'r.log', {
          list: tlist(L, errs.map((l) => (L === 'en' ? `“${l.trim().slice(0, 120)}”` : `«${l.trim().slice(0, 120)}»`)), 3),
        });
    }
  }
  insufficient.push(t(L, 'r.files_step0'));
}

export function ruleFindings(input, collected) {
  const raw = [];
  const insufficient = [];
  const ctx = { lang: input.lang || 'ar', seenPages: new Set(), seenErrors: new Set(), langReported: false };
  if (collected.source === 'url') urlRules(input, collected, raw, insufficient, ctx);
  else fileRules(input, collected, raw, insufficient, ctx);
  if (input.expected_features.length) insufficient.push(t(ctx.lang, 'r.features_model'));
  const order = { high: 0, medium: 1, low: 2 };
  const findings = raw.map((f) => finding(input, f)).sort((a, b) => order[a.severity] - order[b.severity] || a.step - b.step);
  return { findings, insufficient };
}
