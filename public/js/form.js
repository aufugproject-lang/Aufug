(() => {
  const form = document.getElementById('analyze-form');
  const errorsBox = document.getElementById('form-errors');
  const fileInput = document.getElementById('files');
  const fileList = document.getElementById('file-list');
  const dropzone = document.getElementById('dropzone');
  let demoMode = false;
  let selectedFiles = [];

  fetch('/api/status')
    .then((r) => r.json())
    .then((s) => {
      const el = document.getElementById('model-status');
      el.textContent = s.model_configured ? `النموذج: ${s.model}` : 'النموذج غير مُعد — عرض الدليل فقط';
      el.classList.add(s.model_configured ? 'ok' : 'warn');
    })
    .catch(() => {});

  function currentMode() {
    return form.querySelector('input[name=source]:checked').value;
  }

  function applyMode() {
    const mode = currentMode();
    document.querySelectorAll('[data-mode]').forEach((el) => {
      el.hidden = el.dataset.mode !== mode;
    });
  }
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
    const names = demoMode ? window.__demoFiles || [] : selectedFiles.map((f) => f.name);
    names.forEach((name, i) => {
      const li = document.createElement('li');
      li.textContent = name + (demoMode ? ' (ملف تجربة)' : '');
      if (!demoMode) {
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.textContent = 'إزالة';
        rm.onclick = () => {
          selectedFiles.splice(i, 1);
          renderFiles();
        };
        li.appendChild(rm);
      }
      fileList.appendChild(li);
    });
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
    const res = await fetch('/api/demo');
    const { input, files } = await res.json();
    form.querySelector('input[name=source][value=file]').checked = true;
    applyMode();
    for (const [k, v] of Object.entries(input)) {
      const el = form.elements[k];
      if (el && 'value' in el) el.value = v;
    }
    demoMode = true;
    selectedFiles = [];
    window.__demoFiles = files;
    renderFiles();
  });

  function showErrors(list) {
    errorsBox.innerHTML = '';
    const ul = document.createElement('ul');
    list.forEach((m) => {
      const li = document.createElement('li');
      li.textContent = m;
      ul.appendChild(li);
    });
    errorsBox.appendChild(ul);
    errorsBox.hidden = false;
    errorsBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorsBox.hidden = true;
    const fd = new FormData();
    for (const el of form.elements) {
      if (!el.name || el.type === 'file' || el.type === 'radio') continue;
      fd.append(el.name, el.value);
    }
    fd.append('source', currentMode());
    if (demoMode) fd.append('demo', '1');
    else if (currentMode() === 'file') selectedFiles.forEach((f) => fd.append('files', f, f.name));

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

  async function poll(id) {
    const progress = document.getElementById('progress');
    for (;;) {
      await new Promise((r) => setTimeout(r, 1200));
      let job;
      try {
        job = await (await fetch(`/api/jobs/${id}`)).json();
      } catch {
        continue;
      }
      if (job.progress) progress.textContent = job.progress;
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
