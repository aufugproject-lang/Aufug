import fs from 'node:fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { config, modelConfigured, CRITERIA, SEVERITIES, CONFIDENCES } from './config.js';
import { checkAnalytics, deterministicAnalytics } from './analytics.js';
import { ruleFindings } from './rules.js';
import { t } from './i18n.js';
import { executiveSummary } from './summary.js';

const SEVERITY_WEIGHT = { high: 1.5, medium: 0.75, low: 0.25 };

const systemPrompt = (lang) => `أنت محلل جودة منتجات رقمية وتجربة عميل. تراجع رحلة مستخدم واحدة لتطبيق ويب في بيئة اختبار.

قواعد ملزمة:
- راجع الدليل المجموع المرفق فقط. لا تعتمد على معرفة عامة عن مواقع أو منتجات مشابهة، ولا تفترض سلوكًا لم يظهر في الدليل.
- كل ملاحظة يجب أن تستند إلى دليل محدد: اقتبس أو صف بدقة ما ظهر (نص، زر، رسالة خطأ، طلب شبكة، محتوى ملف)، واذكر مصدره في evidence_source بالقيمة الحرفية من قائمة المصادر المسموحة.
- step هو رقم الخطوة كما ورد في خطوات الرحلة (0 = الصفحة الأولى أو دليل عام لا يخص خطوة محددة).
- المعايير المسموحة فقط: UX، CX، navigation، accessibility، feature_completeness، friction، analytics.
- الشدة: high إذا كانت الرحلة لا تكتمل أو بيانات العميل تضيع. medium إذا يكمل المستخدم بصعوبة واضحة. low إذا كان الإزعاج لا يوقف المهمة.
- confidence: high فقط إذا كان الدليل مباشرًا وصريحًا. medium إذا احتاج استنتاجًا بسيطًا. low إذا كان الدليل جزئيًا.
- إذا كان الدليل غير كافٍ للحكم على أمر ما (مثل ميزة متوقعة لم يظهر عنها أي شيء، أو صورة غير واضحة) فاكتب بندًا في insufficient_evidence ولا تخمّن ولا تنشئ ملاحظة.
- لا تكرر الملاحظة نفسها بصياغات مختلفة. ادمج ما يخص المشكلة نفسها في ملاحظة واحدة.
- قارن الميزات والقصص المتوقعة بما ظهر في الدليل؛ الميزة الغائبة بدليل واضح تُسجل تحت feature_completeness، وغير المؤكدة تذهب إلى insufficient_evidence.
- أحداث التحليلات: فحص آلي مرفق يبين أي الأحداث ظهرت في الدليل. لا تعدّ حدثًا ظهر في الدليل حدثًا ناقصًا. اكتب في missing_analytics_events فقط الأحداث المتوقعة غير الظاهرة، مع متى يجب أن تُطلق ولماذا تُعد ناقصة بناءً على الدليل.
- التوصية مقترح عملي قصير يخضع لمراجعة بشرية.
- ${t(lang, 'model.language')}
- success_condition_met: yes إذا أظهر الدليل تحقق شرط النجاح، no إذا أظهر عدم تحققه، unknown إذا لم يكفِ الدليل.
- journey_state: completed أو stopped أو unknown، و stopped_at_step رقم الخطوة التي توقفت عندها الرحلة أو -1 إذا لم تتوقف أو لم يُعرف.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['success_condition_met', 'success_condition_basis', 'journey_state', 'stopped_at_step', 'findings', 'missing_analytics_events', 'insufficient_evidence'],
  properties: {
    success_condition_met: { type: 'string', enum: ['yes', 'no', 'unknown'] },
    success_condition_basis: { type: 'string' },
    journey_state: { type: 'string', enum: ['completed', 'stopped', 'unknown'] },
    stopped_at_step: { type: 'integer' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['criterion', 'severity', 'step', 'evidence_source', 'evidence', 'impact', 'recommendation', 'confidence'],
        properties: {
          criterion: { type: 'string', enum: CRITERIA },
          severity: { type: 'string', enum: SEVERITIES },
          step: { type: 'integer' },
          evidence_source: { type: 'string' },
          evidence: { type: 'string' },
          impact: { type: 'string' },
          recommendation: { type: 'string' },
          confidence: { type: 'string', enum: CONFIDENCES },
        },
      },
    },
    missing_analytics_events: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['event_name', 'when', 'why'],
        properties: { event_name: { type: 'string' }, when: { type: 'string' }, why: { type: 'string' } },
      },
    },
    insufficient_evidence: { type: 'array', items: { type: 'string' } },
  },
};

// ---------- تجهيز الدليل للنموذج ----------

function allowedSources(collected) {
  if (collected.source === 'url') return collected.steps.map((s) => `step:${s.number}`);
  return collected.files.map((f) => `file:${f.file}`);
}

function evidenceForModel(collected) {
  if (collected.source === 'url') {
    return {
      source: 'url',
      target_url: collected.target_url,
      auto_explored: Boolean(collected.auto_explored),
      all_steps_executed: collected.all_steps_executed,
      stopped_at_step: collected.stopped_at_step,
      steps: collected.steps.map((s) => ({
        evidence_source: `step:${s.number}`,
        number: s.number,
        written_step: s.text,
        status: s.status,
        action_result: s.action_result,
        error: s.error,
        page: s.page,
        network: (s.network || []).slice(0, 80),
        console_errors: s.console_errors,
        tracking_calls: s.tracking_calls,
      })),
    };
  }
  return {
    source: 'file',
    files: collected.files.map((f) => {
      const { image_path, ...rest } = f;
      return { evidence_source: `file:${f.file}`, ...rest };
    }),
  };
}

function buildUserContent(input, collected, analyticsChecks, priorFindings = []) {
  const brief = {
    product_name: input.product_name,
    journey: input.journey,
    steps: input.steps,
    success_condition: input.success_condition,
    expected_features_and_stories: input.expected_features,
    expected_analytics_events: input.expected_events,
  };
  if (collected.auto_explored) {
    brief.note =
      'لم يكتب المستخدم خطوات: الخطوات أعلاه استكشاف تلقائي (تسجيل دخول إن وُجد حساب تجريبي ثم فتح روابط التنقل). قيّم ما ظهر في الصفحات المفتوحة فقط، ولا تعدّ عدم تنفيذ إجراءات لم تُطلب ملاحظة.';
  }
  if (!input.success_condition) brief.success_condition = 'غير محدد — استخدم unknown لـ success_condition_met';
  const content = [
    { type: 'text', text: `مدخلات المراجعة:\n${JSON.stringify(brief, null, 1)}` },
    { type: 'text', text: `مصادر الدليل المسموحة لحقل evidence_source:\n${JSON.stringify(allowedSources(collected))}` },
    { type: 'text', text: `الدليل المجموع:\n${JSON.stringify(evidenceForModel(collected), null, 1)}` },
    {
      type: 'text',
      text: `نتيجة الفحص الآلي لأحداث التحليلات (observed=true يعني أن الاسم ظهر في الدليل):\n${JSON.stringify(analyticsChecks, null, 1)}`,
    },
    {
      type: 'text',
      text: `ملاحظات سجلتها القواعد الآلية مسبقًا وستُعرض كما هي. لا تكررها ولا تعِد صياغتها؛ أضف فقط ما لا تغطيه:\n${JSON.stringify(
        priorFindings.map(({ criterion, step, evidence_source, evidence }) => ({ criterion, step, evidence_source, evidence })),
        null,
        1,
      )}`,
    },
  ];
  return content;
}

async function imageBlocks(collected) {
  if (collected.source !== 'file') return [];
  const blocks = [];
  for (const f of collected.files) {
    if (f.kind !== 'image' || f.too_large_for_model) continue;
    const data = (await fs.readFile(f.image_path)).toString('base64');
    blocks.push({ type: 'text', text: `الصورة التالية مصدرها: file:${f.file}` });
    blocks.push({ type: 'image', source: { type: 'base64', media_type: f.media_type, data } });
  }
  return blocks;
}

async function callModel(input, collected, analyticsChecks, priorFindings) {
  const client = new Anthropic();
  const content = [...(await imageBlocks(collected)), ...buildUserContent(input, collected, analyticsChecks, priorFindings)];
  const stream = client.messages.stream({
    model: config.model,
    max_tokens: 32000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    system: systemPrompt(input.lang),
    messages: [{ role: 'user', content }],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') throw new Error(t(input.lang, 'err.refusal'));
  if (message.stop_reason === 'max_tokens') throw new Error(t(input.lang, 'err.max_tokens'));
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

// ---------- التحقق من مخرجات النموذج ----------

function norm(s) {
  return String(s || '').replace(/[\s\p{P}]+/gu, ' ').trim().toLowerCase();
}

export function validateFindings(raw, collected, input) {
  const sources = new Set(allowedSources(collected));
  const maxStep = input.steps.length;
  const kept = [];
  const rejected = [];
  const seen = new Set();
  for (const f of raw || []) {
    const problems = [];
    if (!CRITERIA.includes(f.criterion)) problems.push(t(input.lang, 'rej.criterion'));
    if (!SEVERITIES.includes(f.severity)) problems.push(t(input.lang, 'rej.severity'));
    if (!CONFIDENCES.includes(f.confidence)) problems.push(t(input.lang, 'rej.confidence'));
    if (!Number.isInteger(f.step) || f.step < 0 || f.step > maxStep) problems.push(t(input.lang, 'rej.step'));
    if (!sources.has(f.evidence_source)) problems.push(t(input.lang, 'rej.source'));
    if (!String(f.evidence || '').trim()) problems.push(t(input.lang, 'rej.evidence'));
    if (problems.length) {
      rejected.push(t(input.lang, 'ins.rejected', { problems: problems.join(t(input.lang, 'list.sep')), text: String(f.impact || f.evidence || '').slice(0, 200) }));
      continue;
    }
    const key = `${f.criterion}|${f.step}|${norm(f.evidence).slice(0, 120)}`;
    const key2 = `${f.criterion}|${f.step}|${norm(f.impact).slice(0, 120)}`;
    if (seen.has(key) || seen.has(key2)) continue;
    seen.add(key);
    seen.add(key2);
    kept.push({
      journey: input.journey,
      criterion: f.criterion,
      severity: f.severity,
      step: f.step,
      evidence: String(f.evidence).trim(),
      evidence_source: f.evidence_source,
      impact: String(f.impact || '').trim(),
      recommendation: String(f.recommendation || '').trim(),
      recommendation_status: 'pending_human_review',
      confidence: f.confidence,
    });
  }
  const order = { high: 0, medium: 1, low: 2 };
  kept.sort((a, b) => order[a.severity] - order[b.severity] || a.step - b.step);
  return { findings: kept, rejected };
}

// الدرجة من 5 تُحسب من الملاحظات عالية الثقة وذات الدليل فقط
export function computeScore(findings, lang = 'ar') {
  const counted = findings.filter((f) => f.confidence === 'high' && f.evidence);
  const penalty = counted.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0);
  return {
    score: Math.round(Math.max(0, 5 - penalty) * 10) / 10,
    counted_findings: counted.length,
    method: t(lang, 'score.method'),
  };
}

function uniq(arr) {
  return [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))];
}

// ---------- التجميع النهائي ----------

export async function analyze(input, collected, { recordedAnalysis = null, onProgress = () => {} } = {}) {
  const analyticsChecks = checkAnalytics(input.expected_events, collected);
  const det = deterministicAnalytics(analyticsChecks, collected, input.lang);
  const warnings = collectWarnings(collected, input.lang);

  // القواعد الآلية تعمل دائمًا (ما عدا بيانات التجربة المسجلة) ولا تحتاج نموذجًا
  const rules = recordedAnalysis ? { findings: [], insufficient: [] } : ruleFindings(input, collected);
  const L = input.lang;
  const RULES_NOTICE = t(L, 'notice.rules');

  let mode = 'rules';
  let notice = RULES_NOTICE;
  let modelOut = null;

  if (recordedAnalysis) {
    mode = 'recorded_demo';
    modelOut = recordedAnalysis;
    notice = t(L, 'notice.demo');
  } else if (modelConfigured()) {
    onProgress(t(L, 'progress.model'));
    try {
      modelOut = await callModel(input, collected, analyticsChecks, rules.findings);
      mode = 'model';
      notice = null;
    } catch (e) {
      notice = t(L, 'notice.model_failed', { msg: String(e.message || e).split('\n')[0] }) + RULES_NOTICE;
    }
  }

  let completed;
  let stoppedAt;
  const insufficient = [...det.insufficient, ...rules.insufficient];
  let findings = [...rules.findings];
  let score = null;
  let scoring = null;
  let missing = det.missing;
  let successBasis = null;

  const hasCondition = Boolean(input.success_condition);
  const auto = Boolean(collected.auto_explored);
  const noConditionNote = auto
    ? t(L, 'ins.no_condition_auto')
    : t(L, 'ins.no_condition');
  const validStep = (s) => Number.isInteger(s) && s >= 0 && s <= input.steps.length;

  if (collected.source === 'url') {
    // توقف فعلي (فشل فتح الموقع أو فشل خطوة مكتوبة) يعني أن الرحلة لم تكتمل
    completed = collected.all_steps_executed ? (hasCondition && !auto ? true : null) : false;
    stoppedAt = collected.stopped_at_step;
  } else {
    completed = null;
    stoppedAt = null;
  }

  if (modelOut) {
    const { findings: kept, rejected } = validateFindings(modelOut.findings, collected, input);
    findings = [...findings, ...kept.map((f) => ({ ...f, origin: mode === 'recorded_demo' ? 'recorded' : 'model' }))];
    insufficient.push(...(modelOut.insufficient_evidence || []), ...rejected);
    successBasis = hasCondition ? modelOut.success_condition_basis || null : null;

    if (collected.source === 'url') {
      if (completed !== false) {
        if (!hasCondition) {
          completed = null;
          insufficient.push(noConditionNote);
        } else if (modelOut.success_condition_met === 'yes') {
          completed = true;
        } else if (modelOut.success_condition_met === 'no') {
          completed = false;
          stoppedAt = validStep(modelOut.stopped_at_step) ? modelOut.stopped_at_step : auto ? null : input.steps.length;
        } else if (auto) {
          completed = null;
          insufficient.push(t(L, 'ins.auto_unknown'));
        } else {
          insufficient.push(t(L, 'ins.steps_unknown'));
        }
      }
    } else if (modelOut.journey_state === 'completed' && modelOut.success_condition_met !== 'no') {
      completed = true;
    } else if (modelOut.journey_state === 'stopped' || modelOut.success_condition_met === 'no') {
      completed = false;
      stoppedAt = validStep(modelOut.stopped_at_step) ? modelOut.stopped_at_step : null;
    } else {
      insufficient.push(t(L, 'ins.files_unknown'));
    }

    // النموذج يحسّن وصف الأحداث الناقصة، لكن لا يضيف حدثًا ظهر في الدليل ولا حدثًا غير متوقع
    const byName = new Map((modelOut.missing_analytics_events || []).map((e) => [e.event_name, e]));
    missing = det.missing.map((m) => {
      const e = byName.get(m.event_name);
      return e ? { event_name: m.event_name, when: e.when || m.when, why: e.why || m.why } : m;
    });

  } else {
    if (collected.source === 'url' && collected.all_steps_executed) {
      if (!hasCondition) insufficient.push(noConditionNote);
      else if (auto) insufficient.push(t(L, 'ins.auto_condition_model'));
      else insufficient.push(t(L, 'ins.steps_condition_model'));
    }
    if (collected.source === 'file') insufficient.push(t(L, 'ins.files_model'));
    for (const f of collected.files || [])
      if (f.kind === 'image') insufficient.push(t(L, 'ins.image_model', { file: f.file }));
  }

  const order = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.step - b.step);
  scoring = computeScore(findings, L);
  score = scoring.score;

  const result = {
    product_name: input.product_name,
    journey: input.journey,
    source: collected.source,
    completed,
    stopped_at_step: completed ? null : stoppedAt,
    score_out_of_5: score,
    findings,
    missing_analytics_events: missing,
    insufficient_evidence: uniq(insufficient),
    meta: {
      created_at: new Date().toISOString(),
      lang: L,
      analysis_mode: mode,
      model: mode === 'model' ? config.model : null,
      notice,
      auto_explored: Boolean(collected.auto_explored),
      success_condition: input.success_condition,
      success_condition_basis: successBasis,
      scoring,
      steps: input.steps,
      expected_features: input.expected_features,
      expected_events: input.expected_events,
      analytics_checks: analyticsChecks,
      warnings,
    },
    collected_evidence: publicEvidence(collected),
  };
  result.meta.executive_summary = executiveSummary(result, L);
  return result;
}

function collectWarnings(collected, lang) {
  const w = [];
  if (collected.source === 'file') {
    for (const f of collected.files) {
      if (f.content && f.content.truncated)
        w.push(t(lang, 'warn.truncated', { file: f.file, sent: f.content.text.length, total: f.content.total_chars }));
      if (f.har && f.har.truncated) w.push(t(lang, 'warn.har_truncated', { file: f.file, total: f.har.total_entries }));
      if (f.too_large_for_model) w.push(t(lang, 'warn.image_large', { file: f.file }));
      if (f.kind === 'unreadable') w.push(f.error + ` (${f.file})`);
    }
  }
  return w;
}

// نسخة من الدليل للعرض (بدون مسارات داخلية على القرص)
function publicEvidence(collected) {
  if (collected.source === 'url') return collected;
  return { ...collected, files: collected.files.map(({ image_path, ...rest }) => rest) };
}
