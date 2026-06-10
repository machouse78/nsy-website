/* NSY — Cyber Cabinet
   Vanilla JS for nav active-state, contact form toast, service radio, chatbot. */

(function () {
  'use strict';

  // ───── Dynamic year & experience ─────
  // Cédric had 14 years of experience in 2026 → started in 2012.
  const CAREER_START_YEAR = 2012;
  const currentYear = new Date().getFullYear();
  const yearsExperience = Math.max(0, currentYear - CAREER_START_YEAR);

  const FR_NUMBERS = {
    1: 'un', 2: 'deux', 3: 'trois', 4: 'quatre', 5: 'cinq',
    6: 'six', 7: 'sept', 8: 'huit', 9: 'neuf', 10: 'dix',
    11: 'onze', 12: 'douze', 13: 'treize', 14: 'quatorze', 15: 'quinze',
    16: 'seize', 17: 'dix-sept', 18: 'dix-huit', 19: 'dix-neuf', 20: 'vingt',
    21: 'vingt et un', 22: 'vingt-deux', 23: 'vingt-trois', 24: 'vingt-quatre',
    25: 'vingt-cinq', 26: 'vingt-six', 27: 'vingt-sept', 28: 'vingt-huit',
    29: 'vingt-neuf', 30: 'trente'
  };
  const yearsExperienceFr = FR_NUMBERS[yearsExperience] || String(yearsExperience);

  document.querySelectorAll('[data-years]').forEach((el) => {
    el.textContent = yearsExperience;
  });
  document.querySelectorAll('[data-years-fr]').forEach((el) => {
    el.textContent = yearsExperienceFr;
  });
  document.querySelectorAll('[data-current-year]').forEach((el) => {
    el.textContent = currentYear;
  });

  // Smooth-scroll + active nav state on scroll
  const navLinks = document.querySelectorAll('.nav-link[data-target]');
  const sections = Array.from(navLinks)
    .map((a) => document.getElementById(a.dataset.target))
    .filter(Boolean);

  function setActive(id) {
    navLinks.forEach((a) => a.classList.toggle('active', a.dataset.target === id));
  }

  if ('IntersectionObserver' in window && sections.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
    );
    sections.forEach((s) => io.observe(s));
  }

  // Service-option radio (form)
  const opts = document.querySelectorAll('.opt[data-service]');
  const serviceInput = document.getElementById('service');
  opts.forEach((opt) => {
    opt.addEventListener('click', () => {
      opts.forEach((o) => o.classList.remove('active'));
      opt.classList.add('active');
      if (serviceInput) serviceInput.value = opt.dataset.service;
    });
  });

  // Contact form: stub submit + toast
  const form = document.getElementById('contact-form');
  const toast = document.getElementById('toast');
  const submitBtn = document.getElementById('contact-submit');

  if (form) {
    const setLabel = (text) => {
      const label = submitBtn?.querySelector('.btn-label');
      if (label) label.textContent = text;
    };
    const showToast = (text, isError = false) => {
      if (!toast) return;
      toast.textContent = '';
      const icon = document.createElement('span');
      icon.style.color = isError ? '#ff6b6b' : 'var(--accent)';
      icon.textContent = isError ? '✕' : '✓';
      toast.appendChild(icon);
      toast.appendChild(document.createTextNode(' ' + text));
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 4000);
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitBtn) submitBtn.disabled = true;
      setLabel('Envoi…');

      try {
        const res = await fetch(form.action || 'contact.php', {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        });

        let data = {};
        try { data = await res.json(); } catch (_) {}

        // TEMPORARY: surface server-side SMTP errors in the console for diagnostics
        if (!data.ok && data.debug) {
          console.error('[NSY contact] server error detail:', data.debug);
        }

        if (res.ok && data.ok) {
          setLabel('Envoyé ✓');
          showToast('Message reçu — réponse sous 48h ouvrées.');
          form.reset();
          const consultingOpt = document.querySelector('.opt[data-service="consulting"]');
          document.querySelectorAll('.opt').forEach((o) => o.classList.remove('active'));
          if (consultingOpt) consultingOpt.classList.add('active');
          const serviceInput = document.getElementById('service');
          if (serviceInput) serviceInput.value = 'consulting';
        } else {
          if (submitBtn) submitBtn.disabled = false;
          setLabel('Réessayer');
          showToast(data.error || "Erreur d'envoi — réessayez ou écrivez à contact@nsy.fr.", true);
        }
      } catch (err) {
        if (submitBtn) submitBtn.disabled = false;
        setLabel('Réessayer');
        showToast('Erreur réseau — réessayez ou écrivez à contact@nsy.fr.', true);
      }
    });
  }

  // ───── Chatbot ─────
  const fab = document.getElementById('cbot-fab');
  const panel = document.getElementById('cbot');
  const closeBtn = document.getElementById('cbot-close');
  const body = document.getElementById('cbot-body');
  const input = document.getElementById('cbot-input');
  const sendBtn = document.getElementById('cbot-send');
  const suggestions = document.getElementById('cbot-suggestions');
  const escalate = document.getElementById('cbot-escalate');

  if (fab && panel) {
    fab.addEventListener('click', () => {
      const isOpen = panel.classList.toggle('open');
      fab.classList.toggle('open', isOpen);
    });
    closeBtn?.addEventListener('click', () => {
      panel.classList.remove('open');
      fab.classList.remove('open');
    });
    escalate?.addEventListener('click', () => {
      panel.classList.remove('open');
      fab.classList.remove('open');
      const c = document.getElementById('contact');
      if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function makeAvatar() {
    const a = document.createElement('div');
    a.className = 'cbot-msg-avatar';
    const img = document.createElement('img');
    img.src = 'public/nsy-logo.png';
    img.alt = 'NSY';
    a.appendChild(img);
    return a;
  }

  function appendMessage(role, content) {
    if (!body) return null;
    const wrap = document.createElement('div');
    wrap.className = `cbot-msg cbot-msg-${role}`;
    if (role === 'assistant') {
      wrap.appendChild(makeAvatar());
    }
    const bubble = document.createElement('div');
    bubble.className = 'cbot-bubble';
    bubble.textContent = content;
    wrap.appendChild(bubble);
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
    return bubble;
  }

  function appendTyping() {
    if (!body) return null;
    const wrap = document.createElement('div');
    wrap.className = 'cbot-msg cbot-msg-assistant';
    const bubble = document.createElement('div');
    bubble.className = 'cbot-bubble cbot-typing';
    bubble.innerHTML = '<span></span><span></span><span></span>';
    wrap.appendChild(makeAvatar());
    wrap.appendChild(bubble);
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
    return wrap;
  }

  // Detect page language from <html lang="..."> — defaults to fr
  const pageLang = (document.documentElement.lang || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';
  // The 3D creations now live in a section of the homepage (#creations),
  // not a standalone page. The chatbot only runs on the index pages, so a
  // same-page anchor works for both languages.
  const hobbiePath = '#creations';

  function botReply(userText) {
    const t = userText.toLowerCase();

    if (pageLang === 'en') {
      // ───── ENGLISH knowledge base ─────
      if (t.includes('price') || t.includes('pricing') || t.includes('cost') || t.includes('rate') || t.includes('budget') || t.includes('how much')) {
        return "Technical consulting: day-rate or fixed-fee, direct engagement via EURL — to be scoped together. Web creation · AI: from €9,800 ex-VAT for a turnkey package. For a precise quote, the contact form is the fastest path.";
      }
      if (t.includes('availab') || t.includes('when') || t.includes('start') || t.includes('booked')) {
        return `Cédric is available for new engagements from Q4 ${currentYear} onward. Maximum three clients in parallel to keep the bar of excellence non-negotiable.`;
      }
      if (t.includes('bank') || t.includes('finance') || t.includes('insurance') || t.includes('asset')) {
        return `Yes — that's the core specialty. ${yearsExperience} years of expertise on critical builds in retail banking, private banking, life insurance and asset management. Fluent in regulated environments (ACPR, AMF, GDPR, DORA).`;
      }
      if (t.includes('3d') || t.includes('blender') || t.includes('wireframe') || t.includes('animation') || t.includes('model') || t.includes('hobby') || t.includes('hobbies') || t.includes('renault') || t.includes('render') || t.includes('hobbie')) {
        return `Yes, in-house 3D is one of the creative offerings — Blender renders optimised for the web, lightweight and fast-loading (no impact on page speed). Two live examples in the Hobbies section: a looped 3D animation and an interactive wireframe model of a Renault R25 Baccara you can rotate. Scroll down to ${hobbiePath} to have a look.`;
      }
      if (t.includes('service') || t.includes('offer') || t.includes('what do you do')) {
        return "Two offerings: (1) Senior technical consulting for finance & insurance — architecture, audit, migration, compliance. (2) AI-powered web creation for organisations in transition — websites, SaaS platforms, LLM integration (Claude, OpenAI, Mistral). And as a bonus: 3D animations / interactive models for the web.";
      }
      if (t.includes('contact') || t.includes('reach') || t.includes('meeting') || t.includes('call')) {
        return "Simplest path: fill in the contact form at the bottom of the page (reply within 48 business hours) or email contact@nsy.fr directly. You can also click \"Talk to Cédric →\" below.";
      }
      if (t.includes('cédric') || t.includes('cedric') || t.includes('background') || t.includes('experience') || t.includes('who')) {
        return `Cédric Barme, founder of NSY. ${yearsExperience} years behind the scenes of France's largest financial institutions — distributed architecture, real-time trading platforms, legacy core migration. Now an independent consultant via EURL.`;
      }
      return `Good question — I can guide you through NSY services, Cédric's expertise, the 3D showcase (${hobbiePath} section) or how to get in touch. For something more specific, the contact form is the most efficient.`;
    }

    // ───── FRENCH knowledge base ─────
    if (t.includes('tarif') || t.includes('prix') || t.includes('coût') || t.includes('cout') || t.includes('budget')) {
      return "Service Conseil technique : tarif journalier ou forfait, mission directe via EURL — à cadrer selon le scope. Service Création web · IA : à partir de 9 800 € HT en forfait clé en main. Pour un devis précis, le formulaire de contact est le plus rapide.";
    }
    if (t.includes('disponib') || t.includes('quand') || t.includes('démarr') || t.includes('demarr')) {
      return `Cédric est disponible pour de nouvelles missions à partir du Q4 ${currentYear}. Trois clients en parallèle maximum pour garder un niveau d'exigence non négociable.`;
    }
    if (t.includes('banque') || t.includes('finance') || t.includes('assurance')) {
      return `Oui — c'est même le cœur du métier. ${yearsExperience} ans d'expertise sur des chantiers critiques en banque de détail, banque privée, assurance vie et asset management. Habitué aux environnements régulés (ACPR, AMF, RGPD, DORA).`;
    }
    if (t.includes('3d') || t.includes('blender') || t.includes('wireframe') || t.includes('animation') || t.includes('modèle') || t.includes('modele') || t.includes('loisir') || t.includes('hobby') || t.includes('hobbies') || t.includes('hobbie') || t.includes('renault') || t.includes('rendu') || t.includes('voiture')) {
      return `Oui, la 3D maison fait partie des cordes créatives — rendus Blender optimisés pour le web, légers et rapides (zéro impact sur la performance des pages). Deux exemples concrets dans la section Loisirs : une animation 3D en boucle et un modèle wireframe interactif d'une Renault R25 Baccara que vous pouvez faire pivoter. Descendez jusqu'à ${hobbiePath} pour les voir.`;
    }
    if (t.includes('service') || t.includes('offre') || t.includes('faites')) {
      return "Deux offres : (1) Conseil technique senior pour la finance et l'assurance — architecture, audit, migration, conformité. (2) Création web propulsée par l'IA pour les entreprises en transition — sites, plateformes SaaS et intégration de modèles (Claude, OpenAI, Mistral). En bonus : animations 3D / modèles interactifs pour le web.";
    }
    if (t.includes('contact') || t.includes('joindre') || t.includes('rendez-vous') || t.includes('rdv')) {
      return "Le plus simple : remplir le formulaire en bas de page (réponse sous 48h ouvrées) ou écrire directement à contact@nsy.fr. Vous pouvez aussi cliquer sur « Parler à Cédric → » ci-dessous.";
    }
    if (t.includes('cédric') || t.includes('cedric') || t.includes('parcours') || t.includes('expérience') || t.includes('experience')) {
      return `Cédric Barme, fondateur de NSY. ${yearsExperience} ans dans les coulisses techniques des plus grandes institutions financières françaises — architecture distribuée, plateformes de trading temps réel, migration de socles legacy. Aujourd'hui consultant indépendant via EURL.`;
    }
    return `Bonne question — je peux vous orienter sur les services NSY, l'expertise de Cédric, la 3D maison (section ${hobbiePath}) ou la prise de contact. Pour quelque chose de plus précis, le formulaire de contact reste le plus efficace.`;
  }

  function send(text) {
    const content = (text ?? input?.value ?? '').trim();
    if (!content) return;
    if (input) input.value = '';
    suggestions?.classList.add('hidden');
    appendMessage('user', content);
    const typing = appendTyping();
    setTimeout(() => {
      typing?.remove();
      appendMessage('assistant', botReply(content));
    }, 600 + Math.random() * 400);
  }

  sendBtn?.addEventListener('click', () => send());
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  document.querySelectorAll('.cbot-chip').forEach((chip) => {
    chip.addEventListener('click', () => send(chip.textContent));
  });

  // ───── 3D model framing (hobbies page) ─────
  // Even with bounds="tight", some GLBs need an explicit reframe after load
  // to ensure the orbit pivot lands on the visible geometry center.
  const renaultViewer = document.getElementById('renault-viewer');
  if (renaultViewer) {
    renaultViewer.addEventListener('load', () => {
      // updateFraming() recomputes camera-target on the visible bounding box
      // and resets the camera-orbit radius accordingly.
      if (typeof renaultViewer.updateFraming === 'function') {
        renaultViewer.updateFraming();
      }
    });
  }

  // ───── Language switcher (🇫🇷 / 🇬🇧) — sets cookie + redirect to matching page ─────
  // Slugs are real translations (loisirs/hobbies, mentions-legales/legal-notice, etc.)
  // rather than -en.html suffixes, so we need an explicit FR ↔ EN map.
  // Exception: index.html stays "index.html" in EN as index-en.html (no good translation).
  const SLUG_FR_TO_EN = {
    'index.html': 'index-en.html',
    'mentions-legales.html': 'legal-notice.html',
    'confidentialite.html': 'privacy.html',
  };
  const SLUG_EN_TO_FR = Object.fromEntries(
    Object.entries(SLUG_FR_TO_EN).map(([fr, en]) => [en, fr])
  );

  document.querySelectorAll('.lang-flag').forEach((flag) => {
    flag.addEventListener('click', (e) => {
      e.preventDefault();
      const lang = flag.dataset.lang;
      // Persist preference for 1 year so the auto-detect on / does not override
      document.cookie = `nsy_lang=${lang}; path=/; max-age=31536000; SameSite=Lax`;

      // Derive the target URL from the current pathname
      const path = window.location.pathname;
      const file = path.split('/').pop() || 'index.html';
      const hash = window.location.hash || '';
      let target;
      if (lang === 'en') {
        // FR → EN: look up, or stay on the same page if already EN
        target = SLUG_FR_TO_EN[file] || file;
      } else {
        // EN → FR: reverse lookup, or stay on the same page if already FR
        target = SLUG_EN_TO_FR[file] || file;
      }
      window.location.href = target + hash;
    });
  });

  // ───── Hero video loader (cyan ring + percentage in blue sphere) ─────
  const glyphVideo = document.getElementById('glyph-video');
  const glyphLoader = document.getElementById('glyph-loader');
  const glyphPct = document.getElementById('glyph-loader-pct');
  const glyphRing = document.getElementById('glyph-loader-progress');
  const GLYPH_CIRC = 2 * Math.PI * 46;

  if (glyphVideo && glyphLoader) {
    const setVideoProgress = (p) => {
      const pct = Math.max(0, Math.min(100, Math.round(p * 100)));
      if (glyphPct) glyphPct.textContent = pct + '%';
      if (glyphRing) glyphRing.style.strokeDashoffset = GLYPH_CIRC * (1 - pct / 100);
    };

    const hideLoader = () => {
      setVideoProgress(1);
      setTimeout(() => glyphLoader.classList.add('hidden'), 350);
    };

    glyphVideo.addEventListener('progress', () => {
      if (!glyphVideo.duration || !isFinite(glyphVideo.duration) || glyphVideo.buffered.length === 0) return;
      const end = glyphVideo.buffered.end(glyphVideo.buffered.length - 1);
      setVideoProgress(end / glyphVideo.duration);
    });

    glyphVideo.addEventListener('canplaythrough', hideLoader, { once: true });
    glyphVideo.addEventListener('error', () => {
      glyphLoader.classList.add('error');
      if (glyphPct) glyphPct.textContent = 'ERR';
    });

    // Edge case: video already cached / fully buffered before listeners attach
    if (glyphVideo.readyState >= 4) hideLoader();
  }

  // ───── CTA banner: gradients react to input ─────
  // Desktop (with hover): cyan/orange gradients follow the mouse cursor.
  // Touch/tablet (no hover): auto-animate via sinusoidal motion on X and
  // Y with different periods, only while the banner is in the viewport
  // (battery courtesy). Respects prefers-reduced-motion.
  const ctaBanner = document.querySelector('.cta-banner');
  if (ctaBanner) {
    // Detect "touch / no-hover" via 3 complementary signals — any positive
    // is treated as touch-primary. Some Android browsers and old iOS Safari
    // don't honor `(hover: none)` correctly.
    const noHover =
      window.matchMedia('(hover: none)').matches ||
      window.matchMedia('(pointer: coarse)').matches ||
      ('ontouchstart' in window) ||
      (navigator.maxTouchPoints || 0) > 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    console.info('[CTA] mode:', noHover ? 'auto-animation' : 'mouse-tracking', '— reducedMotion:', reducedMotion);

    if (noHover && !reducedMotion) {
      // Auto-animate on touch devices
      ctaBanner.classList.add('hover-active'); // disable goal-interpolation; we drive every frame
      const start = performance.now();
      const PERIOD_X = 14000;
      const PERIOD_Y = 19000;
      let rafId = null;
      let active = false;

      const tick = (now) => {
        const tx = ((now - start) % PERIOD_X) / PERIOD_X * 2 * Math.PI;
        const ty = ((now - start) % PERIOD_Y) / PERIOD_Y * 2 * Math.PI;
        const x = 50 + 35 * Math.sin(tx); // sweeps 15% → 85% horizontally
        const y = 50 + 35 * Math.cos(ty); // sweeps 15% → 85% vertically
        ctaBanner.style.setProperty('--mx', x.toFixed(2) + '%');
        ctaBanner.style.setProperty('--my', y.toFixed(2) + '%');
        if (active) rafId = requestAnimationFrame(tick);
      };

      const io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !active) {
          active = true;
          rafId = requestAnimationFrame(tick);
        } else if (!entry.isIntersecting && active) {
          active = false;
          if (rafId) cancelAnimationFrame(rafId);
          rafId = null;
        }
      }, { rootMargin: '50px' });
      io.observe(ctaBanner);
    } else {
      // Mouse tracking on hover-capable devices
      ctaBanner.addEventListener('mouseenter', () => ctaBanner.classList.add('hover-active'));
      ctaBanner.addEventListener('mousemove', (e) => {
        const rect = ctaBanner.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        ctaBanner.style.setProperty('--mx', `${x.toFixed(2)}%`);
        ctaBanner.style.setProperty('--my', `${y.toFixed(2)}%`);
      });
      ctaBanner.addEventListener('mouseleave', () => {
        ctaBanner.classList.remove('hover-active');
        ctaBanner.style.removeProperty('--mx');
        ctaBanner.style.removeProperty('--my');
      });
    }
  }

  // ───── Service cards: image stays visible until video is ready, then cross-fades ─────
  document.querySelectorAll('.svc-cover-image').forEach((cover) => {
    const video = cover.querySelector('.svc-bg-video');
    if (!video) return;

    const reveal = () => cover.classList.add('video-ready');

    if (video.readyState >= 4) {
      reveal();
    } else {
      video.addEventListener('canplaythrough', reveal, { once: true });
    }

    // Some browsers block autoplay until first user interaction — retry once a play attempt resolves.
    video.play().catch(() => {});
  });

  // ───── Smooth fade across loop point for every looping <video> ─────
  // Fades opacity to 0 in the last ~triggerWindow seconds, then back to 1
  // in the first ~triggerWindow seconds after the loop. The seam is hidden
  // while the element is invisible — no visible jump cut.
  function setupLoopFade(video, fadeDurationSec = 0.5, triggerWindowSec = 0.55) {
    if (!video) return;
    let phase = 'visible'; // 'visible' | 'fading-out'
    const transition = `opacity ${Math.round(fadeDurationSec * 1000)}ms ease`;

    const onTime = () => {
      if (!video.duration || !isFinite(video.duration)) return;
      const remaining = video.duration - video.currentTime;
      if (phase === 'visible' && remaining < triggerWindowSec) {
        phase = 'fading-out';
        video.style.transition = transition;
        video.style.opacity = '0';
      } else if (phase === 'fading-out' && video.currentTime < triggerWindowSec && remaining > triggerWindowSec) {
        phase = 'visible';
        video.style.transition = transition;
        video.style.opacity = '1';
      }
    };

    const attach = () => video.addEventListener('timeupdate', onTime);
    if (video.readyState >= 4) attach();
    else video.addEventListener('canplaythrough', attach, { once: true });
  }

  // Hero sphere video reads better with the raw loop — only fade
  // the service card videos.
  document.querySelectorAll('video[loop]').forEach((v) => {
    if (v.id === 'glyph-video') return;
    setupLoopFade(v);
  });
})();
