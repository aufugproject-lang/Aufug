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
    const el = tag === 'svg' || tag === 'circle' ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.setAttribute('class', v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return el;
  }

  // يعزل المقاطع اللاتينية (مسارات، أسماء أحداث، أكواد) داخل النص العربي حتى لا ينقلب ترتيبها
  const LATIN_RUN = /([A-Za-z0-9_/{"'][A-Za-z0-9_.,:;/\-=?&%#{}()"'\[\] ]*[A-Za-z0-9_}"'\]/]|[A-Za-z0-9_])/;
  const bd = (text) =>
    String(text ?? '')
      .split(LATIN_RUN)
      .map((part, i) => (i % 2 ? h('bdi', {}, part) : part))
      .filter((x) => x !== '');

  const stepText = (r, n) => {
    if (n === 0) return 'الصفحة الأولى / عام';
    const s = (r.meta.steps || []).find((x) => x.number === n);
    return s ? s.text : '';
  };

  function completion(r) {
    if (r.completed === true && ['evidence_only', 'rules'].includes(r.meta.analysis_mode)) return { text: 'نُفذت الخطوات', cls: 'unknown', icon: '•' };
    if (r.completed === true) return { text: 'اكتملت', cls: 'ok', icon: '✓' };
    if (r.completed === false) return { text: 'لم تكتمل', cls: 'bad', icon: '✕' };
    return { text: 'غير محدد', cls: 'unknown', icon: '?' };
  }

  function scoreRing(score) {
    const r = 42;
    const c = 2 * Math.PI * r;
    const pct = score == null ? 0 : Math.max(0, Math.min(1, score / 5));
    const tone = score == null ? 'none' : score >= 4 ? 'good' : score >= 2.5 ? 'mid' : 'bad';
    return h('div', { class: `ring ring-${tone}` },
      h('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' },
        h('circle', { cx: 50, cy: 50, r, class: 'track' }),
        h('circle', { cx: 50, cy: 50, r, class: 'bar', 'stroke-dasharray': `${c * pct} ${c}` }),
      ),
      h('div', { class: 'ring-label' }, h('strong', {}, score == null ? '—' : String(score)), h('small', {}, 'من 5')),
    );
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return iso;
    }
  }

  function render(r) {
    document.title = `نتائج — ${r.product_name}`;
    app.innerHTML = '';
    const counts = { high: 0, medium: 0, low: 0 };
    r.findings.forEach((f) => counts[f.severity]++);
    const total = r.findings.length || 1;
    const comp = completion(r);
    const auto = r.meta.auto_explored;

    // الترويسة
    app.append(
      h('section', { class: 'result-hero' },
        h('div', { class: 'rh-text' },
          h('div', { class: 'chips' },
            h('span', { class: 'chip-soft' }, r.source === 'url' ? (auto ? 'رابط · استكشاف تلقائي' : 'رابط · رحلة مكتوبة') : 'ملفات مرفقة'),
            h('span', { class: 'chip-soft' }, formatDate(r.meta.created_at)),
            r.meta.analysis_mode === 'model' ? h('span', { class: 'chip-soft ok' }, 'حكم آلي بالنموذج') : null,
            r.meta.analysis_mode === 'recorded_demo' ? h('span', { class: 'chip-soft info' }, 'بيانات تجربة') : null,
            r.meta.analysis_mode === 'rules' ? h('span', { class: 'chip-soft' }, 'تحليل بقواعد آلية') : null,
            r.meta.analysis_mode === 'evidence_only' ? h('span', { class: 'chip-soft warn' }, 'دليل فقط') : null,
          ),
          h('h1', {}, r.product_name),
          h('p', { class: 'lead' }, 'الرحلة: ', h('strong', {}, r.journey)),
        ),
        h('div', { class: 'rh-actions' },
          h('a', { class: 'button primary big', href: `/api/results/${encodeURIComponent(r.id)}/report.pdf` }, '⤓ تحميل التقرير بصيغة PDF'),
        ),
      ),
    );

    if (r.meta.notice)
      app.append(h('div', { class: `notice ${['recorded_demo', 'rules'].includes(r.meta.analysis_mode) && !/تعذر/.test(r.meta.notice) ? 'info' : 'warn'}`, role: 'status' }, r.meta.notice));

    // الملخص
    app.append(
      h('section', { class: 'summary' },
        h('div', { class: 'card score-card' },
          scoreRing(r.score_out_of_5),
          h('div', {},
            h('span', { class: 'label' }, 'الدرجة'),
            h('p', { class: 'sub' }, r.meta.scoring ? `محسوبة من ${r.meta.scoring.counted_findings} ملاحظة عالية الثقة وذات دليل.` : 'تُحسب بعد حكم النموذج.'),
          ),
        ),
        h('div', { class: `card status-card ${comp.cls}` },
          h('span', { class: 'label' }, 'هل اكتملت الرحلة؟'),
          h('div', { class: 'status-line' }, h('span', { class: 'status-icon' }, comp.icon), h('strong', {}, comp.text)),
          h('p', { class: 'sub' }, r.meta.success_condition ? `شرط النجاح: ${r.meta.success_condition}` : 'لم يُحدد شرط نجاح.'),
        ),
        h('div', { class: 'card' },
          h('span', { class: 'label' }, 'أين توقفت'),
          h('div', { class: 'status-line' }, h('strong', {}, r.stopped_at_step == null ? '—' : `الخطوة ${r.stopped_at_step}`)),
          h('p', { class: 'sub' }, r.stopped_at_step == null ? (r.completed ? 'لم تتوقف الرحلة.' : 'لا توجد نقطة توقف مؤكدة.') : stepText(r, r.stopped_at_step)),
        ),
        h('div', { class: 'card' },
          h('span', { class: 'label' }, 'الملاحظات حسب الشدة'),
          h('div', { class: 'status-line' }, h('strong', {}, String(r.findings.length)), h('small', { class: 'muted' }, ' ملاحظة')),
          h('div', { class: 'sevbar', 'aria-hidden': 'true' },
            ['high', 'medium', 'low'].map((s) => (counts[s] ? h('span', { class: `seg-${s}`, style: `flex:${counts[s] / total}` }) : null)),
          ),
          h('div', { class: 'sev-legend' },
            ['high', 'medium', 'low'].map((s) => h('span', {}, h('i', { class: `dot-${s}` }), `${LEVEL[s]} ${counts[s]}`)),
          ),
        ),
      ),
    );
    if (r.meta.success_condition_basis) app.append(h('p', { class: 'basis' }, 'أساس الحكم على شرط النجاح: ', bd(r.meta.success_condition_basis)));

    // تنقل داخل الصفحة
    const sections = [
      ['findings', `الملاحظات (${r.findings.length})`],
      ['analytics', `التحليلات الناقصة (${r.missing_analytics_events.length})`],
      ['insufficient', `دليل غير كافٍ (${r.insufficient_evidence.length})`],
      ['evidence', 'الدليل المجموع'],
      ['raw', 'JSON'],
    ];
    app.append(h('nav', { class: 'subnav' }, sections.map(([k, t]) => h('a', { href: `#${k}` }, t))));

    app.append(renderFindings(r));

    // أحداث التحليلات
    const ev = h('section', { class: 'panel', id: 'analytics' }, h('h2', {}, 'أحداث التحليلات الناقصة'));
    if (r.missing_analytics_events.length) {
      ev.append(
        h('div', { class: 'table-wrap' },
          h('table', { class: 'grid' },
            h('thead', {}, h('tr', {}, h('th', {}, 'اسم الحدث'), h('th', {}, 'متى'), h('th', {}, 'لماذا'))),
            h('tbody', {}, r.missing_analytics_events.map((e) => h('tr', {}, h('td', {}, h('code', {}, e.event_name)), h('td', {}, bd(e.when)), h('td', {}, bd(e.why))))),
          ),
        ),
      );
    } else ev.append(h('p', { class: 'empty' }, 'لا توجد أحداث ناقصة مؤكدة من الدليل.'));
    const observed = (r.meta.analytics_checks || []).filter((c) => c.observed);
    if (observed.length)
      ev.append(h('div', { class: 'observed' }, h('span', { class: 'muted small' }, 'ظهرت في الدليل:'), observed.map((c) => h('span', { class: 'chip-ok' }, h('code', {}, c.event_name), h('small', {}, c.observed_in)))));
    app.append(ev);

    // الدليل غير الكافي
    app.append(
      h('section', { class: 'panel', id: 'insufficient' },
        h('h2', {}, 'بنود الدليل غير الكافي'),
        r.insufficient_evidence.length ? h('ul', { class: 'ins-list' }, r.insufficient_evidence.map((s) => h('li', {}, bd(s)))) : h('p', { class: 'empty' }, 'لا توجد بنود.'),
      ),
    );

    if (r.meta.warnings && r.meta.warnings.length)
      app.append(h('section', { class: 'panel' }, h('h2', {}, 'تنبيهات الجمع'), h('ul', { class: 'ins-list' }, r.meta.warnings.map((s) => h('li', {}, s)))));

    app.append(renderEvidence(r));

    app.append(
      h('details', { class: 'panel raw', id: 'raw' },
        h('summary', {}, 'JSON الداخلي'),
        h('pre', { dir: 'ltr' }, JSON.stringify({ ...r, collected_evidence: undefined }, null, 2)),
      ),
    );
  }

  function renderFindings(r) {
    const sec = h('section', { class: 'panel', id: 'findings' });
    const head = h('div', { class: 'panel-head' }, h('h2', {}, 'جدول الملاحظات'));
    sec.append(head);
    if (!r.findings.length) {
      sec.append(h('p', { class: 'empty' }, r.meta.analysis_mode === 'rules' ? 'لم تكتشف القواعد الآلية مشاكل في الدليل المجموع. راجع الدليل أدناه، وفعّل النموذج لتقييم أعمق.' : 'لم تُسجل ملاحظات مبنية على الدليل.'));
      return sec;
    }
    const state = { sev: 'all', crit: 'all' };
    const tbody = h('tbody');
    const draw = () => {
      tbody.innerHTML = '';
      const list = r.findings.filter((f) => (state.sev === 'all' || f.severity === state.sev) && (state.crit === 'all' || f.criterion === state.crit));
      if (!list.length) tbody.append(h('tr', {}, h('td', { colspan: 6, class: 'empty' }, 'لا توجد ملاحظات بهذا التصفية.')));
      for (const f of list)
        tbody.append(
          h('tr', { class: `row-${f.severity}` },
            h('td', {}, h('span', { class: `badge sev-${f.severity}` }, LEVEL[f.severity]), h('div', { class: 'crit' }, CRITERION[f.criterion] || f.criterion), h('code', { class: 'tiny' }, f.criterion)),
            h('td', {}, h('span', { class: 'step-pill' }, String(f.step)), h('div', { class: 'muted small' }, bd(stepText(r, f.step)))),
            h('td', {}, bd(f.evidence), h('div', { class: 'src' }, 'المصدر: ', h('bdi', {}, f.evidence_source), f.origin === 'rule' ? h('span', { class: 'origin' }, 'قاعدة آلية') : f.origin === 'model' ? h('span', { class: 'origin model' }, 'النموذج') : null)),
            h('td', {}, bd(f.impact)),
            h('td', {}, bd(f.recommendation), h('div', { class: 'review' }, 'بانتظار مراجعة بشرية')),
            h('td', {}, h('span', { class: `conf conf-${f.confidence}` }, LEVEL[f.confidence])),
          ),
        );
    };
    const filterGroup = (key, options) =>
      h('div', { class: 'filter' },
        options.map(([v, label]) =>
          h('button', {
            type: 'button',
            class: `fchip ${state[key] === v ? 'on' : ''}`,
            onclick: (e) => {
              state[key] = v;
              e.currentTarget.parentNode.querySelectorAll('.fchip').forEach((b) => b.classList.remove('on'));
              e.currentTarget.classList.add('on');
              draw();
            },
          }, label),
        ),
      );
    const crits = [...new Set(r.findings.map((f) => f.criterion))];
    head.append(
      h('div', { class: 'filters' },
        filterGroup('sev', [['all', 'كل الشدات'], ['high', 'عالية'], ['medium', 'متوسطة'], ['low', 'منخفضة']]),
        crits.length > 1 ? filterGroup('crit', [['all', 'كل المعايير'], ...crits.map((c) => [c, CRITERION[c] || c])]) : null,
      ),
    );
    sec.append(
      h('div', { class: 'table-wrap' },
        h('table', { class: 'grid findings' },
          h('thead', {}, h('tr', {}, ['الشدة والمعيار', 'الخطوة', 'الدليل', 'الأثر', 'التوصية المقترحة', 'الثقة'].map((t) => h('th', {}, t)))),
          tbody,
        ),
      ),
      h('p', { class: 'muted small' }, 'التوصيات مقترحات تخضع للمراجعة البشرية قبل اعتمادها.'),
    );
    draw();
    return sec;
  }

  function renderEvidence(r) {
    const c = r.collected_evidence;
    const sec = h('section', { class: 'panel', id: 'evidence' }, h('h2', {}, 'الدليل المجموع'));
    if (!c) return sec;
    if (c.source === 'url') {
      const tl = h('ol', { class: 'timeline' });
      c.steps.forEach((s) => {
        const p = s.page || {};
        const net = s.network || [];
        const failedNet = net.filter((n) => n.failure || (n.status && n.status >= 400));
        tl.append(
          h('li', { class: `tl-item ${s.status}` },
            h('span', { class: 'tl-dot' }, String(s.number)),
            h('details', { class: 'tl-body', open: s.status === 'failed' || null },
              h('summary', {},
                h('span', { class: 'tl-title' }, bd(s.text)),
                h('span', { class: `tag ${s.status}` }, STEP_STATUS[s.status] || s.status),
                failedNet.length ? h('span', { class: 'tag failed' }, `${failedNet.length} طلب فاشل`) : null,
                p.error_messages && p.error_messages.length ? h('span', { class: 'tag failed' }, `${p.error_messages.length} رسالة خطأ`) : null,
              ),
              s.error ? h('p', { class: 'err' }, bd(s.error)) : null,
              s.action_result ? h('p', { class: 'muted small' }, `الإجراء: ${s.action_result}`) : null,
              p.url ? h('p', { class: 'small' }, h('bdi', { class: 'url' }, p.url), p.title ? ` — ${p.title}` : '') : null,
              p.error_messages && p.error_messages.length ? h('div', {}, h('h4', {}, 'رسائل الخطأ'), h('ul', { class: 'errs' }, p.error_messages.map((m) => h('li', {}, m)))) : null,
              p.buttons && p.buttons.length
                ? h('div', {}, h('h4', {}, 'الأزرار والروابط الظاهرة'), h('div', { class: 'chips' }, p.buttons.slice(0, 40).map((b) => h('span', { class: `chip ${b.disabled ? 'disabled' : ''}` }, b.text || '(بلا نص)'))))
                : null,
              h('div', {}, h('h4', {}, `طلبات الشبكة (${net.length})`),
                failedNet.length ? h('ul', { class: 'net' }, failedNet.map((n) => h('li', {}, `${n.method} ${n.status ?? n.failure} ${n.url}`))) : h('p', { class: 'muted small' }, 'لا طلبات فاشلة.'),
              ),
              s.console_errors && s.console_errors.length ? h('div', {}, h('h4', {}, 'أخطاء الكونسول'), h('ul', { class: 'net' }, s.console_errors.map((m) => h('li', {}, m)))) : null,
              p.visible_text ? h('details', { class: 'inner' }, h('summary', {}, 'النص الظاهر'), h('p', { class: 'visible-text' }, p.visible_text)) : null,
            ),
          ),
        );
      });
      sec.append(tl);
    } else {
      const grid = h('div', { class: 'file-grid' });
      c.files.forEach((f) => {
        const body = [];
        if (f.error) body.push(h('p', { class: 'err' }, f.error));
        if (f.har) {
          const failed = f.har.requests.filter((q) => q.status === 0 || q.status == null || q.status >= 400);
          body.push(h('p', {}, `${f.har.total_entries} طلب شبكة، منها ${failed.length} فاشل.`));
          if (failed.length) body.push(h('ul', { class: 'net' }, failed.map((q) => h('li', {}, `${q.method} ${q.status} ${q.url}`))));
        }
        if (f.html) {
          if (f.html.error_messages.length) body.push(h('h4', {}, 'رسائل الخطأ'), h('ul', { class: 'errs' }, f.html.error_messages.map((m) => h('li', {}, m))));
          body.push(h('h4', {}, 'الأزرار والروابط'), h('div', { class: 'chips' }, f.html.buttons.map((b) => h('span', { class: 'chip' }, b.text || '(بلا نص)'))));
          if (f.html.accessibility.unlabeled_fields.length)
            body.push(h('p', { class: 'small' }, 'حقول بلا تسمية: ', h('code', {}, f.html.accessibility.unlabeled_fields.join(', '))));
          body.push(h('details', { class: 'inner' }, h('summary', {}, 'النص الظاهر'), h('p', { class: 'visible-text' }, f.html.visible_text.text)));
        }
        if (f.content) body.push(h('pre', { class: 'file-content', dir: 'auto' }, f.content.text.slice(0, 3000)));
        if (f.kind === 'image') body.push(h('p', { class: 'muted' }, f.dimensions ? `صورة ${f.dimensions.width}×${f.dimensions.height}` : 'صورة'));
        grid.append(
          h('details', { class: 'file-card' },
            h('summary', {}, h('span', { class: 'ext' }, f.type), h('bdi', { class: 'fname' }, f.file), h('small', { class: 'muted' }, `${Math.ceil(f.size_bytes / 1024)} KB`)),
            h('div', { class: 'file-body' }, body),
          ),
        );
      });
      sec.append(grid);
    }
    return sec;
  }

  function fail(msg) {
    app.innerHTML = '';
    app.append(h('div', { class: 'panel empty-state' }, h('h2', {}, 'تعذر عرض النتيجة'), h('p', {}, msg), h('a', { class: 'button primary', href: '/' }, 'ابدأ مراجعة جديدة')));
  }

  if (!id) return fail('لا يوجد معرّف نتيجة في الرابط.');
  fetch(`/api/results/${encodeURIComponent(id)}`)
    .then(async (res) => {
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'تعذر تحميل النتيجة.');
      render(body);
    })
    .catch((e) => fail(e.message));
})();
