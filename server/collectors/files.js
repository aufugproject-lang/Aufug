import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { t } from '../i18n.js';

const MAX_TEXT = 15000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function clip(text, max = MAX_TEXT) {
  const t = String(text || '');
  return { text: t.slice(0, max), truncated: t.length > max, total_chars: t.length };
}

function extOf(name) {
  return path.extname(name).slice(1).toLowerCase();
}

function parseHtml(raw) {
  const $ = cheerio.load(raw);
  const scripts = $('script')
    .map((_, el) => $(el).html() || '')
    .get()
    .join('\n');
  $('script, style, noscript, template').remove();
  const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  const buttons = [];
  $('button, [role=button], input[type=submit], input[type=button], a[href]').each((_, el) => {
    if (buttons.length >= 60) return;
    const $el = $(el);
    buttons.push({
      kind: el.tagName === 'a' ? 'link' : 'button',
      text: clean($el.attr('aria-label') || $el.text() || $el.attr('value') || '').slice(0, 80),
      disabled: $el.is('[disabled]') || $el.attr('aria-disabled') === 'true',
    });
  });
  const errors = new Set();
  $('[role=alert], [aria-live], .error, .errors, .invalid-feedback, .field-error, .alert-danger, [class*="error"], [data-error]').each((_, el) => {
    const t = clean($(el).text());
    if (t && t.length < 400) errors.add(t);
  });
  const unlabeled = [];
  $('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea').each((_, el) => {
    const $el = $(el);
    const id = $el.attr('id');
    const labelled =
      $el.attr('aria-label') || $el.attr('aria-labelledby') || (id && $(`label[for="${id}"]`).length) || $el.closest('label').length;
    if (!labelled && unlabeled.length < 20) unlabeled.push($el.attr('name') || id || $el.attr('placeholder') || $el.attr('type') || el.tagName);
  });
  return {
    title: clean($('title').first().text()),
    lang: $('html').attr('lang') || '',
    visible_text: clip(clean($('body').text() || $.root().text()), 6000),
    buttons,
    error_messages: [...errors].slice(0, 20),
    accessibility: {
      unlabeled_fields: unlabeled,
      images_without_alt: $('img:not([alt])').length,
      unnamed_buttons: $('button').filter((_, el) => !clean($(el).text()) && !$(el).attr('aria-label')).length,
    },
    inline_scripts: clip(scripts, 4000),
  };
}

function parseHar(raw) {
  const har = JSON.parse(raw);
  const entries = (har.log && har.log.entries) || [];
  const requests = entries.slice(0, 400).map((e) => ({
    started: e.startedDateTime,
    method: e.request?.method,
    url: String(e.request?.url || '').slice(0, 400),
    status: e.response?.status ?? null,
    status_text: e.response?.statusText || undefined,
    mime: e.response?.content?.mimeType || undefined,
    post_data: e.request?.postData?.text ? String(e.request.postData.text).slice(0, 800) : undefined,
    response_excerpt:
      e.response?.status >= 400 && e.response?.content?.text ? String(e.response.content.text).slice(0, 400) : undefined,
  }));
  return {
    total_entries: entries.length,
    truncated: entries.length > 400,
    requests,
    failed_requests: requests.filter((r) => r.status === 0 || r.status === null || r.status >= 400).length,
  };
}

async function imageDims(buf, ext) {
  try {
    if (ext === 'png' && buf.readUInt32BE(0) === 0x89504e47) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (ext === 'jpg' || ext === 'jpeg') {
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) break;
        const marker = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xc3) return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
        i += 2 + len;
      }
    }
  } catch {}
  return null;
}

// files: [{ path, originalname }]
export async function collectFromFiles(files, lang = 'ar') {
  const evidence = [];
  for (const f of files) {
    const name = f.originalname;
    const ext = extOf(name);
    const buf = await fs.readFile(f.path);
    const item = { file: name, type: ext, size_bytes: buf.length };
    try {
      if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
        item.kind = 'image';
        item.dimensions = await imageDims(buf, ext);
        item.image_path = f.path;
        item.media_type = ext === 'png' ? 'image/png' : 'image/jpeg';
        item.too_large_for_model = buf.length > MAX_IMAGE_BYTES;
      } else if (ext === 'har') {
        item.kind = 'network';
        item.har = parseHar(buf.toString('utf8'));
      } else if (ext === 'json') {
        const raw = buf.toString('utf8');
        let parsed = null;
        try {
          parsed = JSON.parse(raw);
        } catch {
          item.parse_error = t(lang, 'file.json_error');
        }
        if (parsed && parsed.log && Array.isArray(parsed.log.entries)) {
          item.kind = 'network';
          item.har = parseHar(raw);
        } else {
          item.kind = 'data';
          item.content = clip(parsed ? JSON.stringify(parsed, null, 1) : raw);
        }
      } else if (ext === 'html' || ext === 'htm') {
        item.kind = 'page';
        item.html = parseHtml(buf.toString('utf8'));
      } else {
        item.kind = 'text';
        item.content = clip(buf.toString('utf8'));
      }
    } catch (e) {
      item.kind = 'unreadable';
      item.error = t(lang, 'file.unreadable', { msg: String(e.message || e).split('\n')[0] });
    }
    evidence.push(item);
  }
  return { source: 'file', files: evidence };
}
