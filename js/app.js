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

  // Page language from <html lang="…"> — drives UI strings (form, chatbot…).
  const pageLang = (document.documentElement.lang || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';

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
    // Bilingual UI strings for the form states / toasts, by page language.
    const F = pageLang === 'en' ? {
      sending: 'Sending…',
      sent: 'Sent ✓',
      retry: 'Retry',
      ok: 'Message received — reply within 48 business hours.',
      errSend: 'Sending failed — please try again.',
      errNet: 'Network error — please try again.',
    } : {
      sending: 'Envoi…',
      sent: 'Envoyé ✓',
      retry: 'Réessayer',
      ok: 'Message reçu — réponse sous 48h ouvrées.',
      errSend: "Erreur d'envoi — veuillez réessayer.",
      errNet: 'Erreur réseau — veuillez réessayer.',
    };
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
      setLabel(F.sending);

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
          setLabel(F.sent);
          showToast(F.ok);
          form.reset();
          const consultingOpt = document.querySelector('.opt[data-service="consulting"]');
          document.querySelectorAll('.opt').forEach((o) => o.classList.remove('active'));
          if (consultingOpt) consultingOpt.classList.add('active');
          const serviceInput = document.getElementById('service');
          if (serviceInput) serviceInput.value = 'consulting';
        } else {
          if (submitBtn) submitBtn.disabled = false;
          setLabel(F.retry);
          showToast(data.error || F.errSend, true);
        }
      } catch (err) {
        if (submitBtn) submitBtn.disabled = false;
        setLabel(F.retry);
        showToast(F.errNet, true);
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

  // Avatar animé d'Ansley (mascotte) : la vidéo ne joue QUE panneau ouvert
  // (économie CPU/batterie ; elle est en preload="none" donc rien ne charge tant
  // que le chat n'est pas ouvert). Boomerang seamless → pas de fondu de boucle JS.
  const ansleyVid = document.getElementById('ansley-video');
  const playAnsley = () => ansleyVid && ansleyVid.play().catch(() => {});
  const pauseAnsley = () => ansleyVid && ansleyVid.pause();

  // Bulle de présentation d'Ansley (près du FAB fermé) — masquée une fois vue.
  const greeter = document.getElementById('cbot-greeter');
  const greeterClose = document.getElementById('cbot-greeter-close');
  const GREET_KEY = 'nsy-cbot-greeted';
  const hideGreeter = () => greeter && greeter.classList.remove('show');
  const dismissGreeter = () => { hideGreeter(); try { sessionStorage.setItem(GREET_KEY, '1'); } catch (e) { /* private mode */ } };

  if (fab && panel) {
    fab.addEventListener('click', () => {
      const isOpen = panel.classList.toggle('open');
      fab.classList.toggle('open', isOpen);
      if (isOpen) { refreshHealth(); playAnsley(); dismissGreeter(); }  // sonde l'IA, anime Ansley, masque la bulle
      else pauseAnsley();
    });
    closeBtn?.addEventListener('click', () => {
      panel.classList.remove('open');
      fab.classList.remove('open');
      pauseAnsley();
    });
    escalate?.addEventListener('click', () => {
      panel.classList.remove('open');
      fab.classList.remove('open');
      pauseAnsley();
      // Site multi-pages : la section contact vit sur contact.html / contact-en.html.
      const c = document.getElementById('contact');
      if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.location.href = pageLang === 'en' ? 'contact-en.html' : 'contact.html';
    });

    // Apparition de la bulle : peu après le chargement, si pas déjà rejetée ni le
    // chat ouvert. Clic sur la bulle → ouvre le chat ; clic sur la croix → masque.
    let alreadyGreeted = false;
    try { alreadyGreeted = sessionStorage.getItem(GREET_KEY) === '1'; } catch (e) { /* private mode */ }
    if (greeter && !alreadyGreeted) {
      setTimeout(() => { if (!panel.classList.contains('open')) greeter.classList.add('show'); }, 1800);
    }
    greeterClose?.addEventListener('click', (e) => { e.stopPropagation(); dismissGreeter(); });
    greeter?.addEventListener('click', () => { if (!panel.classList.contains('open')) fab.click(); });
  }

  function makeAvatar() {
    const a = document.createElement('div');
    a.className = 'cbot-msg-avatar';
    const img = document.createElement('img');
    img.src = 'public/ansley.png';
    img.alt = 'Ansley';
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
    // Assistant copy is 100% static strings we author (may contain <b>/links),
    // so innerHTML is safe here. User input must NEVER be rendered as HTML.
    if (role === 'assistant') {
      bubble.innerHTML = content;
    } else {
      bubble.textContent = content;
    }
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

  // Le widget est injecté sur les 36 pages via partials/chatbot.{fr,en}.html
  // (script sync-partials) — le code ne s'active que si le markup est présent.
  const hobbiePath = pageLang === 'en' ? 'the 3D Design page' : 'la page Conception 3D';

  // ───── Assistant IA (LLM via chat.php) ─────
  // Le widget interroge d'abord le proxy serveur chat.php : un LLM (Mistral,
  // hébergé en UE) ancré dans llms-full.txt (RAG). Le moteur de règles local
  // ci-dessous reste le filet de sécurité : pas de clé configurée, quota
  // atteint, API en panne ou hors-ligne → le bot répond quand même.
  const AI_PAGE = location.pathname.split('/').pop() || 'index.html';
  const HIST_KEY = 'nsy-cbot-hist';
  const AI_OFF_KEY = 'nsy-cbot-ai-off';
  let aiFails = 0; // 2 échecs réseau/serveur → mode local pour la session
  const aiOff = () => {
    try { if (sessionStorage.getItem(AI_OFF_KEY) === '1') return true; } catch (e) { /* private mode */ }
    return aiFails >= 2;
  };

  const aiBadge = document.getElementById('cbot-ai-badge');
  const aiStatus = document.getElementById('cbot-status');
  const aiNote = document.getElementById('cbot-note');
  const AI_HEALTH_KEY = 'nsy-cbot-health';
  let lastModel = '';

  function setAiBadge(model) {
    if (model) lastModel = model;
    const m = model || lastModel;
    if (!aiBadge || !m) return;
    const fam = /ministral|mistral|nemo|magistral/i.test(m) ? 'Mistral'
      : /llama/i.test(m) ? 'Llama'
      : /qwen/i.test(m) ? 'Qwen' : m.split('-')[0];
    aiBadge.textContent = (pageLang === 'en' ? 'AI · ' : 'IA · ') + fam;
  }

  // Voyant d'état : 'ai' = vert (IA générative Mistral) · 'rules' = orange
  // (Mistral indisponible → réponses par le moteur de règles local). Met à jour
  // la pastille, le libellé de statut et la note de bas de widget.
  function setStatus(mode) {
    const en = pageLang === 'en';
    if (aiStatus) {
      aiStatus.innerHTML = mode === 'rules'
        ? '<span class="cbot-online is-degraded"></span>' + (en ? 'AI unavailable · local replies' : 'IA indisponible · réponses locales')
        : '<span class="cbot-online"></span>' + (en ? 'Online · Generative AI' : 'En ligne · IA générative');
    }
    if (aiNote) {
      aiNote.textContent = mode === 'rules'
        ? (en ? 'Automated answers · double-check key points' : 'Réponses automatisées · vérifiez les points clés')
        : (en ? 'AI-generated answers (Mistral, EU) · no sensitive data' : 'Réponses générées par IA (Mistral, UE) · pas de données sensibles');
    }
    if (aiBadge && mode === 'rules') aiBadge.textContent = en ? 'AI' : 'IA';
  }
  // Compat : ancien nom utilisé dans le flux d'envoi.
  function rulesModeUI() { setStatus('rules'); }

  const cacheHealth = (available, model) => {
    try { sessionStorage.setItem(AI_HEALTH_KEY, JSON.stringify({ available, model: model || lastModel, ts: Date.now() })); } catch (e) { /* private mode */ }
  };
  const applyHealth = (available, model) => {
    if (available) { setStatus('ai'); if (model) setAiBadge(model); }
    else setStatus('rules');
  };

  // Health-check : demande à chat.php si l'IA (Mistral) est disponible, et pose
  // le voyant en conséquence — AVANT tout message. Résultat mis en cache 3 min
  // (sessionStorage) ; côté serveur une sonde /v1/models gratuite + cache 90 s
  // évite de solliciter le fournisseur à chaque ouverture.
  async function refreshHealth() {
    if (aiOff()) { setStatus('rules'); return; }
    try {
      const c = JSON.parse(sessionStorage.getItem(AI_HEALTH_KEY) || 'null');
      if (c && Date.now() - c.ts < 180000) { applyHealth(c.available, c.model); return; }
    } catch (e) { /* private mode */ }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      // `?h=1` : marqueur pour les logs — sans lui, la sonde de disponibilité
      // est indistinguable d'un vrai message et gonfle le KPI « conversations ».
      const res = await fetch('chat.php?h=1', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ health: true }), signal: ctrl.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      const available = !!(data && data.ok && data.available);
      if (data && data.reason === 'noconfig') {
        try { sessionStorage.setItem(AI_OFF_KEY, '1'); } catch (e) { /* private mode */ }
      }
      applyHealth(available, data && data.model);
      cacheHealth(available, data && data.model);
    } catch (e) {
      // Ping impossible → l'IA est probablement injoignable (la génération
      // échouerait aussi) : on affiche le mode règles, honnêtement.
      setStatus('rules');
    }
  }

  // Rendu Markdown minimal et SÛR pour la sortie du LLM : on échappe tout le
  // HTML, puis on ne réintroduit que **gras** et les liens INTERNES relatifs
  // (page.html#ancre). Aucun lien externe, aucun javascript: possible.
  function mdToHtml(text) {
    const esc = String(text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Liens externes OFFICIELS autorisés (même whitelist que chat.php, owner
    // juillet 2026) : réalisations clientes + profils publics. Ouverts dans un
    // nouvel onglet. Tout autre lien externe reste du texte inerte.
    const EXT_OK = [
      'https://www.prv-concept.com', 'https://prv-concept.com',
      'https://www.lecerfthym.fr', 'https://lecerfthym.fr',
      'https://www.linkedin.com/company/nsy-new-software-yard',
      'https://www.linkedin.com/in/c%c3%a9dric-barme',
      'https://www.linkedin.com/in/cédric-barme',
      'https://github.com/machouse78',
      'https://youtube.com/@new-software-yard',
      'https://www.youtube.com/@new-software-yard',
      'https://www.linkedin.com/pulse/seo-vs-geo-votre-site-est-bien-class%c3%a9-sur-google-0znee',
      'https://www.facebook.com/share/17vylqjake',
      'https://www.linkedin.com/pulse/votre-forum-est-une-mine-dor-pour-lia-%25c3%25a0-condition-1icee',
      'https://www.facebook.com/share/p/1ey4fxbyda',
      'https://www.linkedin.com/pulse/un-site-web-en-week-end-gr%25c3%25a2ce-%25c3%25a0-lia-verdict-chiffr%25c3%25a9-hqq8e',
      'https://www.facebook.com/reel/2812928635744339',
      'https://www.linkedin.com/pulse/des-t%25c3%25a9raoctets-au-m%25c3%25a9gaoctet-la-supervision-est-une-duyee',
      'https://www.facebook.com/reel/1080327827884467',
    ];
    const extOk = (u) => { const l = u.toLowerCase(); return EXT_OK.some((p) => l.startsWith(p)); };
    return esc
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      // Une seule passe lien Markdown OU URL nue : un href déjà posé ne peut
      // pas être re-capturé par la branche « URL nue ».
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<)\]]+)/g, (m, label, url, bare) => {
        if (label) {
          if (/^[a-z0-9-]+\.html(#[\w-]*)?$/i.test(url)) return `<a href="${url}">${label}</a>`;
          if (extOk(url)) return `<a href="${url}" target="_blank" rel="noopener">${label}</a>`;
          return label;
        }
        const clean = bare.replace(/[.,;:!?]+$/, '');
        const tail = bare.slice(clean.length);
        return extOk(clean)
          ? `<a href="${clean}" target="_blank" rel="noopener">${clean.replace(/^https?:\/\//, '')}</a>${tail}`
          : m;
      })
      .replace(/^\s*[-*•]\s+/gm, '• ')
      .replace(/\n/g, '<br>');
  }

  // Effet machine à écrire : le HTML final est posé d'un coup (liens/gras ok),
  // puis les nœuds texte se dévoilent progressivement. Désactivé si l'visiteur
  // préfère réduire les animations.
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function typewrite(bubble, html) {
    if (!bubble) return;
    bubble.innerHTML = html;
    if (reduceMotion) return;
    const nodes = [];
    (function collect(n) {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) nodes.push([c, c.nodeValue]);
        else collect(c);
      }
    })(bubble);
    for (const [n] of nodes) n.nodeValue = '';
    let i = 0, j = 0;
    // setInterval plutôt que requestAnimationFrame : le rAF est suspendu dans
    // les onglets masqués/throttlés — le texte resterait invisible. L'interval
    // continue (throttlé à ~1s en fond, acceptable) et se coupe à la fin.
    const timer = setInterval(() => {
      let budget = 4; // ≈160 caractères/s
      while (budget-- > 0 && i < nodes.length) {
        const pair = nodes[i];
        pair[0].nodeValue = pair[1].slice(0, ++j);
        if (j >= pair[1].length) { i++; j = 0; }
      }
      if (body) body.scrollTop = body.scrollHeight;
      if (i >= nodes.length) clearInterval(timer);
    }, 25);
  }

  // Mémoire de conversation (sessionStorage) : l'échange suit le visiteur de
  // page en page. Contenu stocké en texte/markdown — jamais de HTML brut.
  const loadHist = () => {
    try { return JSON.parse(sessionStorage.getItem(HIST_KEY)) || []; } catch (e) { return []; }
  };
  const saveHist = (h) => {
    try { sessionStorage.setItem(HIST_KEY, JSON.stringify(h.slice(-12))); } catch (e) { /* private mode */ }
  };
  const hist = loadHist();
  if (hist.length && body) {
    for (const m of hist) {
      appendMessage(m.role, m.role === 'assistant' ? mdToHtml(m.content) : m.content);
    }
    suggestions?.classList.add('hidden');
  }

  // ───── Chatbot knowledge engine (rule-based, bilingual) ─────
  // Each intent declares accent-free keyword cues + several response variants
  // per language. We normalise the user message (lowercase, strip accents and
  // punctuation), score every "content" intent by the specificity of its
  // matched cues (longer / multi-word cues weigh more), and answer the best
  // match — rotating variants so the bot doesn't repeat itself. Greetings,
  // thanks and goodbye only fire when no content intent matched. A short
  // follow-up ("et ?", "plus de détails"…) re-opens the previous topic.

  const XP = yearsExperience;

  const norm = (s) => (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // drop accents
    .replace(/[^a-z0-9€$\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ───── Per-message language detection ─────
  // The bot answers in the language of the QUESTION, not just the page. So an
  // English visitor who lands on the FR page (or vice versa) still gets a
  // reply in their language. Ambiguous/short messages fall back to the page
  // language. Detection is a cheap stopword + accent heuristic — enough to
  // tell FR from EN reliably for the kinds of questions this bot handles.
  const FR_MARKERS = new Set([
    'vous','etes','est','quel','quelle','quels','quelles','combien','votre','vos','nos','notre',
    'pourquoi','comment','ca','faites','faire','bonjour','bonsoir','salut','merci','oui','non',
    'avez','avec','pour','une','des','les','je','parlez','francais','disponible','tarif','prix',
    'cout','realisez','proposez','gardez','ou','quand','aussi','aussi','votre'
  ]);
  const EN_MARKERS = new Set([
    'you','are','is','what','whats','how','much','the','do','does','did','your','where','why','who',
    'when','hello','hi','hey','thanks','thank','please','can','could','would','with','for','about',
    'available','website','price','cost','make','offer','speak','english','your','there','i'
  ]);

  function detectLang(raw) {
    const text = norm(raw);
    if (!text) return pageLang;
    const toks = text.split(' ');
    let fr = 0, en = 0;
    for (const t of toks) {
      if (FR_MARKERS.has(t)) fr++;
      if (EN_MARKERS.has(t)) en++;
    }
    // Accented letters are a strong French signal (English barely uses them)
    if (/[éèêëàâäçùûüîïôö]/i.test(raw)) fr += 2;
    if (en > fr) return 'en';
    if (fr > en) return 'fr';
    return pageLang; // tie / unknown → page default
  }

  // Whole-word (or stem) match for single cues; substring for multi-word cues.
  const cueHit = (cue, text, tokens) => {
    if (cue.indexOf(' ') !== -1) return text.indexOf(cue) !== -1;
    for (const tok of tokens) {
      if (tok === cue) return true;
      if (cue.length >= 3 && tok.startsWith(cue)) return true; // tarif→tarifs, disponib→disponibilite
    }
    return false;
  };

  // Content intents — ordered by priority (earlier wins ties).
  const INTENTS = [
    {
      id: 'pricing',
      cues: ['tarif','prix','cout','combien','devis','budget','cher','montant','ca coute','prix indicatif',
              'price','pricing','cost','rate','quote','how much','fee'],
      fr: [
        `La tarification s'établit <b>en fonction du besoin</b> : périmètre, complexité, échéances. Conseil technique comme création web · IA font l'objet d'un devis après cadrage — décrivez votre projet via le formulaire, réponse sous 48 h ouvrées.`,
        `Pas de grille tarifaire toute faite : chaque mission est chiffrée selon son périmètre réel. Le plus efficace : le formulaire de contact (ou le questionnaire de faisabilité pour un projet web) — vous recevez une lecture honnête et un ordre de grandeur sous 48 h ouvrées.`
      ],
      en: [
        `Pricing is <b>based on your need</b>: scope, complexity, deadlines. Consulting and web creation · AI alike are quoted after scoping — describe your project through the form, reply within 48 business hours.`,
        `No standard price list: every engagement is quoted on its real scope. The most effective route: the contact form (or the feasibility questionnaire for a web project) — you get an honest read and a ballpark within 48 business hours.`
      ]
    },
    {
      id: 'availability',
      cues: ['disponib','dispo','quand','delai','commenc','demarr','libre','planning','agenda','prochaine',
              'available','availability','when','start','lead time','booked','timeline'],
      fr: [
        `La disponibilité s'évalue au moment de la demande : NSY travaille avec <b>trois clients en parallèle maximum</b>, pour tenir un niveau d'exigence non négociable. Décrivez votre échéance via le formulaire — réponse sous 48 h ouvrées.`,
        `Le créneau est volontairement limité (3 clients max en simultané). Si votre projet a une échéance, indiquez-la dans le formulaire : la faisabilité calendaire fait partie de la réponse.`
      ],
      en: [
        `Availability is assessed per request: NSY works with <b>three clients in parallel at most</b>, to hold a non-negotiable quality bar. Describe your timeline through the form — reply within 48 business hours.`,
        `Capacity is deliberately limited (3 clients max at once). If your project has a deadline, mention it in the form: scheduling feasibility is part of the reply.`
      ]
    },
    {
      id: 'web_ai',
      cues: ['site','site web','web','website','refonte','refondre','redesign','refaire','moderniser','application','appli','app','saas','plateforme','platform',
              'ia','intelligence artificielle','llm','claude','openai','mistral','gpt','chatbot','agent',
              'rag','recherche semantique','semantic','ai','automatis','automation'],
      fr: [
        `La création web NSY, c'est des sites et plateformes nouvelle génération avec l'IA au cœur : intégration de LLM (Claude, OpenAI, Mistral), chatbots métier, recherche sémantique, génération de contenu, agents. Le tout pensé pour la performance et le SEO — tarification en fonction du besoin.`,
        `Côté web : sites vitrines et plateformes SaaS, avec intégration de modèles IA (assistant, recherche sémantique, RAG, automatisations). Ce site lui-même — multilingue, chatbot, 3D temps réel — sert de démonstrateur. Offre clé en main, chiffrée selon le périmètre.`,
        `Deux parcours : la création d'un site neuf, ou la refonte d'un site existant — préserver le référencement acquis, reprendre les contenus et les données, planifier les redirections. Le questionnaire de faisabilité distingue les deux dès sa première question.`
      ],
      en: [
        `NSY web creation means next-generation sites and platforms with AI at the core: LLM integration (Claude, OpenAI, Mistral), business chatbots, semantic search, content generation, agents — all built for performance and SEO — pricing based on your need.`,
        `On the web side: brochure sites and SaaS platforms with AI model integration (assistant, semantic search, RAG, automations). This very site — multilingual, chatbot, real-time 3D — is the showcase. A turnkey offering, quoted on scope.`,
        `Two paths: a brand-new site, or a redesign of an existing one — preserving earned rankings, carrying over content and data, planning redirects. The feasibility questionnaire separates the two from its first question.`
      ]
    },
    {
      id: 'finance_insurance',
      cues: ['banque','bancaire','finance','financ','assurance','assureur','asset','trading','acpr','amf',
              'dora','fintech','reglement','regule','conformite','bank','banking','insurance','insurer',
              'regulated','compliance'],
      fr: [
        `C'est le cœur du métier. ${XP} ans sur des chantiers critiques en banque de détail, banque privée, assurance vie et asset management — architecture distribuée, systèmes critiques temps réel, migration de socles legacy. Habitué des environnements régulés (ACPR, AMF, RGPD, DORA). Et en mission, l'expertise IA de NSY sert aussi la productivité de vos équipes : automatisation, outillage.`,
        `Oui — finance et assurance sont le terrain principal de Cédric : ${XP} ans en institutions financières françaises, sur des systèmes critiques et régulés. Migration Java EE, supervision de production, conformité (ACPR, AMF, DORA). Si votre contexte est régulé, c'est exactement la zone de confort. Bonus : l'apport d'expertise IA en cours de mission, côté productivité.`
      ],
      en: [
        `That's the core specialty. ${XP} years on critical builds in retail banking, private banking, life insurance and asset management — distributed architecture, real-time critical systems, legacy-core migration. Fluent in regulated environments (ACPR, AMF, GDPR, DORA). On-mission, NSY's AI expertise also lifts team productivity: automation and tooling.`,
        `Yes — finance and insurance are Cédric's main ground: ${XP} years inside French financial institutions, on critical, regulated systems. Java EE migration, production oversight, compliance (ACPR, AMF, DORA). If your context is regulated, that's exactly the comfort zone. Bonus: AI expertise brought into the mission, on the productivity side.`
      ]
    },
    {
      id: 'threeD',
      cues: ['3d','blender','wireframe','animation','modele','rendu','render','voiture','renault','baccara',
              'loisir','hobby','hobbies','conception','youtube'],
      fr: [
        `La 3D fait partie des cordes créatives : rendus Blender optimisés pour le web, légers et rapides. Deux exemples concrets sur la page Conception 3D — une animation 3D (vidéo YouTube) et un modèle wireframe interactif d'une Renault R25 Baccara que vous pouvez faire pivoter. À voir : ${hobbiePath}.`,
        `Oui, animations et modèles 3D maison — du Blender pensé pour le web (zéro ralentissement). Le wireframe cyan de la Renault R25 sur ${hobbiePath} est interactif : cliquez-glissez pour le faire tourner. Et oui, ça aussi ça peut s'intégrer à votre site.`
      ],
      en: [
        `3D is one of the creative strings: Blender renders optimised for the web — light and fast. Two live examples on the 3D Design page — a 3D animation (YouTube video) and an interactive wireframe model of a Renault R25 Baccara you can rotate. Have a look: ${hobbiePath}.`,
        `Yes, in-house 3D animations and models — Blender built for the web (no slowdown). The cyan Renault R25 wireframe on ${hobbiePath} is interactive: click and drag to spin it. And yes, this can be embedded into your site too.`
      ]
    },
    {
      id: 'services',
      cues: ['service','offre','offrez','prestation','proposez','propose','faites','what do you do',
              'what do you offer','offering','help with'],
      fr: [
        `Deux offres : <b>(1) Conseil technique senior</b> pour la finance et l'assurance — architecture, audit, migration, conformité, expertise IA en mission. <b>(2) Création web propulsée par l'IA</b> — sites, plateformes SaaS, intégration de LLM. En bonus : animations et modèles 3D pour le web. Sur quel axe puis-je préciser ?`,
        `NSY couvre deux choses : du conseil technique senior (finance/assurance, systèmes critiques) et de la création web avec l'IA (sites, SaaS, chatbots, recherche sémantique). Plus une touche 3D. Dites-moi votre besoin et je vous oriente.`
      ],
      en: [
        `Two offerings: <b>(1) Senior technical consulting</b> for finance & insurance — architecture, audit, migration, compliance, on-mission AI expertise. <b>(2) AI-powered web creation</b> — sites, SaaS platforms, LLM integration. Bonus: 3D animations and models for the web. Which one should I expand on?`,
        `NSY does two things: senior technical consulting (finance/insurance, critical systems) and AI-powered web creation (sites, SaaS, chatbots, semantic search). Plus a 3D touch. Tell me your need and I'll point you the right way.`
      ]
    },
    {
      id: 'about_cedric',
      cues: ['cedric','barme','fondateur','founder','parcours','experience','qui est','qui etes','profil',
              'cv','background','who is','who are','about you'],
      fr: [
        `Cédric Barme, fondateur de NSY (EURL créée en 2018). ${XP} ans dans les coulisses techniques des plus grandes institutions financières françaises — architecture distribuée, systèmes critiques temps réel, migration de socles legacy. Aujourd'hui consultant indépendant, et créateur web propulsé par l'IA.`,
        `Le fondateur, c'est Cédric Barme : ${XP} ans d'ingénierie sur des systèmes critiques (banque, assurance), puis création de l'EURL NSY en 2018. Tech lead, architecte, et depuis peu, création web avec l'IA. Le profil LinkedIn est en haut de page.`
      ],
      en: [
        `Cédric Barme, founder of NSY (EURL founded in 2018). ${XP} years behind the scenes of France's largest financial institutions — distributed architecture, real-time critical systems, legacy-core migration. Now an independent consultant and AI-powered web creator.`,
        `The founder is Cédric Barme: ${XP} years of engineering on critical systems (banking, insurance), then founded the NSY EURL in 2018. Tech lead, architect, and lately AI-powered web creation. His LinkedIn is linked at the top of the page.`
      ]
    },
    {
      id: 'tech_stack',
      cues: ['techno','technologie','stack','java','jvm','cloud','aws','gcp','azure','kubernetes','docker',
              'conteneur','container','react','node','microservice','outil','tooling','technical stack'],
      fr: [
        `Côté technique : architecture distribuée et microservices, écosystème JVM/Java EE, cloud (AWS, GCP, Azure), conteneurs (Docker, Kubernetes), front moderne, et intégration de LLM pour la partie IA. Le choix d'outils se fait selon votre existant — pas de dogme, du pragmatisme.`,
        `Stack typique : JVM/Java pour le back critique, cloud + conteneurs pour l'exploitation, front web moderne, et briques IA (Claude/OpenAI/Mistral) pour l'intégration intelligente. Tout est adapté à votre contexte plutôt qu'imposé.`
      ],
      en: [
        `On the tech side: distributed architecture and microservices, JVM/Java EE ecosystem, cloud (AWS, GCP, Azure), containers (Docker, Kubernetes), a modern front end, and LLM integration for the AI part. Tool choices follow your existing stack — pragmatism over dogma.`,
        `Typical stack: JVM/Java for the critical back end, cloud + containers for operations, a modern web front end, and AI building blocks (Claude/OpenAI/Mistral) for smart integration. Everything is adapted to your context rather than imposed.`
      ]
    },
    {
      id: 'process',
      cues: ['comment ca marche','comment ca se passe','process','processus','methode','demarche','etape',
              'deroulement','how it works','how does it work','next step','onboarding'],
      fr: [
        `Le déroulé : (1) un premier échange pour comprendre le contexte, (2) un cadrage honnête — faisabilité, ordre de grandeur, prochain pas concret, (3) une proposition si le projet s'y prête, (4) la réalisation, du cadrage à la mise en production. Première réponse sous 48 h ouvrées.`,
        `En pratique : vous décrivez le besoin → retour sous 48 h ouvrées avec une lecture franche (faisabilité + ordre de grandeur) → proposition → réalisation livrée par la même personne qui l'a proposée, jusqu'à la prod. Pas de pyramide, pas d'intermédiaire.`
      ],
      en: [
        `The flow: (1) a first conversation to understand the context, (2) an honest scoping — feasibility, ballpark, concrete next step, (3) a proposal if the project fits, (4) delivery, from scoping to production. First reply within 48 business hours.`,
        `In practice: you describe the need → reply within 48 business hours with a straight read (feasibility + ballpark) → proposal → delivery by the same person who pitched it, all the way to production. No pyramid, no middleman.`
      ]
    },
    {
      id: 'location',
      cues: ['localis','situe','situez','adresse','region','ville',
              'distance','remote','distanciel','teletravail','sur site','deplac','base','based','geograph',
              'ou se trouve','ou est','ou etes','ou se situe','etes vous ou','vous etes ou',
              'where','located','location','on site','based'],
      fr: [
        `NSY est basée en France. Les missions se font principalement en distanciel, partout en France et en Europe, avec des déplacements ponctuels possibles selon le besoin.`,
        `Le travail est essentiellement à distance — la localisation du client n'est pas un frein. Déplacements sur site envisageables pour les temps forts d'une mission.`
      ],
      en: [
        `NSY is based in France. Engagements are mostly remote, across France and Europe, with occasional on-site visits when needed.`,
        `Work is essentially remote — your location isn't a blocker. On-site visits are possible for key moments of a mission.`
      ]
    },
    {
      id: 'references',
      cues: ['reference','client','clientele','portfolio','realisation','exemple','case study','case',
              'temoignage','testimonial','who have you worked'],
      fr: [
        `Les missions se déroulent au sein de grandes institutions financières et d'assurance, le plus souvent sous accord de confidentialité — donc pas de noms publics ici. Les démonstrateurs visibles, eux, sont ce site (multilingue, chatbot, 3D) et la section Conception 3D.`,
        `La plupart des références sont sous NDA (finance/assurance), donc difficiles à citer nommément. En revanche, ce site lui-même illustre le savoir-faire web + IA + 3D — c'est un portfolio vivant.`
      ],
      en: [
        `Engagements take place inside large financial and insurance institutions, usually under NDA — so no public names here. The visible showcases are this site (multilingual, chatbot, 3D) and the 3D Design section.`,
        `Most references are under NDA (finance/insurance), so hard to name directly. This site itself, though, demonstrates the web + AI + 3D know-how — a living portfolio.`
      ]
    },
    {
      id: 'data_gdpr',
      cues: ['rgpd','gdpr','donnee','privacy','confidentialite','cookie','vie privee','tracking','tracage'],
      fr: [
        `Côté données : aucun cookie de suivi ni outil d'analyse tiers. Un seul cookie fonctionnel (votre préférence de langue), posé uniquement quand vous cliquez un drapeau. Les infos du formulaire servent uniquement à vous répondre, jamais revendues. Détails dans la Politique de confidentialité (bas de page).`,
        `NSY ne piste personne : zéro cookie publicitaire, pas de Google Analytics. Seul un cookie de langue, et les données du formulaire restent privées (RGPD). Tout est expliqué dans la page Confidentialité.`
      ],
      en: [
        `On data: no tracking cookies, no third-party analytics. A single functional cookie (your language preference), set only when you click a flag. Form details are used solely to reply to you, never sold. Full detail in the Privacy policy (footer).`,
        `NSY tracks nobody: zero advertising cookies, no Google Analytics. Only a language cookie, and form data stays private (GDPR). It's all spelled out on the Privacy page.`
      ]
    },
    {
      id: 'why_nsy',
      cues: ['pourquoi','difference','differenc','avantage','valeur ajoutee','plutot que','vs','versus',
              'why nsy','why you','why choose','what makes'],
      fr: [
        `Trois principes : <b>sans pyramide</b> — la personne qui propose la mission est celle qui la livre, pas de junior masqué ; <b>honnêteté technique</b> — je dis quand une idée n'est pas la bonne ; <b>trois clients max</b> — pour rester vraiment disponible. De l'ingénierie senior, en direct, sans surcouche commerciale.`,
        `Ce qui distingue NSY : un seul interlocuteur senior du cadrage à la prod (pas d'intermédiaire), une parole franche sur la faisabilité, et un nombre de clients volontairement limité. Vous parlez à celui qui construit, pas à un commercial.`
      ],
      en: [
        `Three principles: <b>no pyramid</b> — the person who pitches the mission delivers it, no hidden junior; <b>technical honesty</b> — I'll say when an idea is wrong; <b>three clients max</b> — to stay genuinely available. Senior engineering, direct, with no commercial layer.`,
        `What sets NSY apart: a single senior point of contact from scoping to production (no middleman), a straight word on feasibility, and a deliberately limited client count. You talk to the person who builds, not a salesperson.`
      ]
    },
    {
      id: 'contact',
      cues: ['contact','contacter','joindre','rendez vous','rdv','appel','telephone','tel','mail','email',
              'ecrire','parler','reach','meeting','call','book','get in touch','email you'],
      fr: [
        `Le plus simple : la page Contact (réponse sous 48 h ouvrées), ou par téléphone au +33 (0)6 72 94 71 06. Vous pouvez aussi cliquer sur « Parler à Cédric → » juste en dessous pour aller au formulaire.`,
        `Pour échanger : page Contact, ou un créneau de 30 min via LinkedIn. Réponse sous 48 h ouvrées avec une lecture honnête de votre besoin.`
      ],
      en: [
        `Easiest path: the Contact page (reply within 48 business hours), or by phone at +33 (0)6 72 94 71 06. You can also click "Talk to Cédric →" just below to jump to the form.`,
        `To get in touch: the Contact page, or a 30-min slot via LinkedIn. Reply within 48 business hours, with an honest read of your need.`
      ]
    }
  ];

  // Smalltalk — only used when no content intent matched.
  const SMALLTALK = [
    {
      id: 'thanks',
      cues: ['merci','thanks','thank you','thx','nickel','parfait','super','genial','top','cool','great'],
      fr: [`Avec plaisir 🙂 Autre chose ? Services, tarifs, dispo, 3D… je reste là.`,
            `Je vous en prie ! Si une question surgit (devis, parcours, contact), n'hésitez pas.`],
      en: [`My pleasure 🙂 Anything else? Services, pricing, availability, 3D… I'm here.`,
            `You're welcome! If anything comes up (quote, background, contact), just ask.`]
    },
    {
      id: 'bye',
      cues: ['au revoir','aurevoir','bye','goodbye','a bientot','ciao','bonne journee','bonne soiree'],
      fr: [`À bientôt 👋 Et pour démarrer un échange, le formulaire en bas de page fait le job.`,
            `Bonne continuation 👋 Le formulaire de contact reste ouvert quand vous voulez.`],
      en: [`See you 👋 And to start a conversation, the form at the bottom does the job.`,
            `Take care 👋 The contact form stays open whenever you're ready.`]
    },
    {
      id: 'greeting',
      cues: ['bonjour','bonsoir','salut','coucou','hello','hi','hey','yo','bjr'],
      fr: [`Bonjour 👋 Je suis l'assistant NSY. Je peux parler services, tarifs, disponibilité, finance/assurance, création web IA ou 3D — que cherchez-vous ?`,
            `Salut 👋 Posez-moi une question sur NSY (offres, tarifs, parcours de Cédric, 3D) ou décrivez votre besoin, je vous oriente.`],
      en: [`Hello 👋 I'm the NSY assistant. I can cover services, pricing, availability, finance/insurance, AI web creation or 3D — what are you after?`,
            `Hi 👋 Ask me anything about NSY (offerings, pricing, Cédric's background, 3D) or describe your need, and I'll point you the right way.`]
    }
  ];

  const FALLBACKS = {
    fr: [
      `Bonne question. Je peux détailler les <b>services</b>, les <b>tarifs</b>, la <b>disponibilité</b>, l'expertise <b>finance/assurance</b>, la <b>création web IA</b> ou la <b>3D</b> — dites-moi l'angle. Pour un cas précis, le formulaire de contact reste le plus efficace.`,
      `Je n'ai pas de réponse toute faite là-dessus, mais je peux vous orienter : services, tarifs, parcours de Cédric, web/IA, 3D, ou prise de contact. Sur quoi puis-je préciser ?`
    ],
    en: [
      `Good question. I can detail <b>services</b>, <b>pricing</b>, <b>availability</b>, <b>finance/insurance</b> expertise, <b>AI web creation</b> or <b>3D</b> — tell me the angle. For a specific case, the contact form is the most effective.`,
      `I don't have a canned answer for that, but I can point you: services, pricing, Cédric's background, web/AI, 3D, or getting in touch. What should I expand on?`
    ]
  };

  const FOLLOWUP_CUES = ['et','plus','encore','details','detail','dis m en plus','en savoir plus','more',
                          'tell me more','go on','continue','et alors','precise','elabore'];

  let lastIntentId = null;

  function scoreIntent(intent, text, tokens) {
    let score = 0;
    for (const cue of intent.cues) {
      if (cueHit(cue, text, tokens)) score += cue.length; // longer/multi-word cues weigh more
    }
    return score;
  }

  function botReply(userText) {
    const text = norm(userText);
    const tokens = text.split(' ');
    // Answer in the language of the question (falls back to the page language)
    const lang = detectLang(userText);

    // 1) Best content intent by specificity-weighted score
    let best = null;
    let bestScore = 0;
    for (const intent of INTENTS) {
      const s = scoreIntent(intent, text, tokens);
      if (s > bestScore) { bestScore = s; best = intent; }
    }

    if (best && bestScore > 0) {
      lastIntentId = best.id;
      return pick(best[lang]);
    }

    // 2) Short follow-up ("et ?", "plus de détails"…) → re-open last topic
    const isShort = tokens.length <= 4;
    if (isShort && lastIntentId && FOLLOWUP_CUES.some((c) => cueHit(c, text, tokens))) {
      const prev = INTENTS.find((i) => i.id === lastIntentId);
      if (prev) return pick(prev[lang]);
    }

    // 3) Smalltalk (greeting / thanks / bye) only if nothing else hit
    for (const intent of SMALLTALK) {
      if (scoreIntent(intent, text, tokens) > 0) {
        return pick(intent[lang]);
      }
    }

    // 4) Fallback
    return pick(FALLBACKS[lang]);
  }

  async function send(text) {
    const content = (text ?? input?.value ?? '').trim();
    if (!content) return;
    if (input) input.value = '';
    suggestions?.classList.add('hidden');
    appendMessage('user', content);
    hist.push({ role: 'user', content });
    saveHist(hist);
    const typing = appendTyping();
    const t0 = Date.now();

    // 1) Voie IA : proxy serveur (LLM ancré dans les faits du site)
    let reply = null;
    let aiDown = false; // vraie indispo IA (≠ mon throttle par IP) → voyant orange
    if (!aiOff()) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 25000);
        const res = await fetch('chat.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: hist.slice(-12), page: AI_PAGE }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        const data = await res.json();
        if (data && data.ok && data.reply) {
          reply = String(data.reply);
          setAiBadge(data.model);
          setStatus('ai');
          cacheHealth(true, data.model);
        } else if (data && data.code === 'noconfig') {
          // Pas de clé côté serveur : inutile de réessayer cette session.
          aiDown = true;
          try { sessionStorage.setItem(AI_OFF_KEY, '1'); } catch (e) { /* private mode */ }
        } else if (data && data.code === 'ratelimit') {
          // Throttle par IP (le mien) OU capacité amont : repli local ce tour-ci.
          // On ne bascule PAS le voyant ici — le health-check tranche la vraie dispo.
        } else {
          aiDown = true;
          aiFails++;
        }
      } catch (e) {
        aiDown = true;
        aiFails++;
      }
    }

    // 2) Repli : moteur de règles local (le délai simule une frappe naturelle)
    if (reply === null) {
      const elapsed = Date.now() - t0;
      if (elapsed < 650) await new Promise((r) => setTimeout(r, 650 - elapsed));
      typing?.remove();
      // Voyant orange seulement en cas de vraie indispo IA (pas sur un throttle IP).
      if (aiDown) { setStatus('rules'); cacheHealth(false); }
      const html = botReply(content);
      appendMessage('assistant', html);
      // Historique en texte : <b>→**…**, autres balises retirées.
      hist.push({
        role: 'assistant',
        content: html.replace(/<b>(.*?)<\/b>/g, '**$1**').replace(/<[^>]+>/g, ''),
      });
    } else {
      typing?.remove();
      const bubble = appendMessage('assistant', '');
      typewrite(bubble, mdToHtml(reply));
      hist.push({ role: 'assistant', content: reply });
    }
    saveHist(hist);
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
  const modelStage = renaultViewer ? renaultViewer.closest('.model-stage') : null;
  const modelExpandBtn = modelStage ? modelStage.querySelector('.model-expand') : null;
  const isModelExpanded = () => !!(modelStage && modelStage.classList.contains('expanded'));

  // Re-fit the framing once the resized container has been measured (2 frames).
  function reframeModel() {
    if (renaultViewer && typeof renaultViewer.updateFraming === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        try { renaultViewer.updateFraming(); } catch (_) {}
      }));
    }
  }

  // Single source of truth for the turntable. The model keeps auto-rotating
  // while it is on-screen OR expanded fullscreen, and only stops when genuinely
  // scrolled off-screen (power saving). Crucially it does NOT toggle on every
  // transient intersection flip — so a portrait↔landscape orientation change
  // (which momentarily reflows/repositions #creations) no longer freezes it.
  // We only touch the attribute when the desired state differs, so when the
  // model stays visible across the switch, auto-rotate is left untouched and
  // the rotation is truly continuous (no auto-rotate-delay restart).
  function syncModelRotation() {
    if (!renaultViewer) return;
    let onScreen;
    if (isModelExpanded()) {
      onScreen = true; // fullscreen overlay always shows the model
    } else {
      // Decide on the #creations SECTION (same element/margin the observer
      // watches), not the model's tight rect — so rotation turns on as soon as
      // the section is in view, matching the original behaviour. model-viewer
      // still pauses its own WebGL when the model itself is off-screen, so this
      // doesn't waste GPU.
      const zone = renaultViewer.closest('#creations') || renaultViewer;
      const r = zone.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      onScreen = r.bottom > -100 && r.top < vh + 100; // 100px margin = observer rootMargin
    }
    if (onScreen) {
      if (!renaultViewer.hasAttribute('auto-rotate')) renaultViewer.setAttribute('auto-rotate', '');
    } else if (renaultViewer.hasAttribute('auto-rotate')) {
      renaultViewer.removeAttribute('auto-rotate');
    }
  }

  if (renaultViewer) {
    // ───── Netteté du wireframe sur écrans standard (DPR 1) ─────
    // model-viewer rend son canvas à window.devicePixelRatio : sur un écran
    // non-Retina les lignes GL 1px crénellent visiblement (le MSAA du contexte
    // WebGL est déjà actif mais insuffisant sur des lignes fines). On force un
    // rendu 2× que le CSS re-descend à la taille d'affichage (supersampling).
    // Coût : ~4× de pixels GPU sur CE canvas, uniquement pour les écrans 1× —
    // canvas modeste, shader lignes trivial, et model-viewer coupe déjà son
    // rendu hors écran. Les écrans Retina/mobiles (DPR ≥ 2) sont inchangés.
    if ((window.devicePixelRatio || 1) < 2) {
      try {
        Object.defineProperty(window, 'devicePixelRatio', { get: () => 2, configurable: true });
      } catch (_) { /* propriété non redéfinissable : on reste au rendu natif */ }
    }

    renaultViewer.addEventListener('load', () => {
      // updateFraming() recomputes camera-target on the visible bounding box
      // and resets the camera-orbit radius accordingly.
      if (typeof renaultViewer.updateFraming === 'function') renaultViewer.updateFraming();
    });

    // ───── Entrée caméra cinématique (one-shot) ─────
    // Au premier passage sur la section, la caméra part d'un cadrage éloigné
    // en plongée latérale et effectue un travelling d'approche vers l'angle
    // final — model-viewer interpole lui-même les changements de camera-orbit
    // (SmoothControls). One-shot : zéro coût une fois arrivée. Désactivé en
    // reduced-motion (le cadrage final est alors appliqué d'emblée).
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
      const FINAL_ORBIT = renaultViewer.getAttribute('camera-orbit') || '-30deg 75deg auto';
      const START_ORBIT = '-95deg 68deg 140%';
      renaultViewer.setAttribute('camera-orbit', START_ORBIT);

      let modelLoaded = false;
      let sectionSeen = false;
      let entryDone = false;
      const playEntry = () => {
        if (entryDone || !modelLoaded || !sectionSeen) return;
        entryDone = true;
        // Petite respiration pour laisser le premier rendu s'afficher,
        // puis travelling vers le cadrage final (interpolé ~1s).
        setTimeout(() => renaultViewer.setAttribute('camera-orbit', FINAL_ORBIT), 250);
      };
      renaultViewer.addEventListener('load', () => { modelLoaded = true; playEntry(); }, { once: true });
      const entryIO = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        sectionSeen = true;
        entryIO.disconnect();
        playEntry();
      }, { threshold: 0.35 });
      entryIO.observe(renaultViewer.closest('#creations') || renaultViewer);
    }

    // ───── Points lumineux du sol Tron (filent vers l'horizon) ─────
    // 5 points sur le plan incliné de la grille : voie (X), vitesse et départ
    // aléatoires ; nouvelle voie tirée à chaque passage (animationiteration).
    // transform/opacity uniquement (composité) ; .anim-paused les fige quand
    // la section est hors écran ; rien n'est injecté en reduced-motion.
    if (modelStage && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const fx = document.createElement('div');
      fx.className = 'tron-floor-fx';
      fx.setAttribute('aria-hidden', 'true');
      const GRID = 46; // pas du quadrillage (voir background-size de .model-stage::before)
      // Les points SUIVENT les lignes verticales de la grille : la voie est un
      // multiple du pas (+0.5px = centre de la ligne de 1px), tirée au sort
      // parmi les colonnes hors bords extrêmes.
      const gridLane = () => {
        const w = fx.clientWidth || 0;
        if (!w) return '50%';
        const min = Math.ceil(w * 0.06 / GRID);
        const max = Math.floor(w * 0.94 / GRID);
        const k = min + Math.floor(Math.random() * Math.max(1, max - min + 1));
        return (k * GRID + 0.5) + 'px';
      };
      for (let i = 0; i < 5; i++) {
        const dot = document.createElement('span');
        dot.className = 'tron-dot';
        dot.style.setProperty('--dur', (2.6 + Math.random() * 2.8).toFixed(2) + 's');
        dot.style.animationDelay = (Math.random() * 3.5).toFixed(2) + 's';
        dot.addEventListener('animationiteration', () => dot.style.setProperty('--lane', gridLane()));
        fx.appendChild(dot);
      }
      // Course des points = hauteur du plan (px), consommée par les keyframes.
      const setRun = () => fx.style.setProperty('--runY', fx.clientHeight + 'px');
      // Avant le <model-viewer> dans le DOM : au-dessus de la grille (::before),
      // sous le canvas transparent du modèle.
      modelStage.insertBefore(fx, modelStage.firstChild);
      // Voies initiales — après insertion (clientWidth mesurable seulement là).
      fx.querySelectorAll('.tron-dot').forEach((dot) => dot.style.setProperty('--lane', gridLane()));
      setRun();
      window.addEventListener('resize', () => requestAnimationFrame(setRun), { passive: true });
      // L'agrandissement lightbox change la taille du plan sans event resize.
      new MutationObserver(() => requestAnimationFrame(setRun))
        .observe(modelStage, { attributes: true, attributeFilter: ['class'] });
    }

    // ───── Pastille "↻ Faites pivoter" : disparaît après usage ─────
    // Dès que l'utilisateur a fait pivoter le modèle lui-même, l'invite a
    // rempli son rôle : fondu de sortie + arrêt de l'animation de pulsation
    // (une boucle infinie de moins à l'écran).
    const modelHint = modelStage ? modelStage.querySelector('.model-hint') : null;
    if (modelHint) {
      const onUserCamera = (e) => {
        if (!e.detail || e.detail.source !== 'user-interaction') return;
        modelHint.classList.add('is-done');
        renaultViewer.removeEventListener('camera-change', onUserCamera);
      };
      renaultViewer.addEventListener('camera-change', onUserCamera);
    }

    // Orientation / viewport changes (mobile portrait↔landscape, mobile address
    // bar show/hide, window resize): re-fit the framing and re-assert rotation
    // once the new layout has settled, so the turntable keeps spinning across
    // the switch instead of being left paused by a transient observer fire.
    let viewportTimer;
    const onViewportChange = () => {
      requestAnimationFrame(() => requestAnimationFrame(syncModelRotation));
      clearTimeout(viewportTimer);
      viewportTimer = setTimeout(() => { syncModelRotation(); reframeModel(); }, 350);
    };
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);
    if (window.screen && screen.orientation && typeof screen.orientation.addEventListener === 'function') {
      screen.orientation.addEventListener('change', onViewportChange);
    }
  }

  // ───── 3D model: enlarge ↔ restore (CSS lightbox) ─────
  // Toggling .expanded makes the stage fill the viewport; model-viewer is
  // responsive, so we just re-fit the framing once the new size has settled.
  if (modelStage && modelExpandBtn) {
    const setModelExpanded = (on) => {
      modelStage.classList.toggle('expanded', on);
      document.body.classList.toggle('model-expanded-lock', on);
      const label = on ? modelExpandBtn.dataset.labelClose : modelExpandBtn.dataset.labelOpen;
      if (label) {
        modelExpandBtn.setAttribute('aria-label', label);
        modelExpandBtn.setAttribute('title', label);
      }
      reframeModel();
      syncModelRotation(); // expanding shows the model fullscreen → keep it spinning
    };
    modelExpandBtn.addEventListener('click', () => {
      setModelExpanded(!modelStage.classList.contains('expanded'));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modelStage.classList.contains('expanded')) {
        setModelExpanded(false);
      }
    });
  }

  // ───── Language switcher (🇫🇷 / 🇬🇧) — sets cookie + redirect to matching page ─────
  // Slugs are real translations (loisirs/hobbies, mentions-legales/legal-notice, etc.)
  // rather than -en.html suffixes, so we need an explicit FR ↔ EN map.
  // Exception: index.html stays "index.html" in EN as index-en.html (no good translation).
  const SLUG_FR_TO_EN = {
    'superviser-production-teraoctets-megaoctet.html': 'production-monitoring-terabytes-megabyte.html',
    'site-ia-en-un-week-end.html': 'ai-website-in-a-weekend.html',
    'index.html': 'index-en.html',
    'mentions-legales.html': 'legal-notice.html',
    'confidentialite.html': 'privacy.html',
    'faisabilite.html': 'feasibility.html',
    'realisations.html': 'portfolio.html',
    'faq.html': 'faq-en.html',
    'expertise-migration-java-ee.html': 'java-ee-migration.html',
    'expertise-wildfly-jboss.html': 'wildfly-jboss-expert.html',
    'expertise-openshift-kubernetes.html': 'openshift-kubernetes-expert.html',
    'expertise-kafka-messagerie.html': 'kafka-messaging-expert.html',
    'conformite-dora.html': 'dora-compliance.html',
    'integration-claude-entreprise.html': 'claude-integration.html',
    'creation-site-ia.html': 'ai-website-creation.html',
    'glossaire-ia-web.html': 'ai-web-glossary.html',
    'blog.html': 'blog-en.html',
    'seo-geo-etre-cite-par-les-ia.html': 'seo-geo-getting-cited-by-ai.html',
    'chatbot-ia-forum-base-de-connaissances.html': 'ai-chatbot-forum-knowledge-base.html',
    'consultant-technique-paris.html': 'technical-consultant-paris.html',
    'creation-site-internet-loiret.html': 'website-creation-loiret.html',
    'creation-site-internet-orleans.html': 'website-creation-orleans.html',
    'pourquoi-nsy.html': 'why-nsy.html',
    'services.html': 'services-en.html',
    'a-propos.html': 'about.html',
    'contact.html': 'contact-en.html',
    'conception-3d.html': '3d-design.html',
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

    // L'anneau disparaît dès la PREMIÈRE IMAGE décodée (loadeddata), pas au
    // canplaythrough : sur 4G lente, attendre que les 613 Ko soient bufferisés
    // masquait le poster pendant des secondes — et le LCP (audit P5, 24/08/2026 :
    // « délai de rendu » 0,6 à 1,1 s sur un fichier chargé en 64 ms).
    glyphVideo.addEventListener('loadeddata', hideLoader, { once: true });
    glyphVideo.addEventListener('error', () => {
      glyphLoader.classList.add('error');
      if (glyphPct) glyphPct.textContent = 'ERR';
    });

    // Edge case: video already cached / fully buffered before listeners attach
    if (glyphVideo.readyState >= 2) hideLoader();

    // ───── Fondu de boucle : fade-in / fade-out vers transparent ─────
    // La vidéo reste opaque ; on anime son opacité selon currentTime pour qu'au
    // raccord de boucle elle se dissolve vers le disque bleu derrière (vrai
    // « fondu vers transparent », sans vidéo à canal alpha que Safari gère mal).
    // Le rAF ne tourne QUE pendant la lecture — la vidéo est mise en pause
    // hors-écran, donc l'animation s'arrête d'elle-même (philosophie perf).
    const FADE = 0.6; // secondes de fondu à chaque extrémité
    let fadeRAF = null;
    let firstLoop = true; // pas de fondu d'ENTRÉE au tout premier départ : le
                          // poster est déjà peint, l'image doit rester visible (LCP)
    glyphVideo.addEventListener('seeked', () => { firstLoop = false; });
    glyphVideo.addEventListener('timeupdate', () => { if (glyphVideo.currentTime > FADE) firstLoop = false; });
    const fadeTick = () => {
      const d = glyphVideo.duration;
      if (d && isFinite(d)) {
        const t = glyphVideo.currentTime;
        let op = 1;
        if (t < FADE && !firstLoop) op = t / FADE;
        else if (t > d - FADE) op = Math.max(0, (d - t) / FADE);
        glyphVideo.style.opacity = op.toFixed(3);
      }
      fadeRAF = requestAnimationFrame(fadeTick);
    };
    const startFade = () => { if (fadeRAF == null) fadeRAF = requestAnimationFrame(fadeTick); };
    const stopFade = () => { if (fadeRAF != null) { cancelAnimationFrame(fadeRAF); fadeRAF = null; } };
    glyphVideo.addEventListener('play', startFade);
    glyphVideo.addEventListener('pause', stopFade);
    if (!glyphVideo.paused) startFade();
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
    // Inclut transform : une transition inline remplace ENTIÈREMENT celle du
    // CSS, or le zoom hover des cartes service anime transform sur ces vidéos.
    const transition = `opacity ${Math.round(fadeDurationSec * 1000)}ms ease, transform 650ms cubic-bezier(.25,.46,.45,.94)`;

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
    // glyph-video (hero), about-video (portrait), ansley-video (avatar) et
    // ansley-fab-video (mascotte du FAB) ont déjà une boucle sans couture
    // (crossfade encodé / boomerang) — pas de fondu JS.
    if (v.id === 'glyph-video' || v.id === 'about-video'
        || v.id === 'ansley-video' || v.id === 'ansley-fab-video'
        || v.id === 'seo-geo-video'
        || v.id === 'chatbot-forum-video'
        || v.id === 'weekend-site-video'
        || v.id === 'supervision-video') return; // boomerang déjà sans couture
    setupLoopFade(v);
  });

  // ───── Power saving: pause looping videos off-screen / in background ─────
  // A looping <video> re-decodes every frame for as long as it plays — there
  // is no "cached decoded frames" for a loop. So the only way to stop the
  // continuous CPU/GPU cost is to actually pause it when it isn't visible:
  //   • off-screen (scrolled out of view) — the 2 service videos sit below
  //     the fold and were decoding for nothing;
  //   • hidden tab — no point decoding what the user can't see.
  // ansley-video (avatar du chat) est exclu : il est piloté par l'ouverture du
  // panneau (play/pause), pas par le défilement — sinon l'observer le lancerait
  // alors que le chat est fermé (panneau en opacity:0 mais géométriquement visible).
  const loopingVideos = Array.from(document.querySelectorAll('video[loop]'))
    .filter((v) => v.id !== 'ansley-video');
  if (loopingVideos.length && 'IntersectionObserver' in window) {
    const onScreen = new WeakSet();
    const resume = (v) => {
      if (onScreen.has(v) && document.visibilityState === 'visible') {
        v.play().catch(() => {});
      }
    };
    const vio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { onScreen.add(e.target); resume(e.target); }
        else { onScreen.delete(e.target); e.target.pause(); }
      });
    }, { rootMargin: '150px' }); // start just before it scrolls into view
    loopingVideos.forEach((v) => vio.observe(v));

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        loopingVideos.forEach((v) => v.pause());
      } else {
        loopingVideos.forEach(resume);
      }
    });
  }

  // ───── Power saving: freeze CSS animations + 3D rotation off-screen ─────
  // Same idea as the videos: the ~8 infinite CSS animations (gradient sweeps,
  // spinning rings, marquee, hint pulse…) repaint forever even when their
  // section is scrolled away. We add .anim-paused to a section when it leaves
  // the viewport (CSS then sets animation-play-state: paused on everything
  // inside) and remove it when it returns. The Renault's auto-rotate is also
  // toggled — model-viewer already pauses WebGL rendering off-screen, this
  // additionally stops the turntable from advancing.
  const renault = document.getElementById('renault-viewer');
  const animZones = document.querySelectorAll('.hero, .marquee, #about, #creations');
  if (animZones.length && 'IntersectionObserver' in window) {
    // Une zone est « visible » si son rect intersecte le viewport (marge 100px
    // = rootMargin de l'observer) — OU si elle contient le stage 3D agrandi :
    // en lightbox plein écran, le stage passe en position:fixed et la section
    // sous-jacente perd sa hauteur ; elle peut alors sortir du viewport
    // (scroll verrouillé) pendant que ses animations sont affichées plein
    // écran. Sans cette exception, ouvrir le plein écran ou pivoter le
    // téléphone figeait les points du sol Tron (l'auto-rotate, lui, avait
    // déjà son exception dans syncModelRotation).
    const zoneOnScreen = (z) => {
      if (z.querySelector('.model-stage.expanded')) return true;
      const r = z.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      return r.bottom > -100 && r.top < vh + 100;
    };
    const aio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        e.target.classList.toggle('anim-paused', !zoneOnScreen(e.target));
        // Delegate the turntable decision to the shared helper, which also
        // accounts for the expanded/fullscreen case and avoids needless
        // attribute churn (keeps rotation continuous across orientation flips).
        if (renault && e.target.contains(renault)) syncModelRotation();
      });
    }, { rootMargin: '100px' }); // resume just before the section scrolls in
    animZones.forEach((z) => {
      z.classList.add('anim-paused'); // start paused; the observer un-pauses visible ones
      aio.observe(z);
    });

    // Ré-assertion après un changement de viewport (portrait ↔ paysage sur
    // mobile, redimensionnement) : le reflow fait parfois « clignoter »
    // l'IntersectionObserver — la zone est vue hors écran pendant la bascule,
    // .anim-paused est posée, et l'événement de retour ne re-fire pas
    // toujours. Résultat : les animations CSS (points du sol Tron, pulsations)
    // restaient figées. Même correctif que pour l'auto-rotate du modèle :
    // on recalcule l'état réel une fois la nouvelle mise en page stabilisée.
    const syncAnimZones = () => {
      animZones.forEach((z) => z.classList.toggle('anim-paused', !zoneOnScreen(z)));
    };
    let zoneTimer;
    const onZoneViewportChange = () => {
      requestAnimationFrame(() => requestAnimationFrame(syncAnimZones));
      clearTimeout(zoneTimer);
      zoneTimer = setTimeout(syncAnimZones, 400); // après stabilisation du layout
    };
    window.addEventListener('resize', onZoneViewportChange, { passive: true });
    window.addEventListener('orientationchange', onZoneViewportChange);
    if (window.screen && screen.orientation && typeof screen.orientation.addEventListener === 'function') {
      screen.orientation.addEventListener('change', onZoneViewportChange);
    }
  }

  // ───── Scroll reveal (one-shot, IntersectionObserver) ─────
  // Fade + translateY sur les blocs de contenu au scroll. One-shot : l'observer
  // se retire après déclenchement (unobserve). Désactivé si prefers-reduced-motion.
  // Seuls transform + opacity sont animés (composited, GPU, pas de layout/paint).
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const revealEls = document.querySelectorAll(
      '.cap, .svc, .step, .signal, .timeline-item, .realisation-card, ' +
      '.section-head, .creation-col, .channel, .faisa-cta, .form'
    );

    // Stagger : décalage progressif par position dans le conteneur parent
    const staggerMap = new Map();
    revealEls.forEach((el) => {
      const parent = el.parentElement;
      if (!staggerMap.has(parent)) staggerMap.set(parent, 0);
      const idx = staggerMap.get(parent);
      staggerMap.set(parent, idx + 1);
      el.style.transitionDelay = Math.min(idx * 65, 220) + 'ms';
      el.classList.add('reveal-up');
    });

    const revealIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-visible');
        revealIO.unobserve(e.target);
        // Retire les classes une fois la transition terminée pour que les
        // transitions hover normales (border-color, transform .25s) soient
        // pleinement restaurées sans conflit de durée.
        e.target.addEventListener('transitionend', function cleanup(ev) {
          if (ev.propertyName !== 'opacity') return;
          e.target.classList.remove('reveal-up', 'is-visible');
          e.target.style.transitionDelay = '';
          e.target.removeEventListener('transitionend', cleanup);
        });
      });
    }, { rootMargin: '0px 0px -50px 0px', threshold: 0.08 });

    revealEls.forEach((el) => revealIO.observe(el));
  }

  // ═══════════════════════════════════════════════════════════════════
  // UX pass 2 — compteurs, barre de lecture, parallaxe hero
  // Même philosophie perf : transform/opacity uniquement, rAF qui
  // s'arrêtent au repos, tout gated par prefers-reduced-motion.
  // ═══════════════════════════════════════════════════════════════════
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ───── Barre de CHARGEMENT de page (toutes pages) ─────
  // Fine ligne d'accent en haut du viewport : elle se remplit pendant le
  // chargement puis disparaît une fois la page prête. (Remplace l'ancienne
  // jauge de scroll.) transform: scaleX (composité) → aucun reflow.
  {
    const bar = document.createElement('div');
    bar.className = 'load-bar';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    let p = 0;
    const set = (v) => { p = Math.min(1, v); bar.style.transform = `scaleX(${p.toFixed(4)})`; };
    // Départ visible dès l'exécution du script (defer → HTML déjà parsé).
    requestAnimationFrame(() => set(0.1));

    let trickle = null;
    const stopTrickle = () => { if (trickle) { clearInterval(trickle); trickle = null; } };
    const finish = () => {
      stopTrickle();
      set(1);
      bar.classList.add('is-done');           // fondu (opacity → 0)
      setTimeout(() => bar.remove(), 700);     // retrait du DOM après la transition
    };

    if (document.readyState === 'complete') {
      // Page déjà chargée (cache, exécution tardive) : petit flash puis disparition.
      finish();
    } else {
      // Trickle : on avance vers ~90 % en ralentissant à l'approche.
      trickle = setInterval(() => { if (p < 0.9) set(p + (0.9 - p) * 0.14 + 0.004); }, 240);
      // DOM prêt → on assure un minimum visible ; chargement complet → 100 % + fondu.
      document.addEventListener('DOMContentLoaded', () => set(Math.max(p, 0.5)), { once: true });
      window.addEventListener('load', finish, { once: true });
    }
  }

  // ───── Compteurs animés (hero-meta + signaux About) ─────
  // One-shot au scroll-in : le nombre (nœud texte ou span[data-years]) compte
  // de 0 à sa valeur en ~900 ms, ease-out, chiffres tabulaires (zéro reflow
  // de largeur). Ignoré en reduced-motion : les valeurs restent statiques.
  if (!prefersReduced && 'IntersectionObserver' in window) {
    const hosts = document.querySelectorAll('.hero-meta-item .num:not(.num-text), .signal .v');
    const targets = [];
    hosts.forEach((host) => {
      for (const n of host.childNodes) {
        if (n.nodeType === 3 && /^\s*\d+\s*$/.test(n.textContent)) {
          targets.push({ node: n, end: parseInt(n.textContent, 10) });
          return;
        }
        if (n.nodeType === 1 && n.hasAttribute && n.hasAttribute('data-years')) {
          const t = n.firstChild;
          if (t && /^\d+$/.test(t.textContent)) targets.push({ node: t, end: parseInt(t.textContent, 10) });
          return;
        }
      }
    });
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const runCounter = ({ node, end }) => {
      const t0 = performance.now();
      const dur = 900;
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        node.textContent = Math.round(easeOut(p) * end);
        if (p < 1) requestAnimationFrame(tick);
      };
      node.textContent = '0';
      requestAnimationFrame(tick);
    };
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        targets.filter((t) => e.target.contains(t.node)).forEach(runCounter);
      });
    }, { threshold: 0.6 });
    targets.forEach((t) => cio.observe(t.node.parentElement.closest('.hero-meta-item, .signal') || t.node.parentElement));
  }

  // ───── Parallaxe souris sur le visuel hero (desktop uniquement) ─────
  // Terminaux / tags / glyphe se déplacent sur des plans de profondeur
  // différents en suivant le curseur (lerp amorti). Écrit uniquement les
  // variables --px/--py consommées par translate3d en CSS (composité).
  // Le rAF s'arrête dès que la cible est atteinte ; inactif hero hors écran,
  // sur tactile, et en reduced-motion.
  const heroSection = document.querySelector('.hero');
  if (heroSection && hoverCapable && !prefersReduced && 'IntersectionObserver' in window) {
    const AMP = 14; // déplacement max (px) du plan le plus proche
    const layers = [
      ['.t-1', 1], ['.t-2', 0.85], ['.tag-1', 0.55], ['.tag-2', 0.55], ['.glyph', -0.22],
    ].map(([sel, k]) => ({ el: heroSection.querySelector(sel), k }))
      .filter((o) => o.el);
    if (layers.length) {
      let tx = 0, ty = 0, cx = 0, cy = 0, rafId = null, heroVisible = false;
      const step = () => {
        cx += (tx - cx) * 0.08;
        cy += (ty - cy) * 0.08;
        layers.forEach(({ el, k }) => {
          el.style.setProperty('--px', (cx * k).toFixed(2) + 'px');
          el.style.setProperty('--py', (cy * k).toFixed(2) + 'px');
        });
        if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) rafId = requestAnimationFrame(step);
        else rafId = null; // au repos : plus aucun frame
      };
      const kick = () => { if (!rafId) rafId = requestAnimationFrame(step); };
      heroSection.addEventListener('mousemove', (e) => {
        if (!heroVisible) return;
        const r = heroSection.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * 2 * AMP;
        ty = ((e.clientY - r.top) / r.height - 0.5) * 2 * AMP;
        kick();
      });
      heroSection.addEventListener('mouseleave', () => { tx = 0; ty = 0; kick(); });
      new IntersectionObserver(([entry]) => {
        heroVisible = entry.isIntersecting;
        if (!heroVisible) { tx = 0; ty = 0; kick(); } // retour au repos hors écran
      }).observe(heroSection);
    }
  }
})();

/* ───── Journal : compteurs de vues / « j'aime » (journal-stats.php) ─────
   Clé = slug FR (data-slug, partagé par la paire FR/EN). La vue n'est comptée
   qu'une fois par session (sessionStorage) ; l'état « aimé » vit en
   localStorage. Tout échec réseau laisse simplement la barre masquée. */
(function () {
  var el = document.querySelector('[data-journal-stats]');
  if (!el || !window.fetch) return;
  var slug = el.getAttribute('data-slug');
  var en = (document.documentElement.lang || 'fr') === 'en';
  var viewsEl = el.querySelector('.js-views');
  var likeBtn = el.querySelector('.js-like');
  var likeLabel = el.querySelector('.js-like-label');
  var likedKey = 'nsy_liked_' + slug, viewedKey = 'nsy_viewed_' + slug;
  var liked = false;
  try { liked = localStorage.getItem(likedKey) === '1'; } catch (e) {}

  function fmt(n) { return Number(n || 0).toLocaleString(en ? 'en-GB' : 'fr-FR'); }
  function render(d) {
    viewsEl.textContent = fmt(d.views) + (en ? (d.views > 1 ? ' views' : ' view') : (d.views > 1 ? ' vues' : ' vue'));
    likeLabel.textContent = (en ? 'Like' : 'J\u2019aime') + ' (' + fmt(d.likes) + ')';
    likeBtn.classList.toggle('liked', liked);
    likeBtn.setAttribute('aria-pressed', liked ? 'true' : 'false');
    el.hidden = false;
  }
  function call(action) {
    return fetch('journal-stats.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: slug, action: action })
    }).then(function (r) { return r.json(); });
  }

  var first = 'get';
  try {
    if (!sessionStorage.getItem(viewedKey)) { first = 'view'; sessionStorage.setItem(viewedKey, '1'); }
  } catch (e) {}
  call(first).then(function (d) { if (d && d.ok) render(d); }).catch(function () {});

  var busy = false;
  likeBtn.addEventListener('click', function () {
    if (busy) return;
    busy = true;
    var action = liked ? 'unlike' : 'like';
    liked = !liked;
    try { localStorage.setItem(likedKey, liked ? '1' : '0'); } catch (e) {}
    call(action).then(function (d) { if (d && d.ok) render(d); })
      .catch(function () {}).finally(function () { busy = false; });
  });
})();
