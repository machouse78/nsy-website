---
name: skill-nsy-website
description: Conventions, facts, and workflow for the NSY website project (nsy.fr) — Cédric Barme's consulting/AI-web vitrine. Use whenever working in the nsy-website repo or on anything for nsy.fr (HTML/CSS/JS/PHP edits, the FR/EN bilingual setup, the chatbot, the 3D Renault wireframe, SEO/GEO/LLMO (llms.txt, FAQ, JSON-LD), .htaccess, deployment, README/GitHub upkeep). Carries the owner's specific, durable constraints so they don't have to be re-stated.
---

# NSY website — project rules

Static **multi-page** bilingual (FR/EN) site for **NSY**, EURL of **Cédric Barme**.
Stack: **vanilla HTML/CSS/JS, no framework/bundler**; PHP backend for the
contact form (PHPMailer + Infomaniak SMTP + Cloudflare Turnstile);
`<model-viewer>` 4.2.0 for 3D. Hosted on **Infomaniak**. It is **NOT**
React/Vite — never describe it as such.

Read `references/constraints.md` for the full detail. The non-negotiables below
must hold in every change.

## Always-true facts (keep accurate everywhere — pages, chatbot, legal, meta)
- NSY founded **2018** (not 2026). Owner/founder: **Cédric Barme**. EURL,
  capital 100 €, SIREN 842 078 453, Epieds-en-Beauce (Centre-Val de Loire).
- **Display rule (owner request):** the **share capital** and the **registered
  office / city** must appear ONLY on the legal pages (`mentions-legales.html`
  / `legal-notice.html`) where they are legally required (LCEN). They must NOT
  appear elsewhere — footer, contact card, About, JSON-LD, emails, chatbot,
  sitemap captions, etc. Only "France" (or at most "Centre-Val de Loire") is
  acceptable outside the legal pages.
- **NO prices displayed anywhere** (owner, July 2026): pricing is « en fonction du besoin / devis après cadrage » — never reintroduce an amount (the old « from 5 800 € HT » is obsolete) nor day-rate/fixed-fee wording.
- **NO availability badge displayed** (owner, July 2026): the nav CTA
  « Disponible maintenant » was removed. Availability is only discussed in
  replies (3 clients max, scheduling assessed per request), never shown as a
  status. No Q4-{year} date anywhere. Experience via `data-years` (career
  start 2012).
- **NO email address anywhere public** (owner request — spam harvesting):
  contact = the form + phone +33 6 72 94 71 06 + LinkedIn. This covers pages,
  chatbot, JSON-LD, llms.txt, README, error messages and the PHP auto-reply
  ("répondez à cet email" — Reply-To is set server-side). Never reintroduce
  a mailto: or a written-out address.
- **Static text uses absolute dates** ("depuis 2012", "fondée en 2018") instead
  of ageing counts ("14 ans") — the dynamic `data-years` spans are the only
  place the computed number lives.
- Official profiles (JSON-LD sameAs + llms.txt; the nav/footer social icons
  point to the COMPANY page, the personal profile stays only on the contact
  « 30 min » card): LinkedIn company page
  https://www.linkedin.com/company/nsy-new-software-yard · LinkedIn founder
  /in/cédric-barme · GitHub machouse78 · YouTube @new-software-yard.

## Copy & terminology
- The 3D section is labelled **"Conception 3D"** (FR) / **"3D Design"** (EN) —
  renamed from "Loisirs"/"Hobbies & créations" (owner). "Wireframe" →
  **"Maillage"** (EN keeps "Wireframe"). Internal names unchanged: the `#creations`
  id, the `.hobbie-*` CSS classes, and the chatbot cues stay as-is.
- **No "K2000" / "Knight Rider"** wording anywhere — keep copy sober/pro.
- Tone: professional consulting. Don't reintroduce gimmicks.

## Bilingual (FR/EN) — every new page or link must stay symmetric
- One file per language, **real translated slugs** (mentions-legales↔legal-notice,
  confidentialite↔privacy, faisabilite↔feasibility, realisations↔portfolio,
  services↔services-en, a-propos↔about, contact↔contact-en,
  conception-3d↔3d-design, plus the 8 wave-2 pillar pairs: expertise-migration-java-ee↔java-ee-migration,
  expertise-wildfly-jboss↔wildfly-jboss-expert, etc.) — EXCEPT the home
  (`index.html` ↔ `index-en.html`) and the FAQ (`faq.html` ↔ `faq-en.html`)
  which use the -en suffix. **Source of truth: `SLUG_FR_TO_EN` in `js/app.js`.**
- **Flag switcher** 🇫🇷🇬🇧 (not text), sets `nsy_lang` cookie + redirects via the
  explicit slug map in `js/app.js`. `.htaccess` auto-detects `Accept-Language`
  on `/`. Reciprocal **hreflang** fr/en/x-default + self-canonical on every
  page; the home canonical is `https://www.nsy.fr/` (trailing slash, consistent).
- Touching pages/links means updating ALL of: nav, footer, `sitemap.xml`,
  hreflang, `.htaccess` (slug + 301s), `prepare-deploy.sh`.

## ⚠️ Nav & footer are PARTIALS — never edit them per-page
- The top nav and the footer are a **single source of truth** in `partials/`:
  `nav.fr.html` · `nav.en.html` · `footer.fr.html` · `footer.en.html`.
- To change the nav or footer: **edit the partial(s)**, then run
  `node scripts/sync-partials.mjs` (or `npm run partials`). It rewrites the
  regions marked `<!-- @partial:nav -->…<!-- @endpartial:nav -->` /
  `…:footer…` in **all 36 pages** at once (idempotent). `prepare-deploy.sh`
  also runs it automatically. **Do NOT hand-edit `<nav>`/`<footer>` inside a
  page** — your change will be overwritten on the next sync, and you'd only
  touch one page anyway.
- `{{P}}` in a partial = base path for in-page anchors: `''` on the home pages
  (`#services`, smooth scroll + scroll-spy) and `index.html`/`index-en.html`
  on sub-pages (jump back to the homepage section). Per-language partials carry
  the right active flag + EN/FR labels. The committed `.html` keeps the rendered
  markup (local `python -m http.server` preview + SEO still work; no runtime
  include). The nav has **5 links** (Accueil, Services, Réalisations, À propos,
  Contact — Réalisations added on owner request, July 2026) and **no CTA
  badge**. Other pages stay discoverable via the footer.
- **Multi-page structure (owner, July 2026):** the site is NO LONGER
  one-page. Each top-nav item is its own page — the home (`index.html` /
  `index-en.html`) is a **landing** (hero + marquee + an offers teaser →
  Services, a profile teaser → À propos, a CTA banner → Contact) and links
  out to `services.html`·`services-en.html`, `a-propos.html`·`about.html`,
  `contact.html`·`contact-en.html`, `realisations.html`·`portfolio.html`.
  **`conception-3d.html`·`3d-design.html`** is its own page too (footer +
  chatbot link, NOT in the top nav). The contact **form** now lives on the
  Contact page (still posts to `contact.php`, unchanged); the 3D
  `<model-viewer>` lives on the Conception 3D page. In-page `#services` /
  `#about` / `#contact` / `#creations` anchors were rewritten to real page
  URLs everywhere (nav, footer, chatbot, sitemap, llms.txt). **No hash
  anchors survive in the sitemap** — fragments can't be 301-redirected, so
  the old `/#services` URLs were removed, not aliased.
- **A language change must be applied to the WHOLE site, every layer** — not
  just visible HTML copy. Check: visible text (FR+EN pages), **JS-injected UI
  strings** (button states, toasts in `js/app.js`, keyed by `pageLang`),
  **PHP server messages + the auto-responder email** (`contact.php`, keyed by
  the hidden `lang` form field), the **hidden `lang` field on every form**,
  meta/OG/JSON-LD, legal pages, sitemap and the chatbot. The contact form is
  fully bilingual end-to-end (front strings + server errors + auto-reply email).

## Feasibility questionnaire (faisabilite.html / feasibility.html)
- Dedicated bilingual page (a **7-step wizard**, ~80 fields) linked from the
  **Contact section** via a `.faisa-cta` card + a footer "Contact" link on every
  page. NOT inlined in the homepage (keeps it light). Dark NSY theme, `.qz-`
  CSS namespace in `style.css`, logic in **`js/faisabilite.js`**.
- Submission mirrors the contact form: POST → **`faisabilite.php`** (same SMTP /
  Turnstile / honeypot / rate-limit) → admin email (light card, like contact)
  **+ dark NSY auto-responder** to the visitor. Bilingual via the hidden `lang`.
- **DRY rule:** question/answer labels live ONLY in the HTML (translated per
  page). `js/faisabilite.js` reads them from the DOM into a structured JSON
  `payload` `[{section, items:[{label,value,sub}]}]`; `faisabilite.php` renders
  that generically — so FR / EN / email never drift. To edit a question, edit
  the HTML; no PHP/JS change needed.

## SEO / GEO / LLMO — the site must stay citable by AI assistants
- **Goal (owner request):** rank in Google AND be understood/cited by
  generative engines (ChatGPT, Claude, Gemini, Perplexity, Copilot…).
- **`robots.txt` explicitly allows 18 AI crawlers** (GPTBot, OAI-SearchBot,
  ChatGPT-User, ClaudeBot, Claude-SearchBot/-User, anthropic-ai,
  Google-Extended, PerplexityBot, Perplexity-User, Bytespider, CCBot,
  Amazonbot, FacebookBot, meta-externalagent, Applebot-Extended,
  MistralAI-User). Never re-block them.
- **`llms.txt` + `llms-full.txt`** (root, deployed): identity, expertise,
  offers, entity graph, "when to recommend NSY". **Same sync rule as the
  chatbot:** any fact change (price, offer, reference, contact) must
  propagate there too.
- **FAQ pages `faq.html` / `faq-en.html`** — 52 bilingual Q&As targeting
  conversational queries ("Qui est expert WildFly en France ?"…). The
  `FAQPage` JSON-LD is **generated from the DOM** (single source of truth =
  visible HTML; Googlebot renders JS, LLM crawlers read the text). Editing a
  Q&A = edit the HTML only, in BOTH languages. BreadcrumbList stays static.
- **JSON-LD is a `@graph`** on both home pages: Organization +
  ProfessionalService + LocalBusiness (region only — display rule) + Person +
  WebSite + 2 Service/Offer, nodes linked by `@id`
  (`https://www.nsy.fr/#org`, `#person`…). New pages should REFERENCE those
  `@id`s, not redeclare the entities.
- **Strategy doc: `SEO-GEO-LLMO.md`** (repo root, NOT deployed) — wave-2
  pages, keywords, per-engine mechanics, external trust-signal backlog.
  Keep it updated when SEO work lands.
- LLM crawlers do NOT execute JS → anything they must read (FAQ text,
  nav/footer links, facts) must exist in the static HTML. The baked-in
  partials system already guarantees this — keep it that way.

## Cookies / legal
- Only one cookie: **`nsy_lang`** (functional, set on explicit flag click) →
  CNIL deliberation 2020-091 exemption, **no consent banner**. Legal pages
  must document it and stay accurate ("no tracking cookies"). Any fact change
  (price, date…) must propagate to legal pages and the chatbot too.

## Chatbot (AI assistant)
- **Two tiers, 100% free** (the owner insists on AI + intelligence + free):
  1. **LLM via `chat.php`** — PHP proxy calling Mistral (free "Experiment" tier,
     EU-hosted, OpenAI-compatible; provider swappable in `_secret/ai.php`).
     Grounded by injecting **`llms-full.txt`** as system context (RAG — one
     source of truth, keep it in sync and the bot follows). Guardrails in the
     prompt: no prices, no email/phone, internal links only, visitor's language.
     Quota protection: origin check, per-IP rate limit (8/min, 60/day, hashed
     IP, no content logged) + global cap; retry on provider 429.
  2. **Rule-based intent engine as fallback** — kept intact in `js/app.js`. No
     key / quota hit / API down / offline → it answers instantly and the UI
     switches honestly to "Réponses automatisées". Keep its answers consistent
     with the facts above.
- Widget markup lives in **`partials/chatbot.{fr,en}.html`**, injected on all
  36 pages by `scripts/sync-partials.mjs` (auto-inserts markers before the
  app.js script tag). Conversation history follows the visitor across pages
  (sessionStorage). LLM output rendered via the safe minimal-Markdown pass
  (escape everything, reintroduce only bold + internal .html links) — never
  render raw LLM HTML.
- **`_secret/ai.php` = the API key, owner-managed** — never write the key, never
  commit it (gitignored, like the SMTP config); `_secret/ai.php.example` is the
  committed template. Server upload is done once by hand (deploy excludes
  `_secret/`).
- Transparency is a feature: "IA · Mistral" badge, EU note in the widget foot,
  dedicated GDPR section in confidentialite/privacy — keep them when editing.
- Do **NOT** pause/alter the chatbot's CSS animations.

## 3D Renault model
- Cyan neon **#00E5FF**, **GL_LINES** wireframe (not Wireframe-modifier tubes),
  centered geometry, ~660 KB. Rebuilt via `scripts/build-wireframe.sh`.
- Auto-rotate **clockwise** (`rotation-per-second` negative, e.g. `-20deg`).
- Anti-download = **dissuasion only, no watermark** (.htaccess anti-hotlink +
  controlsList/oncontextmenu).
- **Never push a 3D change without first rendering/screenshotting the result**
  and confirming it looks right (use `scripts/screenshot-glb.mjs`).

## Client realizations — DEDICATED PAGE (`realisations.html` / `portfolio.html`)
- A **standalone bilingual page** (NOT a homepage section — owner moved it out),
  showing delivered client websites as a `.realisations-grid` of
  `.realisation-card`s (screenshot thumbnail → live site, name, URL, need +
  technical/SEO specs, tags — see the "fiche réalisation" bullet below). First
  entry: **PRV Concept** (www.prv-concept.com), thumbnail
  `public/prv-concept.jpg`. **Thumbnails are captured automatically from the
  live sites** via `npm run capture:realisations`
  (`scripts/capture-realisation.mjs`: headless render at 1440px desktop
  layout, resampled to 1100px JPEG ~110 KB — no iframe, zero runtime cost;
  re-run before a deploy to refresh). To add a client: copy one
  `.realisation-card` block in **both** pages + add a capture line to the
  npm script.
- **Card content = a compact "fiche réalisation" (owner request, July 2026)** —
  each `.realisation-card` states, concisely (no over-detailing): (1) the
  **functional need** in `.realisation-desc` (lead with a bold "Le besoin :" /
  "The brief:"), then (2) a `<dl class="realisation-specs">` mini-sheet with an
  optional **Périmètre/Scope** row for larger builds (sections, entry counts,
  standout features — PRV Concept has one), a **Technique/Tech** row (stack,
  framework-or-not, bilingual, hosting, notable constraints) and a **SEO / GEO**
  row (structured data / sitemaps / canonicals + generative-engine optimisation
  — GEO/LLMO), then (3) `.realisation-tags`. Keep both languages symmetric.
  Same for every future client site.
- **Reached from a button** "Voir nos réalisations" / "See our work" placed in
  the **Web·IA service card** `.svc-foot` (right of "Démarrer un projet", grouped
  in `.svc-actions`), plus the footer "Réalisations"/"Work" link → the page.
  **No top-nav link** (keeps the already-tight nav from overflowing < ~1100px).
- Slug pair `realisations.html ↔ portfolio.html` is in `SLUG_FR_TO_EN`
  (`js/app.js`), `sitemap.xml` (own URLs + hreflang + the PRV image), the
  `sync-partials.mjs` page list (so nav/footer sync there too), and
  `prepare-deploy.sh`.

## Layout / responsive
- ⚠️ **`overflow-x` on `html/body` must stay `clip`, never `hidden`** —
  `hidden` silently kills every `position: sticky` on the site (anchored nav,
  About profile card). `hidden` is kept only as the fallback line for old
  browsers. `scroll-padding-top` (84px desktop / 108px ≤940px) keeps anchors
  landing below the sticky nav.
- The 3D-design content (eyebrow **"Conception 3D"** / **"3D Design"**) lives
  on its **dedicated page** `conception-3d.html` / `3d-design.html` (footer +
  chatbot link, NOT in the top nav) **and** as a **teaser section `#creations`
  at the bottom of the Services page** (`services.html` / `services-en.html`,
  owner request July 2026): the interactive wireframe model (`loading="lazy"`)
  centered + a "Découvrir la Conception 3D" / "Explore 3D Design" CTA to the
  full page. The dedicated page holds 2 items in a `.creations-grid` 2-col —
  a vertical YouTube **Short** (left, ~340px portrait card) and the larger
  wireframe model (right); mobile ≤920px stacks (Short capped at 340px,
  centered). The animation is a **YouTube embed** (youtube-nocookie.com, Short
  `bJPxWWbOFSM` — "Renault 25 Baccara V6 Turbo Black Sherry", vertical 9:16 via
  `.hobbie-showcase.is-short`), not a local mp4. Both the dedicated page and
  Services load `<model-viewer>` and give the model `id="renault-viewer"`
  (unique within each page); the expand/lightbox JS keys off that id.
- Mobile nav: compact 2-row layout up to **940px** (landscape phones included);
  the flags must stay inline in both languages.
- Keep `text-size-adjust: 100%` + the overflow-x guards (Android Chrome
  font-boosting fix).

## Performance philosophy
- "Only decode/animate/render what the user is looking at": pause looping
  videos off-screen + on hidden tab; freeze off-screen sections' CSS animations
  via `.anim-paused`; model-viewer auto-rotate paused off-screen.
- Recompress over-sized media to its real display size. The `.htaccess` cache
  avoids re-download, **not** re-decode — pausing is what saves CPU/GPU.

## Workflow (how to actually ship a change)
1. **Autonomous**: run commands without asking; only pause for destructive/
   irreversible ops.
2. Edit in the git worktree. **Verify visually** with headless Chrome /
   Puppeteer screenshots before pushing (especially 3D + responsive). Never
   claim "fixed" without checking the real render.
3. Run **`./prepare-deploy.sh`** (rebuilds `deploy/`, checks files + refs).
4. Commit (message ends with `Co-Authored-By: Claude ...`), push to **main**
   (fast-forward), then `git pull --ff-only origin main` in the primary worktree.
5. Keep **`README.md`** and the **GitHub repo "About"** (description + topics)
   up to date when scope changes.
6. **Deploy = `./deploy.sh`, on explicit request only** (the owner wants me to
   push to the FTP directly, not click a GitHub button). It rebuilds `deploy/`
   then uploads via `scripts/ftp-deploy.py` — **one persistent FTPS connection**
   for every file (a `curl` per file opens ~63 rapid connections → Infomaniak
   returns **450 anti-flood**). Target/announce the files first, get the owner's
   OK, then run it.
   - **`FTP_DIR=""`** — the dedicated NSY FTP account **lands directly on the web
     root**; a `"web"` value creates a nested `web/` the live site does NOT serve.
   - **No remote deletion**; `_secret/config.php` (SMTP) is excluded and never
     overwritten. **Never write or echo the FTP password** — the owner fills
     `_secret/ftp.env` (gitignored) himself.
   - Verify live: compare the HTTP `content-length` to the FTP size (a media cache
     can serve a stale copy), and `/_secret/*` must return **403**.
