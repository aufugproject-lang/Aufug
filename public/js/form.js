(() => {
  const { t } = window.QR;
  const form = document.getElementById('analyze-form');
  const errorsBox = document.getElementById('form-errors');
  let lastProgress = '';

  function renderStatic() {
    document.getElementById('demo-link').href = `/results.html?id=${window.QR.lang === 'en' ? 'demo-en' : 'demo'}`;
    document.getElementById('progress').textContent = lastProgress || t('wait.queued');
  }

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
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorsBox.hidden = true;
    // التحليل بالرابط فقط: تستكشف الأداة الموقع تلقائيًا
    const fd = new FormData();
    fd.append('source', 'url');
    fd.append('url', form.elements.url.value);

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
  renderStatic();
})();
