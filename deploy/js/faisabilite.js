/**
 * NSY — Questionnaire de faisabilité (faisabilite.html / feasibility.html).
 *
 * Wizard multi-étapes + soumission identique au formulaire de contact
 * (POST vers faisabilite.php, Cloudflare Turnstile, réponse JSON).
 *
 * Les libellés des questions/réponses sont la SOURCE UNIQUE : ils vivent
 * dans le HTML (déjà traduit FR/EN par page). Le script reconstruit un
 * payload structuré [{section, items:[{label, value, sub}]}] que le PHP
 * rend dans l'email — donc FR / EN / email ne peuvent pas diverger.
 */
(() => {
  'use strict';
  const form = document.getElementById('feasibility-form');
  if (!form) return;

  const lang = (document.documentElement.lang || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';
  const T = lang === 'en' ? {
    step: (a, b) => `Step ${a} / ${b}`,
    fill: 'Please complete the required fields (*).',
    sending: 'Sending…', retry: 'Send the questionnaire',
    errSend: 'Sending failed — try again or email contact@nsy.fr.',
    errNet: 'Network error — try again or email contact@nsy.fr.',
  } : {
    step: (a, b) => `Étape ${a} / ${b}`,
    fill: 'Merci de compléter les champs obligatoires (*).',
    sending: 'Envoi…', retry: 'Envoyer le questionnaire',
    errSend: "Erreur d'envoi — réessayez ou écrivez à contact@nsy.fr.",
    errNet: 'Erreur réseau — réessayez ou écrivez à contact@nsy.fr.',
  };

  const sections = [...form.querySelectorAll('.qz-section')];
  const TOTAL = sections.length;
  let current = 1;

  const bar = document.getElementById('qzBar');
  const label = document.getElementById('qzLabel');
  const prevBtn = document.getElementById('qzPrev');
  const nextBtn = document.getElementById('qzNext');
  const submitBtn = document.getElementById('qzSubmit');
  const success = document.getElementById('qzSuccess');
  const toast = document.getElementById('qz-toast');

  const setSubmitLabel = (txt) => {
    const l = submitBtn && submitBtn.querySelector('.btn-label');
    if (l) l.textContent = txt;
  };
  const showToast = (msg, isError = true) => {
    if (!toast) return;
    toast.textContent = '';
    const icon = document.createElement('span');
    icon.style.color = isError ? '#ff6b6b' : 'var(--accent)';
    icon.textContent = isError ? '✕' : '✓';
    toast.appendChild(icon);
    toast.appendChild(document.createTextNode(' ' + msg));
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4500);
  };

  const activeSection = () => sections.find((s) => +s.dataset.step === current);

  function update() {
    sections.forEach((s) => s.classList.toggle('active', +s.dataset.step === current));
    // Stepper labels above the bar: mark past steps "done", the current "active".
    document.querySelectorAll('#qzSteps .qz-step').forEach((el, i) => {
      el.classList.toggle('done', i + 1 < current);
      el.classList.toggle('active', i + 1 === current);
    });
    const pct = Math.round((current / TOTAL) * 100);
    if (bar) bar.style.width = pct + '%';
    if (label) label.textContent = T.step(current, TOTAL);
    if (prevBtn) prevBtn.disabled = current === 1;
    if (nextBtn) nextBtn.style.display = current < TOTAL ? '' : 'none';
    if (submitBtn) submitBtn.style.display = current === TOTAL ? '' : 'none';
  }

  function validate() {
    const sec = activeSection();
    let ok = true, firstBad = null;
    sec.querySelectorAll('[required]').forEach((el) => {
      el.classList.remove('qz-invalid');
      if (!String(el.value || '').trim()) { el.classList.add('qz-invalid'); ok = false; firstBad = firstBad || el; }
    });
    sec.querySelectorAll('.qz-check-group[data-required], .qz-radio-group[data-required]').forEach((g) => {
      if (!g.querySelector('input:checked')) { ok = false; firstBad = firstBad || g; }
    });
    if (!ok) { showToast(T.fill); if (firstBad) firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    return ok;
  }

  function go(dir) {
    if (dir > 0 && !validate()) return;
    current = Math.min(Math.max(current + dir, 1), TOTAL);
    update();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (prevBtn) prevBtn.addEventListener('click', () => go(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => go(1));

  // ───── Collect structured answers (labels read straight from the DOM) ─────
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const optLabel = (input) => { const l = input.closest('label'); return l ? clean(l.textContent) : ''; };
  const fieldLabel = (field) => { const l = field.querySelector('.qz-label'); return l ? clean(l.textContent.replace('*', '')) : ''; };

  function fieldValue(field) {
    // Collect every input in the field so MIXED fields work too (e.g. a textarea
    // followed by a checkbox, or radios followed by a free-text input).
    const parts = [];
    field.querySelectorAll('input[type=text], input[type=email], input[type=tel], textarea, select').forEach((el) => {
      const v = el.tagName === 'SELECT'
        ? (el.options[el.selectedIndex] ? clean(el.options[el.selectedIndex].text) : '')
        : String(el.value || '').trim();
      if (v) parts.push(v);
    });
    field.querySelectorAll('input[type=radio]:checked, input[type=checkbox]:checked').forEach((c) => {
      parts.push(optLabel(c));
    });
    return parts.join(', ');
  }

  function collect() {
    const out = [];
    sections.forEach((sec) => {
      const title = clean(sec.querySelector('.qz-section-title') ? sec.querySelector('.qz-section-title').textContent : '');
      const items = [];
      let sub = null;
      [...sec.children].forEach((node) => {
        if (node.classList.contains('qz-sublabel')) { sub = clean(node.textContent); return; }
        if (node.classList.contains('qz-field')) {
          const value = fieldValue(node);
          if (value) items.push({ label: fieldLabel(node), value, sub });
        }
      });
      if (items.length) out.push({ section: title, items });
    });
    return out;
  }

  // ───── Submit (same flow as the contact form) ─────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const fd = new FormData(form);
    fd.set('payload', JSON.stringify(collect()));

    if (submitBtn) submitBtn.disabled = true;
    setSubmitLabel(T.sending);

    try {
      const res = await fetch(form.action || 'faisabilite.php', {
        method: 'POST', body: fd, headers: { Accept: 'application/json' },
      });
      let data = {};
      try { data = await res.json(); } catch (_) {}
      if (!data.ok && data.debug) console.error('[NSY faisabilité] server error:', data.debug);

      if (res.ok && data.ok) {
        form.style.display = 'none';
        if (success) { success.hidden = false; success.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      } else {
        if (submitBtn) submitBtn.disabled = false;
        setSubmitLabel(T.retry);
        showToast(data.error || T.errSend);
      }
    } catch (err) {
      if (submitBtn) submitBtn.disabled = false;
      setSubmitLabel(T.retry);
      showToast(T.errNet);
    }
  });

  update();
})();
