---
name: skill-nsy-website
description: Conventions, facts, and workflow for the NSY website project (nsy.fr) — Cédric Barme's consulting/AI-web vitrine. Use whenever working in the nsy-website repo or on anything for nsy.fr (HTML/CSS/JS/PHP edits, the FR/EN bilingual setup, the chatbot, the 3D Renault wireframe, SEO/.htaccess, deployment, README/GitHub upkeep). Carries the owner's specific, durable constraints so they don't have to be re-stated.
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
- AI web creation price: **from 5 800 € HT** / **€5,800 ex-VAT** — never 9 800.
- Availability shown dynamically as **Q4 {current year}**; experience via
  `data-years` (career start 2012). Contact: contact@nsy.fr / +33 6 72 94 71 06.

## Copy & terminology
- French "Hobbies" → **"Loisirs"**; "Wireframe" → **"Maillage"** (EN keeps
  "Wireframe"). Filenames/URLs unchanged.
- **No "K2000" / "Knight Rider"** wording anywhere — keep copy sober/pro.
- Tone: professional consulting. Don't reintroduce gimmicks.

## Bilingual (FR/EN) — every new page or link must stay symmetric
- One file per language, **real translated slugs** (loisirs↔hobbies,
  mentions-legales↔legal-notice, confidentialite↔privacy) — EXCEPT the home
  stays `index.html` ↔ `index-en.html`.
- **Flag switcher** 🇫🇷🇬🇧 (not text), sets `nsy_lang` cookie + redirects via the
  explicit slug map in `js/app.js`. `.htaccess` auto-detects `Accept-Language`
  on `/`. Reciprocal **hreflang** fr/en/x-default + self-canonical on every
  page; the home canonical is `https://www.nsy.fr/` (trailing slash, consistent).
- Touching pages/links means updating ALL of: nav, footer, `sitemap.xml`,
  hreflang, `.htaccess` (slug + 301s), `prepare-deploy.sh`.
- **A language change must be applied to the WHOLE site, every layer** — not
  just visible HTML copy. Check: visible text (FR+EN pages), **JS-injected UI
  strings** (button states, toasts in `js/app.js`, keyed by `pageLang`),
  **PHP server messages + the auto-responder email** (`contact.php`, keyed by
  the hidden `lang` form field), the **hidden `lang` field on every form**,
  meta/OG/JSON-LD, legal pages, sitemap and the chatbot. The contact form is
  fully bilingual end-to-end (front strings + server errors + auto-reply email).

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

## Layout / responsive
- The Loisirs/3D content is a **homepage section `#creations`** (after the
  "Principes de travail" / "Working principles" block), not a standalone page;
  no "Loisirs" nav link. Desktop = 2 columns (vertical YouTube **Short** left in
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
