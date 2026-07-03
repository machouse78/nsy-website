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

  // The 3D creations now live in a section of the homepage (#creations),
  // not a standalone page. The chatbot only runs on the index pages, so a
  // same-page anchor works for both languages.
  const hobbiePath = '#creations';

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
        `Deux logiques de tarif : <b>Conseil technique</b> — au jour ou au forfait, mission directe via l'EURL, à cadrer selon le périmètre. <b>Création web · IA</b> — à partir de 5 800 € HT en forfait clé en main. Pour un chiffrage précis, le formulaire de contact est le plus rapide.`,
        `Côté création web · IA : à partir de 5 800 € HT (forfait clé en main). Côté conseil technique : tarif journalier ou forfait selon la mission. Le devis exact dépend du périmètre — décrivez votre besoin via le formulaire et je reviens sous 48 h ouvrées.`
      ],
      en: [
        `Two pricing tracks: <b>Technical consulting</b> — day-rate or fixed-fee, direct engagement via the EURL, scoped to the work. <b>Web creation · AI</b> — from €5,800 ex-VAT for a turnkey package. For a precise quote, the contact form is the fastest route.`,
        `Web creation · AI starts at €5,800 ex-VAT (turnkey). Technical consulting is day-rate or fixed-fee depending on the mission. The exact quote depends on scope — describe your need in the form and you'll hear back within 48 business hours.`
      ]
    },
    {
      id: 'availability',
      cues: ['disponib','dispo','quand','delai','commenc','demarr','libre','planning','agenda','prochaine',
              'available','availability','when','start','lead time','booked','timeline'],
      fr: [
        `Cédric est <b>disponible dès à présent</b> pour de nouvelles missions. Trois clients en parallèle au maximum, pour rester réellement disponible et tenir un niveau d'exigence non négociable.`,
        `Disponibilité : <b>immédiate</b>. Le créneau est volontairement limité (3 clients max en simultané) — si votre projet a une échéance, indiquez-la dans le formulaire pour caler le timing.`
      ],
      en: [
        `Cédric is <b>available right now</b> for new engagements. Three clients in parallel at most, to stay genuinely available and hold a non-negotiable quality bar.`,
        `Availability: <b>immediate</b>. The slot is deliberately limited (3 clients max at once) — if your project has a deadline, mention it in the form so we can line up the timing.`
      ]
    },
    {
      id: 'web_ai',
      cues: ['site','site web','web','website','application','appli','app','saas','plateforme','platform',
              'ia','intelligence artificielle','llm','claude','openai','mistral','gpt','chatbot','agent',
              'rag','recherche semantique','semantic','ai','automatis','automation'],
      fr: [
        `La création web NSY, c'est des sites et plateformes nouvelle génération avec l'IA au cœur : intégration de LLM (Claude, OpenAI, Mistral), chatbots métier, recherche sémantique, génération de contenu, agents. Le tout pensé pour la performance et le SEO. À partir de 5 800 € HT.`,
        `Côté web : sites vitrines et plateformes SaaS, avec intégration de modèles IA (assistant, recherche sémantique, RAG, automatisations). Ce site lui-même — multilingue, chatbot, 3D temps réel — sert de démonstrateur. Forfait clé en main à partir de 5 800 € HT.`
      ],
      en: [
        `NSY web creation means next-generation sites and platforms with AI at the core: LLM integration (Claude, OpenAI, Mistral), business chatbots, semantic search, content generation, agents — all built for performance and SEO. From €5,800 ex-VAT.`,
        `On the web side: brochure sites and SaaS platforms with AI model integration (assistant, semantic search, RAG, automations). This very site — multilingual, chatbot, real-time 3D — is the showcase. Turnkey from €5,800 ex-VAT.`
      ]
    },
    {
      id: 'finance_insurance',
      cues: ['banque','bancaire','finance','financ','assurance','assureur','asset','trading','acpr','amf',
              'dora','fintech','reglement','regule','conformite','bank','banking','insurance','insurer',
              'regulated','compliance'],
      fr: [
        `C'est le cœur du métier. ${XP} ans sur des chantiers critiques en banque de détail, banque privée, assurance vie et asset management — architecture distribuée, plateformes de trading et de risque temps réel, migration de socles legacy. Habitué des environnements régulés (ACPR, AMF, RGPD, DORA).`,
        `Oui — finance et assurance sont le terrain principal de Cédric : ${XP} ans en institutions financières françaises, sur des systèmes critiques et régulés. Migration Java EE, supervision de production, conformité (ACPR, AMF, DORA). Si votre contexte est régulé, c'est exactement la zone de confort.`
      ],
      en: [
        `That's the core specialty. ${XP} years on critical builds in retail banking, private banking, life insurance and asset management — distributed architecture, real-time trading and risk platforms, legacy-core migration. Fluent in regulated environments (ACPR, AMF, GDPR, DORA).`,
        `Yes — finance and insurance are Cédric's main ground: ${XP} years inside French financial institutions, on critical, regulated systems. Java EE migration, production oversight, compliance (ACPR, AMF, DORA). If your context is regulated, that's exactly the comfort zone.`
      ]
    },
    {
      id: 'threeD',
      cues: ['3d','blender','wireframe','animation','modele','rendu','render','voiture','renault','baccara',
              'loisir','hobby','hobbies','conception','youtube'],
      fr: [
        `La 3D fait partie des cordes créatives : rendus Blender optimisés pour le web, légers et rapides. Deux exemples concrets dans la section Conception 3D — une animation 3D (vidéo YouTube) et un modèle wireframe interactif d'une Renault R25 Baccara que vous pouvez faire pivoter. À voir : section ${hobbiePath}.`,
        `Oui, animations et modèles 3D maison — du Blender pensé pour le web (zéro ralentissement). Le wireframe cyan de la Renault R25 dans la section ${hobbiePath} est interactif : cliquez-glissez pour le faire tourner. Et oui, ça aussi ça peut s'intégrer à votre site.`
      ],
      en: [
        `3D is one of the creative strings: Blender renders optimised for the web — light and fast. Two live examples in the 3D Design section — a 3D animation (YouTube video) and an interactive wireframe model of a Renault R25 Baccara you can rotate. Have a look: ${hobbiePath} section.`,
        `Yes, in-house 3D animations and models — Blender built for the web (no slowdown). The cyan Renault R25 wireframe in the ${hobbiePath} section is interactive: click and drag to spin it. And yes, this can be embedded into your site too.`
      ]
    },
    {
      id: 'services',
      cues: ['service','offre','offrez','prestation','proposez','propose','faites','what do you do',
              'what do you offer','offering','help with'],
      fr: [
        `Deux offres : <b>(1) Conseil technique senior</b> pour la finance et l'assurance — architecture, audit, migration, conformité. <b>(2) Création web propulsée par l'IA</b> — sites, plateformes SaaS, intégration de LLM. En bonus : animations et modèles 3D pour le web. Sur quel axe puis-je préciser ?`,
        `NSY couvre deux choses : du conseil technique senior (finance/assurance, systèmes critiques) et de la création web avec l'IA (sites, SaaS, chatbots, recherche sémantique). Plus une touche 3D. Dites-moi votre besoin et je vous oriente.`
      ],
      en: [
        `Two offerings: <b>(1) Senior technical consulting</b> for finance & insurance — architecture, audit, migration, compliance. <b>(2) AI-powered web creation</b> — sites, SaaS platforms, LLM integration. Bonus: 3D animations and models for the web. Which one should I expand on?`,
        `NSY does two things: senior technical consulting (finance/insurance, critical systems) and AI-powered web creation (sites, SaaS, chatbots, semantic search). Plus a 3D touch. Tell me your need and I'll point you the right way.`
      ]
    },
    {
      id: 'about_cedric',
      cues: ['cedric','barme','fondateur','founder','parcours','experience','qui est','qui etes','profil',
              'cv','background','who is','who are','about you'],
      fr: [
        `Cédric Barme, fondateur de NSY (EURL créée en 2018). ${XP} ans dans les coulisses techniques des plus grandes institutions financières françaises — architecture distribuée, plateformes de trading temps réel, migration de socles legacy. Aujourd'hui consultant indépendant, et créateur web propulsé par l'IA.`,
        `Le fondateur, c'est Cédric Barme : ${XP} ans d'ingénierie sur des systèmes critiques (banque, assurance), puis création de l'EURL NSY en 2018. Tech lead, architecte, et depuis peu, création web avec l'IA. Le profil LinkedIn est en haut de page.`
      ],
      en: [
        `Cédric Barme, founder of NSY (EURL founded in 2018). ${XP} years behind the scenes of France's largest financial institutions — distributed architecture, real-time trading platforms, legacy-core migration. Now an independent consultant and AI-powered web creator.`,
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
        `Le plus simple : le formulaire en bas de page (réponse sous 48 h ouvrées), ou par téléphone au +33 (0)6 72 94 71 06. Vous pouvez aussi cliquer sur « Parler à Cédric → » juste en dessous pour aller au formulaire.`,
        `Pour échanger : formulaire en bas de page, ou un créneau de 30 min via LinkedIn. Réponse sous 48 h ouvrées avec une lecture honnête de votre besoin.`
      ],
      en: [
        `Easiest path: the form at the bottom of the page (reply within 48 business hours), or by phone at +33 (0)6 72 94 71 06. You can also click "Talk to Cédric →" just below to jump to the form.`,
        `To get in touch: the form at the bottom, or a 30-min slot via LinkedIn. Reply within 48 business hours, with an honest read of your need.`
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
    'index.html': 'index-en.html',
    'mentions-legales.html': 'legal-notice.html',
    'confidentialite.html': 'privacy.html',
    'faisabilite.html': 'feasibility.html',
    'realisations.html': 'portfolio.html',
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
    if (v.id === 'glyph-video') return;
    setupLoopFade(v);
  });

  // ───── Power saving: pause looping videos off-screen / in background ─────
  // A looping <video> re-decodes every frame for as long as it plays — there
  // is no "cached decoded frames" for a loop. So the only way to stop the
  // continuous CPU/GPU cost is to actually pause it when it isn't visible:
  //   • off-screen (scrolled out of view) — the 2 service videos sit below
  //     the fold and were decoding for nothing;
  //   • hidden tab — no point decoding what the user can't see.
  const loopingVideos = Array.from(document.querySelectorAll('video[loop]'));
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
    const aio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        e.target.classList.toggle('anim-paused', !e.isIntersecting);
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

  // ───── Barre de progression de lecture (toutes pages) ─────
  // Feedback lié au geste de l'utilisateur → autorisée même en reduced-motion.
  // transform: scaleX (composité), mise à jour au plus 1×/frame via rAF-guard.
  {
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    // Dans la nav sticky (ancrée sous le menu, façon PRV Concept) ;
    // fallback en haut du viewport si une page n'avait pas de nav.
    (document.querySelector('.nav') || document.body).appendChild(bar);
    let ticking = false;
    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, doc.scrollTop / max).toFixed(4) : 0})`;
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
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
