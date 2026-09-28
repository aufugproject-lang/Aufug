(() => {
  const { t, icon } = window.QR;
  const app = document.getElementById('app');
  const id = new URLSearchParams(location.search).get('id');
  const TABS = ['summary', 'findings', 'events', 'insufficient', 'evidence'];
  let result = null;
  let activeTab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'summary';
  const filters = { sev: 'all', crit: 'all' };

  // بناء عناصر DOM بأمان (بدون innerHTML لنصوص الدليل)
  function h(tag, attrs = {}, ...children) {
    const svg = ['svg', 'circle', 'use'].includes(tag);
    const el = svg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'html') el.innerHTML = v; // للأيقونات الثابتة فقط
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return el;
  }
  const ic = (name, cls) => h('span', { class: `ic ${cls || ''}`, html: icon(name) });

  // عزل المقاطع بلغة مختلفة داخل النص حتى لا ينقلب ترتيبها
  const LATIN_RUN = /([A-Za-z0-9_/{"'][A-Za-z0-9_.,:;/\-=?&%#{}()"'\[\] ]*[A-Za-z0-9_}"'\]/]|[A-Za-z0-9_])/;
  const ARABIC_RUN = /([؀-ۿ][؀-ۿ\s«»،؛]*[؀-ۿ»]|[؀-ۿ])/;
  const bd = (text) => {
    const rtlDoc = document.documentElement.dir === 'rtl';
    return String(text ?? '')
      .split(rtlDoc ? LATIN_RUN : ARABIC_RUN)
      .map((part, i) => (i % 2 ? h('bdi', rtlDoc ? {} : { dir: 'rtl' }, part) : part))
      .filter((x) => x !== '');
  };

  const stepText = (r, n) => {
    if (n === 0) return t('general');
    const s = (r.meta.steps || []).find((x) => x.number === n);
    return s ? s.text : '';
  };
  const sevLabel = (s) => t(`sev.${s}`);
  const critLabel = (c) => t(`crit.${c}`);

  function completion(r) {
    if (r.completed === true && ['evidence_only', 'rules'].includes(r.meta.analysis_mode)) return { text: t('c.ran'), cls: 'unknown' };
    if (r.completed === true) return { text: t('c.completed'), cls: 'ok' };
    if (r.completed === false) return { text: t('c.not'), cls: 'bad' };
    return { text: t('c.unknown'), cls: 'unknown' };
  }

  function counts(findings) {
    const c = { high: 0, medium: 0, low: 0 };
    findings.forEach((f) => c[f.severity]++);
    return c;
  }

  function ring(score, size = 'md') {
    const r = 42;
    const c = 2 * Math.PI * r;
    const pct = score == null ? 0 : Math.max(0, Math.min(1, score / 5));
    const tone = score == null ? 'none' : score >= 4 ? 'good' : score >= 2.5 ? 'mid' : 'bad';
    return h('div', { class: `ring ring-${tone} ring-${size}` },
      h('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' },
        h('circle', { cx: 50, cy: 50, r, class: 'track' }),
        h('circle', { cx: 50, cy: 50, r, class: 'bar', 'stroke-dasharray': `${c * pct} ${c}` }),
      ),
      h('div', { class: 'ring-label' }, h('strong', {}, score == null ? '—' : String(score)), h('small', {}, t('of5'))),
    );
  }

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleString(window.QR.lang === 'en' ? 'en-GB' : 'ar', { dateStyle: 'long', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  // ---------- الرأس والمؤشرات ----------

  function renderHead(r) {
    const auto = r.meta.auto_explored;
    const url = r.collected_evidence && r.collected_evidence.target_url;
    const modeKey = { model: 'r.mode.model', rules: 'r.mode.rules', recorded_demo: 'r.mode.demo', evidence_only: 'r.mode.evidence' }[r.meta.analysis_mode];
    const thumb = r.meta.has_thumbnail
      ? h('img', { class: 'thumb', src: `/api/results/${encodeURIComponent(r.id)}/thumb.jpg`, alt: '' })
      : h('div', { class: 'thumb placeholder' }, ic(r.source === 'url' ? 'globe' : 'clip'));
    return [
      h('div', { class: 'page-head' },
        h('div', {},
          h('h1', {}, t('r.title')),
          h('p', { class: 'muted' }, t('r.subtitle')),
        ),
        h('a', { href: '/', class: 'back' }, ic('arrow', 'flip back-ic'), t('r.back')),
      ),
      h('section', { class: 'site-card' },
        thumb,
        h('div', { class: 'site-info' },
          h('div', { class: 'site-name' }, h('strong', { dir: 'auto' }, r.product_name),
            url ? h('a', { href: url, target: '_blank', rel: 'noopener', class: 'ext-link', 'aria-label': url }, ic('external')) : null),
          url ? h('bdi', { class: 'site-url' }, url) : null,
          h('div', { class: 'chips' },
            h('span', { class: 'chip-soft' }, ic('list'), h('span', { dir: 'auto' }, `${t('r.journey')}: ${r.journey}`)),
            h('span', { class: 'chip-soft' }, t(r.source === 'url' ? (auto ? 'r.src.auto' : 'r.src.url') : 'r.src.file')),
            modeKey ? h('span', { class: `chip-soft mode-${r.meta.analysis_mode}` }, t(modeKey)) : null,
          ),
        ),
        h('div', { class: 'site-meta' },
          h('div', { class: 'date' }, h('small', { class: 'muted' }, t('r.date')), h('span', {}, formatDate(r.meta.created_at))),
          h('a', { class: 'btn primary', href: `/api/results/${encodeURIComponent(r.id)}/report.pdf` }, ic('download'), t('r.pdf')),
        ),
      ),
    ];
  }

  function renderKpis(r) {
    const c = counts(r.findings);
    const comp = completion(r);
    const score = r.score_out_of_5;
    const miss = r.missing_analytics_events.length;
    const compSub =
      r.stopped_at_step != null ? t('c.stopped', r.stopped_at_step) : r.completed === true ? t('c.all_ok') : !r.meta.success_condition ? t('c.no_condition') : '';
    return h('section', { class: 'kpis' },
      h('div', { class: `kpi kpi-${comp.cls}` },
        h('div', { class: 'kpi-top' }, h('span', { class: 'kpi-label' }, t('k.completion')), ic('flag', 'kpi-ic')),
        h('div', { class: 'kpi-value' }, comp.text),
        h('div', { class: 'kpi-sub' }, compSub),
      ),
      h('div', { class: 'kpi' },
        h('div', { class: 'kpi-top' }, h('span', { class: 'kpi-label' }, t('k.score')), ic('star', 'kpi-ic accent')),
        h('div', { class: 'kpi-value' }, score == null ? '—' : String(score), h('small', {}, ' / 5')),
        h('div', { class: 'meter' }, h('span', { style: `width:${score == null ? 0 : (score / 5) * 100}%` })),
        h('div', { class: 'kpi-sub' }, r.meta.scoring ? t('k.scored_from', r.meta.scoring.counted_findings) : t('k.not_scored')),
      ),
      h('div', { class: 'kpi' },
        h('div', { class: 'kpi-top' }, h('span', { class: 'kpi-label' }, t('k.total')), ic('file', 'kpi-ic')),
        h('div', { class: 'kpi-value' }, String(r.findings.length)),
        h('div', { class: 'kpi-sub sev-inline' },
          h('span', { class: 'sev-high' }, `${sevLabel('high')} ${c.high}`), ' | ',
          h('span', { class: 'sev-medium' }, `${sevLabel('medium')} ${c.medium}`), ' | ',
          h('span', { class: 'sev-low' }, `${sevLabel('low')} ${c.low}`),
        ),
      ),
      h('div', { class: 'kpi' },
        h('div', { class: 'kpi-top' }, h('span', { class: 'kpi-label' }, t('k.missing')), ic('chart', 'kpi-ic')),
        h('div', { class: 'kpi-value' }, String(miss)),
        h('div', { class: 'kpi-sub' }, t('k.events_sub', miss)),
      ),
    );
  }

  // ---------- التبويبات ----------

  function renderTabs(r) {
    const labels = {
      summary: t('tabs.summary'),
      findings: `${t('tabs.findings')} (${r.findings.length})`,
      events: `${t('tabs.events')} (${r.missing_analytics_events.length})`,
      insufficient: `${t('tabs.insufficient')} (${r.insufficient_evidence.length})`,
      evidence: t('tabs.evidence'),
    };
    return h('nav', { class: 'tabs', role: 'tablist' },
      TABS.map((k) =>
        h('button', {
          type: 'button',
          role: 'tab',
          class: `tab ${activeTab === k ? 'on' : ''}`,
          'aria-selected': String(activeTab === k),
          onclick: () => switchTab(k),
        }, labels[k]),
      ),
    );
  }

  function switchTab(k) {
    activeTab = k;
    history.replaceState(null, '', `#${k}`);
    render();
  }

  function findingsTable(r, list, { compact = false } = {}) {
    const cols = compact
      ? ['col.num', 'col.criterion', 'col.finding', 'col.step', 'col.severity']
      : ['col.severity', 'col.step', 'col.evidence', 'col.impact', 'col.rec', 'col.conf'];
    const rows = list.map((f, i) =>
      compact
        ? h('tr', { class: `row-${f.severity}` },
            h('td', { class: 'num' }, String(i + 1)),
            h('td', {}, critLabel(f.criterion)),
            h('td', { dir: 'auto' }, bd(f.impact || f.evidence)),
            h('td', { class: 'num' }, String(f.step)),
            h('td', {}, h('span', { class: `badge sev-${f.severity}` }, sevLabel(f.severity))),
          )
        : h('tr', { class: `row-${f.severity}` },
            h('td', {}, h('span', { class: `badge sev-${f.severity}` }, sevLabel(f.severity)), h('div', { class: 'crit' }, critLabel(f.criterion)), h('code', { class: 'tiny' }, f.criterion)),
            h('td', {}, h('span', { class: 'step-pill' }, String(f.step)), h('div', { class: 'muted small', dir: 'auto' }, bd(stepText(r, f.step)))),
            h('td', { dir: 'auto' }, bd(f.evidence),
              h('div', { class: 'src' }, `${t('f.source')}: `, h('bdi', {}, f.evidence_source),
                f.origin === 'rule' ? h('span', { class: 'origin' }, t('f.rule')) : f.origin === 'model' ? h('span', { class: 'origin model' }, t('f.model')) : null)),
            h('td', { dir: 'auto' }, bd(f.impact)),
            h('td', { dir: 'auto' }, bd(f.recommendation), h('div', { class: 'review' }, ic('clock'), t('f.review'))),
            h('td', {}, h('span', { class: `conf conf-${f.confidence}` }, sevLabel(f.confidence))),
          ),
    );
    if (!rows.length) rows.push(h('tr', {}, h('td', { colspan: cols.length, class: 'empty' }, t('fl.none'))));
    return h('div', { class: 'table-wrap' },
      h('table', { class: `grid ${compact ? 'compact' : 'findings'}` },
        h('thead', {}, h('tr', {}, cols.map((c) => h('th', {}, t(c))))),
        h('tbody', {}, rows),
      ),
    );
  }

  function tabSummary(r) {
    const c = counts(r.findings);
    const total = r.findings.length || 1;
    const order = { high: 0, medium: 1, low: 2 };
    const seen = new Set();
    const recs = [...r.findings]
      .filter((f) => f.recommendation)
      .sort((a, b) => order[a.severity] - order[b.severity] || order[a.confidence] - order[b.confidence] || a.step - b.step)
      .filter((f) => (seen.has(f.recommendation) ? false : seen.add(f.recommendation)))
      .slice(0, 3);
    const crit = {};
    const rank = { high: 3, medium: 2, low: 1 };
    for (const f of r.findings) {
      const e = (crit[f.criterion] ||= { count: 0, worst: 'low' });
      e.count++;
      if (rank[f.severity] > rank[e.worst]) e.worst = f.severity;
    }
    const maxCrit = Math.max(1, ...Object.values(crit).map((x) => x.count));

    return h('div', { class: 'tab-panel' },
      h('div', { class: 'summary-grid' },
        h('section', { class: 'card' },
          h('h2', {}, t('s.title')),
          h('p', { class: 'summary-text', dir: 'auto' }, bd(r.meta.executive_summary || '')),
          r.meta.success_condition
            ? h('p', { class: 'muted small', dir: 'auto' }, `${t('s.condition')}: `, bd(r.meta.success_condition),
                r.meta.success_condition_basis ? [h('br'), `${t('s.basis')}: `, bd(r.meta.success_condition_basis)] : null)
            : null,
          h('h3', {}, t('s.recs')),
          recs.length
            ? h('ol', { class: 'recs' }, recs.map((f, i) => h('li', {}, h('span', { class: 'rec-n' }, String(i + 1)), h('span', { dir: 'auto' }, bd(f.recommendation)))))
            : h('p', { class: 'empty' }, t('s.no_recs')),
          recs.length ? h('p', { class: 'muted small' }, t('s.recs_note')) : null,
        ),
        h('section', { class: 'card' },
          h('h2', {}, t('s.dist')),
          h('div', { class: 'dist' },
            ring(r.score_out_of_5, 'lg'),
            h('div', { class: 'dist-bars' },
              ['high', 'medium', 'low'].map((s) =>
                h('div', { class: 'dist-row' },
                  h('span', { class: 'dist-label' }, sevLabel(s)),
                  h('div', { class: 'meter thin' }, h('span', { class: `fill-${s}`, style: `width:${(c[s] / total) * 100}%` })),
                  h('strong', {}, String(c[s])),
                ),
              ),
            ),
          ),
          h('h3', {}, t('s.criteria')),
          Object.keys(crit).length
            ? h('div', { class: 'crit-bars' },
                Object.entries(crit)
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([k, v]) =>
                    h('div', { class: 'dist-row' },
                      h('span', { class: 'dist-label' }, critLabel(k)),
                      h('div', { class: 'meter thin' }, h('span', { class: `fill-${v.worst}`, style: `width:${(v.count / maxCrit) * 100}%` })),
                      h('strong', {}, String(v.count)),
                    ),
                  ),
              )
            : h('p', { class: 'empty' }, t('s.no_criteria')),
        ),
      ),
      h('section', { class: 'card' },
        h('div', { class: 'card-head' },
          h('h2', {}, t('s.top')),
          r.findings.length > 0 ? h('button', { type: 'button', class: 'btn ghost small-btn', onclick: () => switchTab('findings') }, t('s.view_all'), ic('arrow', 'flip')) : null,
        ),
        r.findings.length
          ? findingsTable(r, r.findings.slice(0, 5), { compact: true })
          : h('p', { class: 'empty' }, r.meta.analysis_mode === 'rules' ? t('f.empty_rules') : t('f.empty')),
      ),
    );
  }

  function tabFindings(r) {
    if (!r.findings.length)
      return h('div', { class: 'tab-panel' }, h('section', { class: 'card' }, h('p', { class: 'empty' }, r.meta.analysis_mode === 'rules' ? t('f.empty_rules') : t('f.empty'))));
    const list = r.findings.filter((f) => (filters.sev === 'all' || f.severity === filters.sev) && (filters.crit === 'all' || f.criterion === filters.crit));
    const chip = (key, v, label) =>
      h('button', {
        type: 'button',
        class: `fchip ${filters[key] === v ? 'on' : ''}`,
        onclick: () => {
          filters[key] = v;
          render();
        },
      }, label);
    const crits = [...new Set(r.findings.map((f) => f.criterion))];
    return h('div', { class: 'tab-panel' },
      h('section', { class: 'card' },
        h('div', { class: 'filters' },
          h('div', { class: 'filter' }, chip('sev', 'all', t('fl.all_sev')), ['high', 'medium', 'low'].map((s) => chip('sev', s, sevLabel(s)))),
          crits.length > 1 ? h('div', { class: 'filter' }, chip('crit', 'all', t('fl.all_crit')), crits.map((c) => chip('crit', c, critLabel(c)))) : null,
        ),
        findingsTable(r, list),
        h('p', { class: 'muted small' }, t('s.recs_note')),
      ),
    );
  }

  function tabEvents(r) {
    const observed = (r.meta.analytics_checks || []).filter((c) => c.observed);
    return h('div', { class: 'tab-panel' },
      h('section', { class: 'card' },
        r.missing_analytics_events.length
          ? h('div', { class: 'table-wrap' },
              h('table', { class: 'grid' },
                h('thead', {}, h('tr', {}, h('th', {}, t('col.event')), h('th', {}, t('col.when')), h('th', {}, t('col.why')))),
                h('tbody', {}, r.missing_analytics_events.map((e) => h('tr', {}, h('td', {}, h('code', {}, e.event_name)), h('td', { dir: 'auto' }, bd(e.when)), h('td', { dir: 'auto' }, bd(e.why))))),
              ),
            )
          : h('p', { class: 'empty' }, t('e.empty')),
        observed.length
          ? h('div', { class: 'observed' }, h('span', { class: 'muted small' }, t('e.observed')), observed.map((c) => h('span', { class: 'chip-ok' }, ic('check'), h('code', {}, c.event_name), h('small', {}, c.observed_in))))
          : null,
      ),
    );
  }

  function tabInsufficient(r) {
    return h('div', { class: 'tab-panel' },
      h('section', { class: 'card' },
        r.insufficient_evidence.length
          ? h('ul', { class: 'ins-list' }, r.insufficient_evidence.map((s) => h('li', {}, ic('info'), h('span', { dir: 'auto' }, bd(s)))))
          : h('p', { class: 'empty' }, t('i.empty')),
      ),
      r.meta.warnings && r.meta.warnings.length
        ? h('section', { class: 'card' }, h('h2', {}, t('w.title')), h('ul', { class: 'ins-list' }, r.meta.warnings.map((s) => h('li', {}, ic('alert'), h('span', { dir: 'auto' }, bd(s))))))
        : null,
    );
  }

  function tabEvidence(r) {
    const c = r.collected_evidence;
    const sec = h('section', { class: 'card' });
    const ST = t('ev.step_status');
    if (c && c.source === 'url') {
      const tl = h('ol', { class: 'timeline' });
      for (const s of c.steps) {
        const p = s.page || {};
        const net = s.network || [];
        const failedNet = net.filter((n) => n.failure || (n.status && n.status >= 400));
        tl.append(
          h('li', { class: `tl-item ${s.status}` },
            h('span', { class: 'tl-dot' }, String(s.number)),
            h('details', { class: 'tl-body', open: s.status === 'failed' || null },
              h('summary', {},
                h('span', { class: 'tl-title', dir: 'auto' }, bd(s.text)),
                h('span', { class: `tag ${s.status}` }, ST[s.status] || s.status),
                failedNet.length ? h('span', { class: 'tag failed' }, t('ev.failed_req', failedNet.length)) : null,
                p.error_messages && p.error_messages.length ? h('span', { class: 'tag failed' }, t('ev.errors', p.error_messages.length)) : null,
              ),
              s.error ? h('p', { class: 'err', dir: 'auto' }, bd(s.error)) : null,
              s.action_result ? h('p', { class: 'muted small', dir: 'auto' }, `${t('ev.action')}: `, bd(s.action_result)) : null,
              p.url ? h('p', { class: 'small' }, h('bdi', { class: 'url' }, p.url), p.title ? h('span', { dir: 'auto' }, ` — ${p.title}`) : null) : null,
              p.error_messages && p.error_messages.length ? h('div', {}, h('h4', {}, t('ev.errors_h')), h('ul', { class: 'errs' }, p.error_messages.map((m) => h('li', { dir: 'auto' }, m)))) : null,
              p.buttons && p.buttons.length
                ? h('div', {}, h('h4', {}, t('ev.buttons_h')), h('div', { class: 'chips' }, p.buttons.slice(0, 40).map((b) => h('span', { class: `chip ${b.disabled ? 'disabled' : ''}`, dir: 'auto' }, b.text || t('ev.no_text')))))
                : null,
              h('div', {}, h('h4', {}, t('ev.net_h', net.length)),
                failedNet.length ? h('ul', { class: 'net' }, failedNet.map((n) => h('li', {}, `${n.method} ${n.status ?? n.failure} ${n.url}`))) : h('p', { class: 'muted small' }, t('ev.no_failed')),
              ),
              s.console_errors && s.console_errors.length ? h('div', {}, h('h4', {}, t('ev.console_h')), h('ul', { class: 'net' }, s.console_errors.map((m) => h('li', {}, m)))) : null,
              p.visible_text ? h('details', { class: 'inner' }, h('summary', {}, t('ev.text_h')), h('p', { class: 'visible-text', dir: 'auto' }, p.visible_text)) : null,
            ),
          ),
        );
      }
      sec.append(tl);
    } else if (c) {
      const grid = h('div', { class: 'file-grid' });
      for (const f of c.files) {
        const body = [];
        if (f.error) body.push(h('p', { class: 'err', dir: 'auto' }, f.error));
        if (f.har) {
          const failed = f.har.requests.filter((q) => q.status === 0 || q.status == null || q.status >= 400);
          body.push(h('p', {}, t('ev.har', f.har.total_entries, failed.length)));
          if (failed.length) body.push(h('ul', { class: 'net' }, failed.map((q) => h('li', {}, `${q.method} ${q.status} ${q.url}`))));
        }
        if (f.html) {
          if (f.html.error_messages.length) body.push(h('h4', {}, t('ev.errors_h')), h('ul', { class: 'errs' }, f.html.error_messages.map((m) => h('li', { dir: 'auto' }, m))));
          body.push(h('h4', {}, t('ev.buttons_h')), h('div', { class: 'chips' }, f.html.buttons.map((b) => h('span', { class: 'chip', dir: 'auto' }, b.text || t('ev.no_text')))));
          if (f.html.accessibility.unlabeled_fields.length) body.push(h('p', { class: 'small' }, `${t('ev.unlabeled')} `, h('code', {}, f.html.accessibility.unlabeled_fields.join(', '))));
          body.push(h('details', { class: 'inner' }, h('summary', {}, t('ev.text_h')), h('p', { class: 'visible-text', dir: 'auto' }, f.html.visible_text.text)));
        }
        if (f.content) body.push(h('pre', { class: 'file-content', dir: 'auto' }, f.content.text.slice(0, 3000)));
        if (f.kind === 'image') body.push(h('p', { class: 'muted' }, f.dimensions ? `${t('ev.image')} ${f.dimensions.width}×${f.dimensions.height}` : t('ev.image')));
        grid.append(
          h('details', { class: 'file-card' },
            h('summary', {}, h('span', { class: 'ext' }, f.type), h('bdi', { class: 'fname' }, f.file), h('small', { class: 'muted' }, `${Math.ceil(f.size_bytes / 1024)} KB`)),
            h('div', { class: 'file-body' }, body),
          ),
        );
      }
      sec.append(grid);
    }
    return h('div', { class: 'tab-panel' },
      sec,
      h('details', { class: 'card raw' }, h('summary', {}, t('raw.title')), h('pre', { dir: 'ltr' }, JSON.stringify({ ...r, collected_evidence: undefined }, null, 2))),
    );
  }

  function render() {
    const r = result;
    if (!r) return;
    document.title = `${r.product_name} — Quality Review`;
    app.innerHTML = '';
    app.append(...renderHead(r));
    const rLang = r.meta.lang || 'ar';
    if (rLang !== window.QR.lang) app.append(h('div', { class: 'notice info' }, ic('globe'), h('span', {}, t('r.lang_note'))));
    if (r.meta.notice)
      app.append(h('div', { class: `notice ${/تعذر|could not/i.test(r.meta.notice) ? 'warn' : 'info'}`, role: 'status', dir: 'auto' }, ic('info'), h('span', {}, bd(r.meta.notice))));
    app.append(renderKpis(r), renderTabs(r));
    const panel = { summary: tabSummary, findings: tabFindings, events: tabEvents, insufficient: tabInsufficient, evidence: tabEvidence }[activeTab](r);
    app.append(panel);
  }

  function fail(msg) {
    app.innerHTML = '';
    app.append(h('section', { class: 'card empty-state' }, h('h2', {}, t('err.title')), h('p', {}, msg), h('a', { class: 'btn primary', href: '/' }, t('err.new'))));
  }

  window.QR.onLang(render);
  if (!id) return fail(t('err.no_id'));
  fetch(`/api/results/${encodeURIComponent(id)}?lang=${window.QR.lang}`)
    .then(async (res) => {
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || t('err.load'));
      result = body;
      render();
    })
    .catch((e) => fail(e.message));
})();
