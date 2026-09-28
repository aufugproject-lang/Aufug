import { t } from './i18n.js';

// فحص آلي لوجود أحداث التحليلات المتوقعة داخل الدليل المجموع فقط.
// لا يحكم على جودة التتبع؛ يجيب فقط: هل ظهر اسم الحدث في الدليل أم لا.

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matcher(name) {
  return new RegExp(`(^|[^A-Za-z0-9_])${escapeRe(name)}($|[^A-Za-z0-9_])`, 'i');
}

// يعيد قائمة [{ label, text }] من المصادر التي تُعد دليلًا على إطلاق الأحداث
function observationSources(collected) {
  const out = [];
  if (collected.source === 'url') {
    for (const s of collected.steps) {
      const parts = [];
      for (const n of s.network || []) parts.push(queryOf(n.url), n.post_data || '');
      if (s.page && s.page.data_layer) parts.push(JSON.stringify(s.page.data_layer));
      for (const t of s.tracking_calls || []) parts.push(t.payload);
      out.push({ label: `step:${s.number}`, text: parts.join('\n') });
    }
    return out;
  }
  for (const f of collected.files) {
    if (f.har) {
      const parts = f.har.requests.map((r) => `${queryOf(r.url)}\n${r.post_data || ''}`);
      out.push({ label: `file:${f.file}`, text: parts.join('\n') });
    } else if (f.kind === 'data' || (f.kind === 'text' && f.type === 'txt')) {
      out.push({ label: `file:${f.file}`, text: f.content.text });
    } else if (f.kind === 'page') {
      out.push({ label: `file:${f.file}`, text: f.html.inline_scripts.text });
    }
  }
  return out;
}

// مسار الرابط ليس دليلًا على إطلاق حدث (مثل /login.html)؛ نبحث في الاستعلام فقط
function queryOf(u) {
  const i = String(u).indexOf('?');
  return i < 0 ? '' : decodeSafe(String(u).slice(i + 1));
}

function decodeSafe(u) {
  try {
    return decodeURIComponent(u);
  } catch {
    return u;
  }
}

export function hasNetworkEvidence(collected) {
  if (collected.source === 'url') return true;
  return collected.files.some((f) => f.har || f.kind === 'data' || (f.kind === 'page' && f.html.inline_scripts.total_chars > 0));
}

export function checkAnalytics(expectedEvents, collected) {
  const sources = observationSources(collected);
  return expectedEvents.map((ev) => {
    const re = matcher(ev.event_name);
    const hit = sources.find((s) => re.test(s.text));
    return { ...ev, observed: Boolean(hit), observed_in: hit ? hit.label : null };
  });
}

// النتيجة الآلية قبل حكم النموذج: ناقص مؤكد، أو دليل غير كافٍ
export function deterministicAnalytics(checks, collected, lang = 'ar') {
  const missing = [];
  const insufficient = [];
  const networkSources = hasNetworkEvidence(collected);
  for (const c of checks) {
    if (c.observed) continue;
    if (collected.auto_explored) {
      insufficient.push(t(lang, 'an.ins_auto', { ev: c.event_name }));
    } else if (collected.source === 'url' && !collected.all_steps_executed) {
      insufficient.push(t(lang, 'an.ins_stopped', { ev: c.event_name, step: collected.stopped_at_step }));
    } else if (!networkSources) {
      insufficient.push(t(lang, 'an.ins_no_net', { ev: c.event_name }));
    } else {
      missing.push({
        event_name: c.event_name,
        when: c.when || t(lang, 'an.when_unknown'),
        why: t(lang, collected.source === 'url' ? 'an.why_url' : 'an.why_file'),
      });
    }
  }
  return { missing, insufficient };
}
