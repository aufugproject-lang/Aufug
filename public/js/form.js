(() => {
  const form = document.getElementById('analyze-form');
  const errorsBox = document.getElementById('form-errors');
  const fileInput = document.getElementById('files');
  const fileList = document.getElementById('file-list');
  const dropzone = document.getElementById('dropzone');
  const journeyBox = document.getElementById('journey-box');
  let demoMode = false;
  let demoFiles = [];
  let selectedFiles = [];

  fetch('/api/status')
    .then((r) => r.json())
    .then((s) => {
      const el = document.getElementById('model-status');
      el.querySelector('.txt').textContent = s.model_configured ? `النموذج مفعّل · ${s.model}` : 'النموذج غير مُعد — عرض الدليل فقط';
      el.classList.add(s.model_configured ? 'ok' : 'warn');
    })
    .catch(() => {});

  const currentMode = () => form.querySelector('input[name=source]:checked').value;

  function applyMode() {
    const mode = currentMode();
    document.querySelectorAll('[data-mode]').forEach((el) => {
      el.hidden = el.dataset.mode !== mode;
    });
    const isFile = mode === 'file';
    document.getElementById('journey-title').textContent = isFile ? 'بيانات الرحلة' : 'تخصيص الرحلة';
    const badge = document.getElementById('journey-badge');
    badge.textContent = isFile ? 'مطلوبة' : 'اختياري';
    badge.classList.toggle('req', isFile);
    journeyBox.classList.toggle('locked', isFile);
    if (isFile) journeyBox.open = true;
    const pn = form.elements.product_name;
    pn.placeholder = isFile ? pn.dataset.filePlaceholder : 'يؤخذ من عنوان الموقع إن تُرك فارغًا';
  }
  // في وضع الملفات بيانات الرحلة مطلوبة فتبقى مفتوحة
  journeyBox.addEventListener('toggle', () => {
    if (currentMode() === 'file' && !journeyBox.open) journeyBox.open = true;
  });
  form.querySelectorAll('input[name=source]').forEach((r) =>
    r.addEventListener('change', () => {
      demoMode = false;
      applyMode();
      renderFiles();
    }),
  );
  applyMode();

  function renderFiles() {
    fileList.innerHTML = '';
    const items = demoMode ? demoFiles.map((name) => ({ name, demo: true })) : selectedFiles.map((f, i) => ({ name: f.name, i }));
    for (const it of items) {
      const li = document.createElement('li');
      const ext = it.name.split('.').pop().toLowerCase();
      const tag = document.createElement('span');
      tag.className = 'ext';
      tag.textContent = ext;
      const name = document.createElement('bdi');
      name.textContent = it.name;
      li.append(tag, name);
      if (it.demo) {
        const d = document.createElement('small');
        d.textContent = 'ملف تجربة';
        li.append(d);
      } else {
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.setAttribute('aria-label', `إزالة ${it.name}`);
        rm.textContent = '×';
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
    const { input, files } = await (await fetch('/api/demo')).json();
    form.querySelector('input[name=source][value=file]').checked = true;
    applyMode();
    for (const [k, v] of Object.entries(input)) {
      const el = form.elements[k];
      if (el && 'value' in el) el.value = v;
    }
    demoMode = true;
    selectedFiles = [];
    demoFiles = files;
    renderFiles();
    form.scrollIntoView({ behavior: 'smooth' });
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
    const mode = currentMode();
    const fd = new FormData();
    for (const el of form.elements) {
      if (!el.name || el.type === 'file' || el.type === 'radio') continue;
      fd.append(el.name, el.value);
    }
    fd.append('source', mode);
    if (demoMode) fd.append('demo', '1');
    else if (mode === 'file') selectedFiles.forEach((f) => fd.append('files', f, f.name));

    let res;
    try {
      res = await fetch('/api/analyze', { method: 'POST', body: fd });
    } catch {
      return showErrors(['تعذر الاتصال بالخادم المحلي.']);
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return showErrors(body.errors || ['تعذر بدء التحليل.']);

    form.hidden = true;
    document.getElementById('waiting').hidden = false;
    poll(body.id);
  });

  function setStage(progressText) {
    const stage = /تحليل الدليل بنموذج/.test(progressText)
      ? 'analyze'
      : /تجهيز|اكتمل/.test(progressText)
        ? 'finish'
        : 'collect';
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
    setStage('');
    for (;;) {
      await new Promise((r) => setTimeout(r, 1000));
      let job;
      try {
        job = await (await fetch(`/api/jobs/${id}`)).json();
      } catch {
        continue;
      }
      if (job.progress) {
        progress.textContent = job.progress;
        setStage(job.progress);
      }
      if (job.status === 'done') {
        location.href = `/results.html?id=${encodeURIComponent(id)}`;
        return;
      }
      if (job.status === 'error' || job.error) {
        document.getElementById('waiting').hidden = true;
        form.hidden = false;
        showErrors([job.error || 'تعذر إكمال التحليل.']);
        return;
      }
    }
  }
})();
