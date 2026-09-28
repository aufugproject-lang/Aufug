(() => {
  const CRITERION = {
    UX: 'تجربة الاستخدام',
    CX: 'تجربة العميل',
    navigation: 'التنقل',
    accessibility: 'إمكانية الوصول',
    feature_completeness: 'اكتمال الميزات',
    friction: 'الاحتكاك',
    analytics: 'التحليلات',
  };
  const LEVEL = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };
  const STEP_STATUS = { done: 'نُفذت', failed: 'تعذر تنفيذها', not_run: 'لم تُنفذ' };

  const app = document.getElementById('app');
  const id = new URLSearchParams(location.search).get('id');

  // بناء عناصر DOM بأمان (بدون innerHTML لنصوص الدليل)
  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return el;
  }

  function stepText(r, n) {
    if (n === 0) return 'الصفحة الأولى / عام';
    const s = (r.meta.steps || []).find((x) => x.number === n);
    return s ? s.text : '';
  }

  function completion(r) {
    if (r.completed === true && r.meta.analysis_mode === 'evidence_only') return { text: 'نُفذت كل الخطوات', cls: 'unknown' };
    if (r.completed === true) return { text: 'نعم، اكتملت', cls: 'ok' };
    if (r.completed === false) return { text: 'لا، لم تكتمل', cls: 'bad' };
    return { text: 'غير محدد', cls: 'unknown' };
  }

  function render(r) {
    document.title = `نتائج — ${r.product_name}`;
    app.innerHTML = '';
    const counts = { high: 0, medium: 0, low: 0 };
    r.findings.forEach((f) => counts[f.severity]++);
    const comp = completion(r);

    app.append(
      h('div', { class: 'results-head' },
        h('div', {},
          h('p', { class: 'eyebrow' }, r.source === 'url' ? 'مصدر الدليل: رابط الموقع' : 'مصدر الدليل: ملفات مرفقة'),
          h('h1', {}, r.product_name),
          h('p', { class: 'lead' }, `الرحلة: ${r.journey}`),
        ),
        h('a', { class: 'primary button', href: `/api/results/${encodeURIComponent(r.id)}/report.pdf` }, 'تحميل التقرير بصيغة PDF'),
      ),
    );

    if (r.meta.notice)
      app.append(h('div', { class: `notice ${r.meta.analysis_mode === 'recorded_demo' ? 'info' : 'warn'}`, role: 'status' }, r.meta.notice));

    app.append(
      h('div', { class: 'stats' },
        h('div', { class: 'stat' },
          h('span', { class: 'label' }, 'الدرجة'),
          h('span', { class: 'value' }, r.score_out_of_5 == null ? '—' : String(r.score_out_of_5), h('small', {}, ' / 5')),
          h('span', { class: 'sub' }, r.meta.scoring ? `من ${r.meta.scoring.counted_findings} ملاحظة عالية الثقة` : 'تحتاج حكم النموذج'),
        ),
        h('div', { class: 'stat' },
          h('span', { class: 'label' }, 'هل اكتملت الرحلة؟'),
          h('span', { class: `value ${comp.cls}` }, comp.text),
          h('span', { class: 'sub' }, `شرط النجاح: ${r.meta.success_condition}`),
        ),
        h('div', { class: 'stat' },
          h('span', { class: 'label' }, 'أين توقفت'),
          h('span', { class: 'value' }, r.stopped_at_step == null ? '—' : `الخطوة ${r.stopped_at_step}`),
          h('span', { class: 'sub' }, r.stopped_at_step == null ? (r.completed ? 'لم تتوقف' : 'غير معروف') : stepText(r, r.stopped_at_step)),
        ),
        h('div', { class: 'stat' },
          h('span', { class: 'label' }, 'الملاحظات'),
          h('span', { class: 'value' }, String(r.findings.length)),
          h('span', { class: 'sub' },
            h('span', { class: 'sev sev-high' }, `عالية ${counts.high}`), ' · ',
            h('span', { class: 'sev sev-medium' }, `متوسطة ${counts.medium}`), ' · ',
            h('span', { class: 'sev sev-low' }, `منخفضة ${counts.low}`),
          ),
        ),
      ),
    );
    if (r.meta.success_condition_basis) app.append(h('p', { class: 'muted basis' }, `أساس الحكم على شرط النجاح: ${r.meta.success_condition_basis}`));

    // جدول الملاحظات
    const findingsSection = h('section', { class: 'panel' }, h('h2', {}, 'جدول الملاحظات'));
    if (r.findings.length) {
      findingsSection.append(
        h('p', { class: 'muted' }, 'التوصيات مقترحات للمراجعة البشرية قبل اعتمادها.'),
        h('div', { class: 'table-wrap' },
          h('table', { class: 'grid' },
            h('thead', {}, h('tr', {}, ['المعيار', 'الشدة', 'الخطوة', 'الدليل', 'الأثر', 'التوصية المقترحة', 'الثقة'].map((t) => h('th', {}, t)))),
            h('tbody', {},
              r.findings.map((f) =>
                h('tr', {},
                  h('td', {}, CRITERION[f.criterion] || f.criterion, h('div', { class: 'code' }, f.criterion)),
                  h('td', {}, h('span', { class: `badge sev-${f.severity}` }, LEVEL[f.severity])),
                  h('td', {}, String(f.step), h('div', { class: 'muted small' }, stepText(r, f.step))),
                  h('td', {}, f.evidence, h('div', { class: 'muted small' }, 'المصدر: ', h('bdi', {}, f.evidence_source))),
                  h('td', {}, f.impact),
                  h('td', {}, f.recommendation, h('div', { class: 'review' }, 'بانتظار مراجعة بشرية')),
                  h('td', {}, LEVEL[f.confidence]),
                ),
              ),
            ),
          ),
        ),
      );
    } else {
      findingsSection.append(
        h('p', { class: 'empty' }, r.meta.analysis_mode === 'evidence_only' ? 'لا توجد ملاحظات: الحكم الآلي يحتاج إعداد النموذج.' : 'لم تُسجل ملاحظات مبنية على الدليل.'),
      );
    }
    app.append(findingsSection);

    // أحداث التحليلات
    const ev = h('section', { class: 'panel' }, h('h2', {}, 'أحداث التحليلات الناقصة'));
    if (r.missing_analytics_events.length) {
      ev.append(
        h('div', { class: 'table-wrap' },
          h('table', { class: 'grid' },
            h('thead', {}, h('tr', {}, h('th', {}, 'اسم الحدث'), h('th', {}, 'متى'), h('th', {}, 'لماذا'))),
            h('tbody', {}, r.missing_analytics_events.map((e) => h('tr', {}, h('td', { class: 'code' }, e.event_name), h('td', {}, e.when), h('td', {}, e.why)))),
          ),
        ),
      );
    } else ev.append(h('p', { class: 'empty' }, 'لا توجد أحداث ناقصة مؤكدة من الدليل.'));
    const observed = (r.meta.analytics_checks || []).filter((c) => c.observed);
    if (observed.length)
      ev.append(h('p', { class: 'muted small' }, 'ظهرت في الدليل: ', observed.map((c, i) => [i ? '، ' : '', h('bdi', { class: 'code' }, c.event_name), ` (${c.observed_in})`])));
    app.append(ev);

    // الدليل غير الكافي
    app.append(
      h('section', { class: 'panel' },
        h('h2', {}, 'بنود الدليل غير الكافي'),
        r.insufficient_evidence.length ? h('ul', { class: 'list' }, r.insufficient_evidence.map((s) => h('li', {}, s))) : h('p', { class: 'empty' }, 'لا توجد بنود.'),
      ),
    );

    if (r.meta.warnings && r.meta.warnings.length)
      app.append(h('section', { class: 'panel' }, h('h2', {}, 'تنبيهات الجمع'), h('ul', { class: 'list' }, r.meta.warnings.map((s) => h('li', {}, s)))));

    app.append(renderEvidence(r));

    app.append(
      h('details', { class: 'panel raw' },
        h('summary', {}, 'JSON الداخلي'),
        h('pre', { dir: 'ltr' }, JSON.stringify({ ...r, collected_evidence: undefined }, null, 2)),
      ),
    );
  }

  function renderEvidence(r) {
    const c = r.collected_evidence;
    const sec = h('section', { class: 'panel' }, h('h2', {}, 'الدليل المجموع'));
    if (!c) return sec;
    if (c.source === 'url') {
      c.steps.forEach((s) => {
        const p = s.page || {};
        const failedNet = (s.network || []).filter((n) => n.failure || (n.status && n.status >= 400));
        sec.append(
          h('details', { class: `step ${s.status}` },
            h('summary', {},
              h('span', { class: 'step-no' }, String(s.number)),
              h('span', {}, s.text),
              h('span', { class: `tag ${s.status}` }, STEP_STATUS[s.status] || s.status),
            ),
            s.error ? h('p', { class: 'err' }, s.error) : null,
            s.action_result ? h('p', { class: 'muted' }, `الإجراء: ${s.action_result}`) : null,
            p.url ? h('p', { class: 'small' }, 'الصفحة: ', h('bdi', { class: 'code' }, p.url), p.title ? ` — ${p.title}` : '') : null,
            p.error_messages && p.error_messages.length ? h('div', {}, h('h4', {}, 'رسائل الخطأ'), h('ul', {}, p.error_messages.map((m) => h('li', {}, m)))) : null,
            p.buttons && p.buttons.length
              ? h('div', {}, h('h4', {}, 'الأزرار والروابط الظاهرة'), h('p', { class: 'chips' }, p.buttons.slice(0, 40).map((b) => h('span', { class: `chip ${b.disabled ? 'disabled' : ''}` }, b.text || '(بلا نص)'))))
              : null,
            h('div', {}, h('h4', {}, `أحداث الشبكة (${(s.network || []).length})`),
              failedNet.length ? h('ul', { class: 'net' }, failedNet.map((n) => h('li', { dir: 'ltr' }, `${n.method} ${n.status ?? n.failure} ${n.url}`))) : h('p', { class: 'muted small' }, 'لا طلبات فاشلة.'),
            ),
            s.console_errors && s.console_errors.length ? h('div', {}, h('h4', {}, 'أخطاء الكونسول'), h('ul', { class: 'net' }, s.console_errors.map((m) => h('li', { dir: 'ltr' }, m)))) : null,
            p.visible_text ? h('details', {}, h('summary', {}, 'النص الظاهر'), h('p', { class: 'visible-text' }, p.visible_text)) : null,
          ),
        );
      });
    } else {
      c.files.forEach((f) => {
        const body = [];
        if (f.error) body.push(h('p', { class: 'err' }, f.error));
        if (f.har) {
          const failed = f.har.requests.filter((q) => q.status === 0 || q.status == null || q.status >= 400);
          body.push(h('p', {}, `${f.har.total_entries} طلب شبكة، منها ${failed.length} فاشل.`));
          if (failed.length) body.push(h('ul', { class: 'net' }, failed.map((q) => h('li', { dir: 'ltr' }, `${q.method} ${q.status} ${q.url}`))));
        }
        if (f.html) {
          if (f.html.error_messages.length) body.push(h('h4', {}, 'رسائل الخطأ'), h('ul', {}, f.html.error_messages.map((m) => h('li', {}, m))));
          body.push(h('h4', {}, 'الأزرار والروابط'), h('p', { class: 'chips' }, f.html.buttons.map((b) => h('span', { class: 'chip' }, b.text || '(بلا نص)'))));
          if (f.html.accessibility.unlabeled_fields.length)
            body.push(h('p', { class: 'small' }, 'حقول بلا تسمية: ', h('bdi', { class: 'code' }, f.html.accessibility.unlabeled_fields.join(', '))));
          body.push(h('details', {}, h('summary', {}, 'النص الظاهر'), h('p', { class: 'visible-text' }, f.html.visible_text.text)));
        }
        if (f.content) body.push(h('pre', { class: 'file-content', dir: 'auto' }, f.content.text.slice(0, 3000)));
        if (f.kind === 'image') body.push(h('p', { class: 'muted' }, f.dimensions ? `صورة ${f.dimensions.width}×${f.dimensions.height}` : 'صورة'));
        sec.append(
          h('details', { class: 'step' },
            h('summary', {}, h('bdi', { class: 'code' }, f.file), h('span', { class: 'tag' }, f.type), h('span', { class: 'muted small' }, `${Math.ceil(f.size_bytes / 1024)} KB`)),
            body,
          ),
        );
      });
    }
    return sec;
  }

  if (!id) {
    app.innerHTML = '';
    app.append(h('p', { class: 'err' }, 'لا يوجد معرّف نتيجة في الرابط.'));
    return;
  }
  fetch(`/api/results/${encodeURIComponent(id)}`)
    .then(async (res) => {
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'تعذر تحميل النتيجة.');
      render(body);
    })
    .catch((e) => {
      app.innerHTML = '';
      app.append(h('p', { class: 'err' }, e.message));
    });
})();
