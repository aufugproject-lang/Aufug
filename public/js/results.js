(() => {
  const { t, icon } = window.QR;
  const app = document.getElementById('app');
  const id = new URLSearchParams(location.search).get('id');
  const TABS = ['summary', 'findings', 'priorities', 'events', 'insufficient', 'checklist', 'evidence'];
  const CATS = ['accessibility', 'usability', 'performance', 'data_visualization', 'responsive', 'security_privacy', 'seo_content'];
  const SEVS = ['critical', 'high', 'medium', 'low'];
  // فئات النتائج القديمة تُعرض ضمن الفئات الجديدة
  const LEGACY = { UX: 'usability', CX: 'usability', navigation: 'usability', friction: 'usability', feature_completeness: 'usability', analytics: 'usability', accessibility: 'accessibility' };
  const catOf = (f) => (CATS.includes(f.category) ? f.category : LEGACY[f.category || f.criterion] || 'usability');
  let result = null;
  let activeTab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'summary';
  const filters = { sev: 'all', cat: 'all' };

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
  const catLabel = (c) => t(`cat.${c}`);
  const effLabel = (e) => t(`eff.${e || 'medium'}`);

  function completion(r) {
    if (r.completed === true && ['evidence_only', 'rules'].includes(r.meta.analysis_mode)) return { text: t('c.ran'), cls: 'unknown' };
    if (r.completed === true) return { text: t('c.completed'), cls: 'ok' };
    if (r.completed === false) return { text: t('c.not'), cls: 'bad' };
    return { text: t('c.unknown'), cls: 'unknown' };
  }

  function counts(findings) {
    const c = { critical: 0, high: 0, medium: 0, low: 0 };
    findings.forEach((f) => c[f.severity] != null && c[f.severity]++);
    return c;
  }

  const overallOf = (r) => (r.overall_score_out_of_100 != null ? r.overall_score_out_of_100 : r.score_out_of_5 != null ? Math.round(r.score_out_of_5 * 20) : null);
  const tone = (score) => (score == null ? 'none' : score >= 90 ? 'good' : score >= 50 ? 'mid' : 'bad');

  function ring(score, size = 'md') {
    const r = 42;
    const c = 2 * Math.PI * r;
    const pct = score == null ? 0 : Math.max(0, Math.min(1, score / 100));
    return h('div', { class: `ring ring-${tone(score)} ring-${size}` },
      h('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' },
        h('circle', { cx: 50, cy: 50, r, class: 'track' }),
        h('circle', { cx: 50, cy: 50, r, class: 'bar', 'stroke-dasharray': `${c * pct} ${c}` }),
      ),
      h('div', { class: 'ring-label' }, h('strong', {}, score == null ? '—' : String(score)), h('small', {}, t('of100'))),
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
    const url = r.collected_evidence && r.collected_evidence.target_url;
    // شعار الموقع، وإن لم يوجد فالحرف الأول من اسمه
    const initial = h('div', { class: 'logo-box initial' }, String(r.product_name || '?').trim().charAt(0).toUpperCase());
    let logo = initial;
    if (r.meta.logo_type) {
      logo = h('div', { class: 'logo-box' });
      const img = h('img', { src: `/api/results/${encodeURIComponent(r.id)}/logo`, alt: '' });
      img.addEventListener('error', () => logo.replaceWith(initial));
      logo.append(img);
    }
    return [
      h('div', { class: 'page-head' },
        h('div', {},
          h('h1', {}, t('r.title')),
          h('p', { class: 'muted' }, t('r.subtitle')),
        ),
        h('a', { href: '/', class: 'back' }, ic('arrow', 'flip back-ic'), t('r.back')),
      ),
      h('section', { class: 'site-card' },
        logo,
        h('div', { class: 'site-info' },
          h('div', { class: 'site-name' }, h('strong', { dir: 'auto' }, r.product_name),
            url ? h('a', { href: url, target: '_blank', rel: 'noopener', class: 'ext-link', 'aria-label': url }, ic('external')) : null),
          h('div', { class: 'date' }, ic('clock'), h('span', {}, `${t('r.date')}: ${formatDate(r.meta.created_at)}`)),
        ),
        h('div', { class: 'site-meta' },
          h('a', { class: 'btn primary', href: `/api/results/${encodeURIComponent(r.id)}/report.pdf` }, ic('download'), t('r.pdf')),
        ),
      ),
    ];
  }

  function renderKpis(r) {
    const c = counts(r.findings);
    const comp = completion(r);
    const overall = overallOf(r);
    const miss = r.missing_analytics_events.length;
    const compSub =
      r.stopped_at_step != null ? t('c.stopped', r.stopped_at_step) : r.completed === true ? t('c.all_ok') : !r.meta.success_condition ? t('c.no_condition') : '';
    return h('section', { class: 'kpis' },
      h('div', { class: 'kpi kpi-score' },
        ring(overall),
        h('div', {},
          h('span', { class: 'kpi-label' }, t('k.overall')),
          h('div', { class: 'kpi-value', dir: 'ltr' }, overall == null ? '—' : String(overall), h('small', {}, ' / 100')),
          h('div', { class: 'kpi-sub' }, r.meta.scoring && r.meta.scoring.counted_findings != null ? t('k.scored_from', r.meta.scoring.counted_findings) : ''),
        ),
      ),
      h('div', { class: `kpi kpi-${comp.cls}` },
        h('div', { class: 'kpi-top' }, h('span', { class: 'kpi-label' }, t('k.completion')), ic('flag', 'kpi-ic')),
        h('div', { class: 'kpi-value' }, comp.text),
        h('div', { class: 'kpi-sub' }, compSub),
      ),
      h('div', { class: 'kpi' },
        h('div', { class: 'kpi-top' }, h('span', { class: 'kpi-label' }, t('k.total')), ic('file', 'kpi-ic')),
        h('div', { class: 'kpi-value' }, String(r.findings.length)),
        h('div', { class: 'kpi-sub sev-inline' },
          SEVS.map((s, i) => [i ? ' · ' : '', h('span', { class: `sev-${s}` }, `${sevLabel(s)} ${c[s]}`)]),
        ),
      ),
      h('div', { class: 'kpi' },
        h('div', { class: 'kpi-top' }, h('span', { class: 'kpi-label' }, t('k.missing')), ic('chart', 'kpi-ic')),
        h('div', { class: 'kpi-value' }, String(miss)),
        h('div', { class: 'kpi-sub' }, t('k.events_sub', miss)),
      ),
    );
  }

  // درجة كل معيار من 100، أو "غير مُقيّمة" إن لم يتوفر دليل
  function renderCategoryScores(r) {
    const cs = r.category_scores;
    if (!cs) return null;
    return h('section', { class: 'cat-scores', 'aria-label': t('cats.title') },
      CATS.map((c) => {
        const x = cs[c] || {};
        const sc = x.score;
        return h('button', {
          type: 'button',
          class: `cat-score tone-${tone(sc)}`,
          onclick: () => {
            filters.cat = c;
            switchTab('findings');
          },
        },
          h('span', { class: 'cat-name' }, catLabel(c)),
          h('span', { class: 'cat-val' }, sc == null ? t('cats.na') : String(sc)),
          h('div', { class: 'meter thin' }, h('span', { style: `width:${sc == null ? 0 : sc}%` })),
          h('span', { class: 'cat-std' }, sc == null ? t('cats.na_hint') : x.standard || ''),
        );
      }),
    );
  }

  // ---------- التبويبات ----------

  function renderTabs(r) {
    const labels = {
      summary: t('tabs.summary'),
      findings: `${t('tabs.findings')} (${r.findings.length})`,
      priorities: t('tabs.priorities'),
      events: `${t('tabs.events')} (${r.missing_analytics_events.length})`,
      insufficient: `${t('tabs.insufficient')} (${r.insufficient_evidence.length})`,
      checklist: t('tabs.checklist'),
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

  // جدول الملاحظات بالأعمدة المطلوبة: المشكلة | المعيار | المكان | الشدة | الإصلاح (مع كود)
  function issueTable(r, list) {
    const rows = list.map((f) =>
      h('tr', { class: `row-${f.severity}` },
        h('td', {},
          h('strong', { class: 'issue-title', dir: 'auto' }, bd(f.title || f.impact || f.evidence)),
          h('div', { class: 'small muted', dir: 'auto' }, `${t('f.evidence')}: `, bd(f.evidence)),
          f.impact && f.title ? h('div', { class: 'small', dir: 'auto' }, bd(f.impact)) : null,
          h('div', { class: 'src' }, `${t('f.source')}: `, h('bdi', {}, f.evidence_source),
            f.origin === 'rule' ? h('span', { class: 'origin' }, t('f.rule')) : f.origin === 'model' ? h('span', { class: 'origin model' }, t('f.model')) : null),
        ),
        h('td', { class: 'std', dir: 'ltr' }, f.standard || '—'),
        h('td', { class: 'where' }, f.where ? h('bdi', { class: 'url' }, f.where) : h('span', { class: 'muted small', dir: 'auto' }, bd(stepText(r, f.step)))),
        h('td', {}, h('span', { class: `badge sev-${f.severity}` }, sevLabel(f.severity)), h('div', { class: 'tiny-meta' }, `${t('col.effort')}: ${effLabel(f.effort)}`), h('div', { class: 'tiny-meta' }, `${t('col.conf')}: ${sevLabel(f.confidence)}`)),
        h('td', { dir: 'auto' },
          bd(f.recommendation),
          f.code ? h('details', { class: 'code-box' }, h('summary', {}, t('f.code')), h('pre', { dir: 'ltr' }, h('code', {}, f.code))) : null,
          h('div', { class: 'review' }, ic('clock'), t('f.review')),
        ),
      ),
    );
    if (!rows.length) rows.push(h('tr', {}, h('td', { colspan: 5, class: 'empty' }, t('fl.none'))));
    return h('div', { class: 'table-wrap' },
      h('table', { class: 'grid findings' },
        h('thead', {}, h('tr', {}, ['col.issue', 'col.standard', 'col.where', 'col.severity', 'col.fix'].map((c) => h('th', {}, t(c))))),
        h('tbody', {}, rows),
      ),
    );
  }

  const RATING_CLS = { good: 'good', needs_improvement: 'mid', poor: 'bad' };
  function metricsPanel(r) {
    const m = r.metrics;
    if (!m) return null;
    const card = (name, val, rating, hint) =>
      h('div', { class: `metric m-${RATING_CLS[rating] || 'none'}` },
        h('span', { class: 'metric-name' }, name),
        h('strong', { class: 'metric-val' }, val),
        h('span', { class: 'metric-rating' }, rating ? t(`rating.${rating}`) : hint || ''),
        hint && rating ? h('span', { class: 'metric-hint', dir: /[≤<]/.test(hint) ? 'ltr' : 'auto' }, hint) : null,
      );
    const sec = (v) => (v == null ? '—' : `${(v / 1000).toFixed(2)} s`);
    const ms = (v) => (v == null ? '—' : `${v} ms`);
    return h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, t('cwv.title')), h('span', { class: 'muted small', dir: 'ltr' }, m.conditions)),
      h('div', { class: 'metrics' },
        card('LCP', sec(m.lcp.value), m.lcp.rating, '≤ 2.5 s'),
        card('INP', '—', null, t('cwv.inp_note')),
        card('CLS', m.cls.value == null ? '—' : String(m.cls.value), m.cls.rating, '≤ 0.1'),
        card('TBT', ms(m.tbt.value), m.tbt.rating, t('cwv.tbt_hint')),
        card('FCP', sec(m.fcp.value), m.fcp.rating, '≤ 1.8 s'),
        card('TTFB', ms(m.ttfb.value), m.ttfb.rating, '≤ 0.8 s'),
        card(t('cwv.weight'), `${(m.total_kb / 1024).toFixed(2)} MB`, m.total_kb > 1600 ? 'poor' : 'good', `JS ${m.js_kb} KB · IMG ${m.img_kb} KB`),
        card(t('cwv.requests'), String(m.requests), null, `${t('cwv.blocking')}: ${m.render_blocking}`),
      ),
    );
  }

  function tabSummary(r) {
    const c = counts(r.findings);
    const total = r.findings.length || 1;
    const byCat = {};
    for (const f of r.findings) {
      const k = catOf(f);
      byCat[k] = (byCat[k] || 0) + 1;
    }
    const top = (r.priorities || []).map((i) => r.findings[i]).filter(Boolean).slice(0, 5);
    return h('div', { class: 'tab-panel' },
      h('div', { class: 'summary-grid' },
        h('section', { class: 'card' },
          h('h2', {}, t('s.title')),
          h('p', { class: 'summary-text', dir: 'auto' }, bd(r.meta.executive_summary || '')),
          r.meta.success_condition
            ? h('p', { class: 'muted small', dir: 'auto' }, `${t('s.condition')}: `, bd(r.meta.success_condition),
                r.meta.success_condition_basis ? [h('br'), `${t('s.basis')}: `, bd(r.meta.success_condition_basis)] : null)
            : null,
          r.meta.scoring && r.meta.scoring.method ? h('p', { class: 'muted small', dir: 'auto' }, bd(r.meta.scoring.method)) : null,
        ),
        h('section', { class: 'card' },
          h('h2', {}, t('s.dist')),
          h('div', { class: 'dist' },
            ring(overallOf(r), 'lg'),
            h('div', { class: 'dist-bars' },
              SEVS.map((s) =>
                h('div', { class: 'dist-row' },
                  h('span', { class: 'dist-label' }, sevLabel(s)),
                  h('div', { class: 'meter thin' }, h('span', { class: `fill-${s}`, style: `width:${(c[s] / total) * 100}%` })),
                  h('strong', {}, String(c[s])),
                ),
              ),
            ),
          ),
          h('h3', {}, t('s.criteria')),
          h('div', { class: 'crit-bars' },
            CATS.filter((k) => byCat[k]).map((k) =>
              h('div', { class: 'dist-row' },
                h('span', { class: 'dist-label' }, catLabel(k)),
                h('div', { class: 'meter thin' }, h('span', { style: `width:${(byCat[k] / Math.max(...Object.values(byCat))) * 100}%` })),
                h('strong', {}, String(byCat[k])),
              ),
            ),
          ),
        ),
      ),
      metricsPanel(r),
      h('section', { class: 'card' },
        h('div', { class: 'card-head' },
          h('h2', {}, t('p.top10')),
          top.length ? h('button', { type: 'button', class: 'btn ghost small-btn', onclick: () => switchTab('priorities') }, t('s.view_all'), ic('arrow', 'flip')) : null,
        ),
        top.length ? priorityTable(top) : h('p', { class: 'empty' }, r.meta.analysis_mode === 'rules' ? t('f.empty_rules') : t('f.empty')),
      ),
    );
  }

  function priorityTable(list) {
    return h('div', { class: 'table-wrap' },
      h('table', { class: 'grid compact' },
        h('thead', {}, h('tr', {}, ['col.rank', 'col.issue', 'col.category', 'col.severity', 'col.effort', 'col.standard'].map((c) => h('th', {}, t(c))))),
        h('tbody', {},
          list.map((f, i) =>
            h('tr', { class: `row-${f.severity}` },
              h('td', { class: 'num' }, String(i + 1)),
              h('td', { dir: 'auto' }, bd(f.title || f.impact)),
              h('td', {}, catLabel(catOf(f))),
              h('td', {}, h('span', { class: `badge sev-${f.severity}` }, sevLabel(f.severity))),
              h('td', { class: 'nowrap' }, effLabel(f.effort)),
              h('td', { class: 'std', dir: 'ltr' }, f.standard || '—'),
            ),
          ),
        ),
      ),
    );
  }

  function tabFindings(r) {
    if (!r.findings.length)
      return h('div', { class: 'tab-panel' }, h('section', { class: 'card' }, h('p', { class: 'empty' }, r.meta.analysis_mode === 'rules' ? t('f.empty_rules') : t('f.empty'))));
    const chip = (key, v, label) =>
      h('button', {
        type: 'button',
        class: `fchip ${filters[key] === v ? 'on' : ''}`,
        onclick: () => {
          filters[key] = v;
          render();
        },
      }, label);
    const sections = CATS.filter((c) => filters.cat === 'all' || filters.cat === c).map((c) => {
      const x = (r.category_scores || {})[c];
      const list = r.findings.filter((f) => catOf(f) === c && (filters.sev === 'all' || f.severity === filters.sev));
      if (!list.length && filters.cat === 'all' && !(x && x.assessed)) return null;
      return h('section', { class: 'card cat-section', id: `cat-${c}` },
        h('div', { class: 'card-head' },
          h('div', {}, h('h2', {}, catLabel(c)), x && x.standard ? h('p', { class: 'muted small', dir: 'ltr' }, x.standard) : null),
          x ? h('span', { class: `score-pill tone-${tone(x.score)}`, dir: x.score == null ? 'auto' : 'ltr' }, x.score == null ? t('cats.na') : `${x.score} / 100`) : null,
        ),
        list.length ? issueTable(r, list) : h('p', { class: 'empty' }, x && x.score == null ? t('cat.not_assessed') : t('cat.no_findings')),
      );
    });
    return h('div', { class: 'tab-panel' },
      h('section', { class: 'card filters-card' },
        h('div', { class: 'filters' },
          h('div', { class: 'filter' }, chip('cat', 'all', t('fl.all_cat')), CATS.map((c) => chip('cat', c, catLabel(c)))),
          h('div', { class: 'filter' }, chip('sev', 'all', t('fl.all_sev')), SEVS.map((s) => chip('sev', s, sevLabel(s)))),
        ),
      ),
      sections,
      h('p', { class: 'muted small' }, t('s.recs_note')),
    );
  }

  function tabPriorities(r) {
    const top = (r.priorities || []).map((i) => r.findings[i]).filter(Boolean);
    const quick = (r.quick_wins || []).map((i) => r.findings[i]).filter(Boolean);
    return h('div', { class: 'tab-panel' },
      h('section', { class: 'card' }, h('h2', {}, t('p.top10')), top.length ? priorityTable(top) : h('p', { class: 'empty' }, t('p.none'))),
      h('section', { class: 'card' },
        h('h2', {}, t('p.quick')),
        quick.length
          ? h('ol', { class: 'quick-list' },
              quick.map((f) =>
                h('li', {},
                  h('div', { class: 'quick-head' }, h('span', { class: `badge sev-${f.severity}` }, sevLabel(f.severity)), h('strong', { dir: 'auto' }, bd(f.title || f.impact)), h('span', { class: 'chip-soft' }, catLabel(catOf(f)))),
                  h('div', { class: 'small', dir: 'auto' }, bd(f.recommendation)),
                  f.code ? h('pre', { dir: 'ltr' }, h('code', {}, f.code)) : null,
                  h('div', { class: 'std small', dir: 'ltr' }, f.standard),
                ),
              ),
            )
          : h('p', { class: 'empty' }, t('p.none')),
      ),
    );
  }

  function tabChecklist(r) {
    const cl = r.checklist;
    return h('div', { class: 'tab-panel' },
      cl
        ? h('section', { class: 'card' },
            h('h2', {}, t('cl.title')),
            CATS.filter((c) => cl[c]).map((c) =>
              h('div', { class: 'cl-group' },
                h('h3', {}, catLabel(c)),
                h('ul', { class: 'cl-list' },
                  cl[c].map(([item, tool]) =>
                    h('li', {}, h('label', {}, h('input', { type: 'checkbox' }), h('span', { dir: 'auto' }, item)), h('span', { class: 'cl-tool', dir: 'ltr' }, tool)),
                  ),
                ),
              ),
            ),
          )
        : null,
      r.insufficient_evidence.length
        ? h('section', { class: 'card' }, h('h2', {}, t('cl.unverified')), h('ul', { class: 'ins-list' }, r.insufficient_evidence.map((s) => h('li', {}, ic('info'), h('span', { dir: 'auto' }, bd(s))))))
        : null,
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
    app.append(...[renderKpis(r), renderCategoryScores(r), renderTabs(r)].filter(Boolean));
    const panel = { summary: tabSummary, findings: tabFindings, priorities: tabPriorities, events: tabEvents, insufficient: tabInsufficient, checklist: tabChecklist, evidence: tabEvidence }[activeTab](r);
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
