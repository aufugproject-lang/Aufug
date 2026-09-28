(() => {
  const { t } = window.QR;
  const form = document.getElementById('analyze-form');
  const errorsBox = document.getElementById('form-errors');
  const fileInput = document.getElementById('files');
  const fileList = document.getElementById('file-list');
  const dropzone = document.getElementById('dropzone');
  const journeyBox = document.getElementById('journey-box');
  let mode = 'url';
  let demoMode = false;
  let demoFiles = [];
  let selectedFiles = [];
  let lastProgress = '';

  function renderStatic() {
    const isFile = mode === 'file';
    document.getElementById('journey-title').textContent = t(isFile ? 'opts.file' : 'opts.url');
    const badge = document.getElementById('journey-badge');
    badge.textContent = t(isFile ? 'opts.required' : 'opts.optional');
    badge.classList.toggle('req', isFile);
    document.getElementById('product_name').placeholder = t(isFile ? 'f.product_ph_file' : 'f.product_ph_url');
    const table = document.getElementById('syntax-table');
    table.innerHTML = '';
    for (const [code, desc] of t('syntax.rows')) {
      const tr = table.insertRow();
      const a = tr.insertCell();
      a.textContent = code;
      a.dir = 'auto';
      tr.insertCell().textContent = desc;
    }
    document.getElementById('demo-link').href = `/results.html?id=${window.QR.lang === 'en' ? 'demo-en' : 'demo'}`;
    document.getElementById('progress').textContent = lastProgress || t('wait.queued');
    renderFiles();
  }

  function setMode(next) {
    mode = next;
    demoMode = false;
    document.querySelectorAll('[data-mode]').forEach((el) => (el.hidden = el.dataset.mode !== mode));
    journeyBox.classList.toggle('locked', mode === 'file');
    if (mode === 'file') journeyBox.open = true;
    renderStatic();
  }
  document.getElementById('to-files').addEventListener('click', () => setMode('file'));
  document.getElementById('to-url').addEventListener('click', () => setMode('url'));
  // في وضع الملفات بيانات الرحلة مطلوبة فتبقى مفتوحة
  journeyBox.addEventListener('toggle', () => {
    if (mode === 'file' && !journeyBox.open) journeyBox.open = true;
  });

  function renderFiles() {
    fileList.innerHTML = '';
    const items = demoMode ? demoFiles.map((name) => ({ name, demo: true })) : selectedFiles.map((f, i) => ({ name: f.name, i }));
    for (const it of items) {
      const li = document.createElement('li');
      const tag = document.createElement('span');
      tag.className = 'ext';
      tag.textContent = it.name.split('.').pop().toLowerCase();
      const name = document.createElement('bdi');
      name.textContent = it.name;
      li.append(tag, name);
      if (it.demo) {
        const d = document.createElement('small');
        d.textContent = t('drop.demo');
        li.append(d);
      } else {
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.setAttribute('aria-label', `${t('drop.remove')} ${it.name}`);
        rm.innerHTML = window.QR.icon('x');
        rm.onclick = () => {
          selectedFiles.splice(it.i, 1);
          renderFiles();
        };
        li.append(rm);
      }
      fileList.appendChild(li);
    }
  }

  function addFiles(list) {
    demoMode = false;
    for (const f of list) if (!selectedFiles.some((x) => x.name === f.name && x.size === f.size)) selectedFiles.push(f);
    renderFiles();
  }
  fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
  });
  ['dragover', 'dragenter'].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.add('over');
    }),
  );
  ['dragleave', 'drop'].forEach((ev) => dropzone.addEventListener(ev, () => dropzone.classList.remove('over')));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  });

  document.getElementById('load-demo').addEventListener('click', async () => {
    const { input, files } = await (await fetch(`/api/demo?lang=${window.QR.lang}`)).json();
    setMode('file');
    for (const [k, v] of Object.entries(input)) {
      const el = form.elements[k];
      if (el && 'value' in el) el.value = v;
    }
    demoMode = true;
    selectedFiles = [];
    demoFiles = files;
    renderFiles();
    document.querySelector('.hero').scrollIntoView({ behavior: 'smooth' });
  });

  function showErrors(list) {
    errorsBox.innerHTML = '';
    const ul = document.createElement('ul');
    for (const m of list) {
      const li = document.createElement('li');
      li.textContent = m;
      ul.appendChild(li);
    }
    errorsBox.appendChild(ul);
    errorsBox.hidden = false;
    errorsBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorsBox.hidden = true;
    const fd = new FormData();
    for (const el of form.elements) {
      if (!el.name || el.type === 'file') continue;
      fd.append(el.name, el.value);
    }
    fd.append('source', mode);
    if (demoMode) fd.append('demo', '1');
    else if (mode === 'file') selectedFiles.forEach((f) => fd.append('files', f, f.name));

    let res;
    try {
      res = await fetch(`/api/analyze?lang=${window.QR.lang}`, { method: 'POST', body: fd });
    } catch {
      return showErrors([t('err.connect')]);
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return showErrors(body.errors || [t('err.start')]);

    form.hidden = true;
    document.getElementById('waiting').hidden = false;
    poll(body.id);
  });

  function setStage(stage) {
    const order = ['collect', 'analyze', 'finish'];
    const idx = order.indexOf(stage);
    document.querySelectorAll('#stages li').forEach((li) => {
      const i = order.indexOf(li.dataset.stage);
      li.classList.toggle('done', i < idx);
      li.classList.toggle('active', i === idx);
    });
  }

  async function poll(id) {
    const progress = document.getElementById('progress');
    let stage = 'collect';
    setStage(stage);
    for (;;) {
      await new Promise((r) => setTimeout(r, 1000));
      let job;
      try {
        job = await (await fetch(`/api/jobs/${id}?lang=${window.QR.lang}`)).json();
      } catch {
        continue;
      }
      if (job.progress && job.progress !== lastProgress) {
        lastProgress = job.progress;
        progress.textContent = job.progress;
        // المراحل تتقدم ولا ترجع: بعد جمع الدليل تأتي القواعد/النموذج ثم التجهيز
        if (/rules|model|قواعد|النموذج|AI/i.test(job.progress)) stage = 'analyze';
        if (/Preparing|تجهيز|Done|اكتمل/.test(job.progress)) stage = 'finish';
        setStage(stage);
      }
      if (job.status === 'done') {
        location.href = `/results.html?id=${encodeURIComponent(id)}`;
        return;
      }
      if (job.status === 'error' || job.error) {
        document.getElementById('waiting').hidden = true;
        form.hidden = false;
        showErrors([job.error || t('err.fail')]);
        return;
      }
    }
  }

  window.QR.onLang(renderStatic);
  setMode('url');
})();
