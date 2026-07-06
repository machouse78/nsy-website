---
name: skill-nsy-website
description: Conventions, facts, and workflow for the NSY website project (nsy.fr) — Cédric Barme's consulting/AI-web vitrine. Use whenever working in the nsy-website repo or on anything for nsy.fr (HTML/CSS/JS/PHP edits, the FR/EN bilingual setup, the chatbot, the 3D Renault wireframe, SEO/GEO/LLMO (llms.txt, FAQ, JSON-LD), .htaccess, deployment, README/GitHub upkeep). Carries the owner's specific, durable constraints so they don't have to be re-stated.
---

# NSY website — project rules

Static bilingual (FR/EN) one-page site for **NSY**, EURL of **Cédric Barme**.
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
- AI web creation price: **from 5 800 € HT** / **€5,800 ex-VAT** — never 9 800.
- Availability is **"now / immediate"** (owner is available immediately) — nav
  CTA says "Disponible maintenant" / "Available now", no Q4-{year} date anywhere
  (removed on owner request). Experience via `data-years` (career start 2012).
- **NO email address anywhere public** (owner request — spam harvesting):
  contact = the form + phone +33 6 72 94 71 06 + LinkedIn. This covers pages,
  chatbot, JSON-LD, llms.txt, README, error messages and the PHP auto-reply
  ("répondez à cet email" — Reply-To is set server-side). Never reintroduce
  a mailto: or a written-out address.
- **Static text uses absolute dates** ("depuis 2012", "fondée en 2018") instead
  of ageing counts ("14 ans") — the dynamic `data-years` spans are the only
  place the computed number lives.
- Official profiles (JSON-LD sameAs + llms.txt): LinkedIn company page
  https://www.linkedin.com/company/28790840 · LinkedIn founder
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
  confidentialite↔privacy, faisabilite↔feasibility, realisations↔portfolio) —
  EXCEPT the home (`index.html` ↔ `index-en.html`) and the FAQ
  (`faq.html` ↔ `faq-en.html`) which use the -en suffix.
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
  `…:footer…` in **all 12 pages** at once (idempotent). `prepare-deploy.sh`
  also runs it automatically. **Do NOT hand-edit `<nav>`/`<footer>` inside a
  page** — your change will be overwritten on the next sync, and you'd only
  touch one page anyway.
- `{{P}}` in a partial = base path for in-page anchors: `''` on the home pages
  (`#services`, smooth scroll + scroll-spy) and `index.html`/`index-en.html`
  on sub-pages (jump back to the homepage section). Per-language partials carry
  the right active flag + EN/FR labels. The committed `.html` keeps the rendered
  markup (local `python -m http.server` preview + SEO still work; no runtime
  include). The nav is intentionally 4 links (no per-section links) to avoid
  overflow — add discoverability via the footer instead.
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

## Chatbot
- **Rule-based intent engine, no LLM/API** (deliberate: free, offline, no key).
- **Detects the language of each message and replies in that language** (not
  just the page language). Keep its answers consistent with the facts above.
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
  `.realisation-card`s (screenshot thumbnail → live site, name, URL, description,
  tags). First entry: **PRV Concept** (www.prv-concept.com), thumbnail
  `public/prv-concept.jpg`. **Thumbnails are captured automatically from the
  live sites** via `npm run capture:realisations`
  (`scripts/capture-realisation.mjs`: headless render at 1440px desktop
  layout, resampled to 1100px JPEG ~110 KB — no iframe, zero runtime cost;
  re-run before a deploy to refresh). To add a client: copy one
  `.realisation-card` block in **both** pages + add a capture line to the
  npm script.
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
- The 3D-design content (eyebrow **"Conception 3D"** / **"3D Design"**) is a
  **homepage section `#creations`** (after the "Principes de travail" /
  "Working principles" block), not a standalone page; no top-nav link (the
  footer link "Conception 3D" / "3D Design" points to it). Desktop = 2 columns (vertical YouTube **Short** left in
  a ~340px portrait card, wireframe model larger right); mobile ≤920px stacks
  (Short capped at 340px, centered). The animation is a **YouTube embed**
  (youtube-nocookie.com, Short `bJPxWWbOFSM` — "Renault 25 Baccara V6 Turbo
  Black Sherry", vertical 9:16 via `.hobbie-showcase.is-short`), not a local mp4.
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
6. Deploy = upload the **contents of `deploy/`** into Infomaniak `public_html/`
   (include `.htaccess` and `_secret/`); remind the owner which files changed.
