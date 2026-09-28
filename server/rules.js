// محلل بقواعد ثابتة: يعمل دائمًا، بدون نموذج ذكاء اصطناعي.
// كل ملاحظة هنا مشتقة مباشرة من عنصر محدد في الدليل المجموع، ولا تُبنى على افتراضات.
// ما لا تستطيع القواعد الحكم عليه (جودة المحتوى، اكتمال الميزات، الصور) يذهب إلى insufficient_evidence.

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

const list = (arr, n = 5) => {
  const shown = arr.slice(0, n).join('، ');
  return arr.length > n ? `${shown} و${arr.length - n} غيرها` : shown;
};

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

// ---------- قواعد مشتركة لصفحة (لقطة من المتصفح أو ملف HTML) ----------

function pageRules(page, ctx, out) {
  const { step, source, seenPages } = ctx; // ctx مشترك عبر الصفحات حتى لا تتكرر ملاحظات الوصول
  const pageKey = page.url || source;

  // رسالة الخطأ نفسها قد تبقى ظاهرة عبر عدة خطوات؛ تُسجل عند أول ظهور فقط
  ctx.seenErrors ||= new Set();
  const newErrors = (page.error_messages || []).filter((m) => !ctx.seenErrors.has(m));
  newErrors.forEach((m) => ctx.seenErrors.add(m));
  if (newErrors.length) {
    out.push({
      rule: 'visible_error',
      criterion: 'UX',
      severity: 'medium',
      confidence: 'medium',
      step,
      source,
      evidence: `ظهرت رسائل خطأ في الصفحة: «${list(newErrors, 3)}».`,
      impact: 'المستخدم يواجه خطأ ظاهرًا أثناء الرحلة وقد لا يعرف كيف يكمل.',
      recommendation: 'راجع سبب الرسالة، واكتبها بلغة واضحة تذكر ما حدث وما الخطوة التالية.',
    });
  }

  // ملاحظات الوصول تُسجل مرة واحدة لكل صفحة حتى لا تتكرر مع كل خطوة
  if (seenPages.has(pageKey)) return;
  seenPages.add(pageKey);
  const a = page.accessibility || {};
  if (a.unlabeled_fields && a.unlabeled_fields.length) {
    out.push({
      rule: 'unlabeled_fields',
      criterion: 'accessibility',
      severity: 'medium',
      confidence: 'high',
      step,
      source,
      evidence: `حقول إدخال بلا تسمية (label أو aria-label): ${list(a.unlabeled_fields)}.`,
      impact: 'مستخدمو قارئات الشاشة لا يعرفون غرض الحقل، فيكملون التعبئة بصعوبة.',
      recommendation: 'اربط كل حقل بعنصر label ظاهر أو أضف aria-label يصف الحقل.',
    });
  }
  if (a.unnamed_buttons > 0) {
    out.push({
      rule: 'unnamed_buttons',
      criterion: 'accessibility',
      severity: 'medium',
      confidence: 'high',
      step,
      source,
      evidence: `${a.unnamed_buttons} زر بلا اسم نصي أو aria-label.`,
      impact: 'قارئ الشاشة يعلن الزر بلا وصف، فلا يعرف المستخدم ما يفعله.',
      recommendation: 'أضف نصًا ظاهرًا أو aria-label لكل زر أيقونة.',
    });
  }
  if (a.images_without_alt > 0) {
    out.push({
      rule: 'images_without_alt',
      criterion: 'accessibility',
      severity: 'low',
      confidence: 'high',
      step,
      source,
      evidence: `${a.images_without_alt} صورة بلا خاصية alt.`,
      impact: 'المحتوى البصري غير متاح لمستخدمي قارئات الشاشة، دون أن يوقف المهمة.',
      recommendation: 'أضف alt وصفيًا للصور ذات المعنى، و alt فارغًا للصور الزخرفية.',
    });
  }
  if (page.lang === '' && !ctx.langReported) {
    ctx.langReported = true;
    out.push({
      rule: 'missing_lang',
      criterion: 'accessibility',
      severity: 'low',
      confidence: 'high',
      step,
      source,
      evidence: 'عنصر html بلا خاصية lang.',
      impact: 'قارئات الشاشة قد تنطق المحتوى بلغة خاطئة.',
      recommendation: 'أضف lang="ar" (أو لغة الصفحة الفعلية) إلى عنصر html.',
    });
  }
}

// ---------- وضع الرابط ----------

function urlRules(input, collected, out, insufficient) {
  const ctx = { seenPages: new Set(), langReported: false };
  const base = collected.target_url;
  for (const s of collected.steps) {
    const source = `step:${s.number}`;
    const step = s.number;

    if (s.status === 'failed') {
      if (s.number === 0) {
        out.push({
          rule: 'site_unreachable',
          criterion: 'friction',
          severity: 'high',
          confidence: 'high',
          step,
          source,
          evidence: `تعذر فتح الرابط: ${s.error}`,
          impact: 'لا يمكن بدء الرحلة أصلًا.',
          recommendation: 'تأكد أن بيئة الاختبار تعمل ومتاحة من الشبكة، ثم أعد التحليل.',
        });
      } else if (s.auto && /أعادت الحالة (\d+)/.test(s.error || '')) {
        const code = Number(s.error.match(/أعادت الحالة (\d+)/)[1]);
        out.push({
          rule: 'broken_link',
          criterion: 'navigation',
          severity: code >= 500 ? 'high' : 'medium',
          confidence: 'high',
          step,
          source,
          evidence: `رابط التنقل ${s.text.replace(/^افتح\s*/, "")} يؤدي إلى صفحة أعادت الحالة ${code}.`,
          impact: code >= 500 ? 'خطأ خادم يمنع الوصول إلى الصفحة.' : 'المستخدم يصل إلى صفحة غير موجودة ويضطر للرجوع.',
          recommendation: 'أصلح الرابط أو الصفحة الهدف، أو أزل الرابط من التنقل.',
        });
      } else if (s.auto) {
        out.push({
          rule: 'auto_step_failed',
          criterion: 'friction',
          severity: /تسجيل الدخول/.test(s.text) ? 'high' : 'medium',
          confidence: 'medium',
          step,
          source,
          evidence: `تعذر «${s.text}»: ${s.error}`,
          impact: 'المستخدم قد لا يستطيع إكمال هذه الخطوة.',
          recommendation: 'تحقق يدويًا من الخطوة؛ إن كانت الأداة لم تتعرف على العناصر فاكتب خطوات الرحلة صراحة.',
        });
      } else if (!s.action) {
        insufficient.push(`الخطوة ${s.number} «${s.text}» مكتوبة بصيغة لا ينفذها المتصفح الآلي، فتوقفت الرحلة عندها دون حكم على المنتج.`);
      } else {
        out.push({
          rule: 'journey_step_failed',
          criterion: 'friction',
          severity: 'high',
          confidence: /لم يُعثر على/.test(s.error || '') ? 'medium' : 'high',
          step,
          source,
          evidence: `تعذر تنفيذ الخطوة «${s.text}»: ${s.error}`,
          impact: 'الرحلة لا تكتمل عند هذه الخطوة.',
          recommendation: 'تحقق من ظهور العنصر المطلوب بالنص نفسه، ومن عدم وجود خطأ يمنع الانتقال.',
        });
      }
    }

    // طلبات الشبكة الفاشلة من نفس الموقع (بدون الملفات الثابتة)
    const failed = (s.network || []).filter(
      (n) => sameOrigin(n.url, base) && !ASSET_RE.test(n.url) && n.status && n.status >= 400 && !(s.status === 'failed' && n.type === 'document'),
    );
    const serverErr = failed.filter((n) => n.status >= 500);
    const clientErr = failed.filter((n) => n.status < 500 && n.status !== 401 && n.status !== 403);
    if (serverErr.length) {
      const writes = serverErr.some((n) => n.method !== 'GET');
      out.push({
        rule: 'server_error',
        criterion: 'friction',
        severity: writes ? 'high' : 'medium',
        confidence: 'high',
        step,
        source,
        evidence: `طلبات أعادت خطأ خادم: ${list(serverErr.map((n) => `${n.method} ${pathOf(n.url)} → ${n.status}`), 4)}.`,
        impact: writes ? 'بيانات أرسلها المستخدم لم تُحفظ، فقد تضيع أو تتوقف الرحلة.' : 'جزء من محتوى الصفحة لم يُحمّل.',
        recommendation: 'راجع سجلات الخادم لهذه الطلبات، وأظهر للمستخدم رسالة واضحة مع إمكانية إعادة المحاولة.',
      });
    }
    if (clientErr.length) {
      out.push({
        rule: 'client_error',
        criterion: 'friction',
        severity: 'medium',
        confidence: 'medium',
        step,
        source,
        evidence: `طلبات أعادت أخطاء 4xx: ${list(clientErr.map((n) => `${n.method} ${pathOf(n.url)} → ${n.status}`), 4)}.`,
        impact: 'وظيفة في الصفحة قد لا تعمل كما يتوقع المستخدم.',
        recommendation: 'تحقق من صحة الطلبات ومساراتها، ومن معالجة الرد في الواجهة.',
      });
    }

    const jsErrors = (s.console_errors || []).filter((m) => !/Failed to load resource/i.test(m));
    if (jsErrors.length) {
      out.push({
        rule: 'js_errors',
        criterion: 'UX',
        severity: 'low',
        confidence: 'medium',
        step,
        source,
        evidence: `أخطاء JavaScript في الكونسول: ${list(jsErrors.map((m) => `«${m.slice(0, 120)}»`), 3)}.`,
        impact: 'قد تتعطل عناصر تفاعلية في الصفحة دون أن يظهر ذلك للمستخدم مباشرة.',
        recommendation: 'أصلح الأخطاء البرمجية الظاهرة في الكونسول وتحقق من أثرها على الواجهة.',
      });
    }

    // صفحة رابط معطوب ليست صفحة من المنتج، فلا تُفحص
    if (s.page && !s.page.snapshot_error && !(s.auto && s.status === 'failed')) {
      ctx.step = step;
      ctx.source = source;
      pageRules(s.page, ctx, out);
    }
  }
}

// ---------- وضع الملفات ----------

function fileRules(input, collected, out, insufficient) {
  const ctx = { seenPages: new Set(), langReported: false };
  for (const f of collected.files) {
    const source = `file:${f.file}`;
    if (f.har) {
      const reqs = f.har.requests.filter((r) => !ASSET_RE.test(r.url));
      const serverErr = reqs.filter((r) => r.status >= 500);
      const clientErr = reqs.filter((r) => r.status >= 400 && r.status < 500 && r.status !== 401 && r.status !== 403);
      if (serverErr.length) {
        const writes = serverErr.some((r) => r.method !== 'GET');
        out.push({
          rule: 'server_error',
          criterion: 'friction',
          severity: writes ? 'high' : 'medium',
          confidence: 'high',
          step: 0,
          source,
          evidence: `طلبات أعادت خطأ خادم: ${list(serverErr.map((r) => `${r.method} ${pathOf(r.url)} → ${r.status}${r.response_excerpt ? ` ${r.response_excerpt.slice(0, 80)}` : ''}`), 4)}.`,
          impact: writes ? 'بيانات أرسلها المستخدم لم تُحفظ، فقد تضيع أو تتوقف الرحلة.' : 'جزء من المحتوى لم يُحمّل.',
          recommendation: 'راجع سجلات الخادم لهذه الطلبات، وأظهر للمستخدم رسالة واضحة مع إمكانية إعادة المحاولة.',
        });
      }
      if (clientErr.length) {
        out.push({
          rule: 'client_error',
          criterion: 'friction',
          severity: 'medium',
          confidence: 'medium',
          step: 0,
          source,
          evidence: `طلبات أعادت أخطاء 4xx: ${list(clientErr.map((r) => `${r.method} ${pathOf(r.url)} → ${r.status}`), 4)}.`,
          impact: 'وظيفة قد لا تعمل كما يتوقع المستخدم.',
          recommendation: 'تحقق من صحة الطلبات ومساراتها، ومن معالجة الرد في الواجهة.',
        });
      }
    } else if (f.html) {
      ctx.step = 0;
      ctx.source = source;
      pageRules({ ...f.html, url: source }, ctx, out);
    } else if (f.kind === 'text' && f.type === 'txt') {
      const errs = f.content.text.split(/\r?\n/).filter((l) => /(Uncaught|TypeError|ReferenceError|Exception|\bError\b)/.test(l));
      if (errs.length) {
        out.push({
          rule: 'log_errors',
          criterion: 'UX',
          severity: 'low',
          confidence: 'medium',
          step: 0,
          source,
          evidence: `أسطر أخطاء في السجل: ${list(errs.map((l) => `«${l.trim().slice(0, 120)}»`), 3)}.`,
          impact: 'أخطاء تقنية قد تعطل أجزاء من الرحلة.',
          recommendation: 'تتبع هذه الأخطاء وأصلحها، وتحقق من أثرها على ما يراه المستخدم.',
        });
      }
    }
  }
  insufficient.push('ربط الملاحظات الآلية بخطوات الرحلة غير ممكن من الملفات بالقواعد وحدها؛ سُجلت على الخطوة 0 (عام).');
}

export function ruleFindings(input, collected) {
  const raw = [];
  const insufficient = [];
  if (collected.source === 'url') urlRules(input, collected, raw, insufficient);
  else fileRules(input, collected, raw, insufficient);
  if (input.expected_features.length)
    insufficient.push('مقارنة القصص والميزات المتوقعة بما ظهر في الموقع تحتاج حكم النموذج؛ القواعد الآلية لا تحكم عليها.');
  const order = { high: 0, medium: 1, low: 2 };
  const findings = raw.map((f) => finding(input, f)).sort((a, b) => order[a.severity] - order[b.severity] || a.step - b.step);
  return { findings, insufficient };
}
