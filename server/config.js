import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// تحميل ملف .env البسيط إن وُجد (بدون اعتماديات إضافية)
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

export const config = {
  port: Number(process.env.PORT || 3000),
  model: process.env.QA_MODEL || 'claude-opus-5',
  dataDir: path.join(ROOT, 'data'),
  demoDir: path.join(ROOT, 'demo'),
  autoMaxPages: Number(process.env.AUTO_MAX_PAGES || 6),
  stepTimeoutMs: Number(process.env.STEP_TIMEOUT_MS || 10000),
  headless: process.env.HEADLESS !== 'false',
  chromiumPath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
};

export function modelConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'txt', 'md', 'json', 'har', 'html', 'htm'];
export const CRITERIA = ['UX', 'CX', 'navigation', 'accessibility', 'feature_completeness', 'friction', 'analytics'];
export const SEVERITIES = ['high', 'medium', 'low'];
export const CONFIDENCES = ['high', 'medium', 'low'];
