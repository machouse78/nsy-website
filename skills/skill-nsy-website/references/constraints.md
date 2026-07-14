# NSY website — detailed constraints & decisions

Reference for `skill-nsy-website`. Every item here came from an explicit
instruction or decision by the owner (Cédric Barme). Treat them as standing
requirements, not suggestions.

## 1. Identity & facts

| Field | Value |
|---|---|
| Company | NSY — EURL |
| Founder / owner | Cédric Barme |
| **Founded** | **2018** (the "NSY · Fondateur" timeline entry is `2018 →`, never 2026) |
| Capital | 100 € |
| SIREN | 842 078 453 |
| HQ | Epieds-en-Beauce, Centre-Val de Loire, France |
| Hosting | Infomaniak (Switzerland) |
| Email / phone | contact@nsy.fr / +33 (0)6 72 94 71 06 |
| LinkedIn | linkedin.com/in/cédric-barme |
| GitHub | github.com/machouse78/nsy-website |
| Availability label | "Disponible maintenant" / "Available now" — owner is available immediately, **no Q4-{year} date anywhere** (removed on owner request) |
| Experience | `data-years` injected by JS; career start 2012 (→ 14 yrs in 2026) |

**Offerings (two + bonus):** (1) senior technical consulting for finance &
insurance (architecture, audit, migration, compliance — ACPR/AMF/RGPD/DORA);
(2) AI-powered web creation; bonus: in-house 3D animations/models.

**Pricing:** NO amount displayed anywhere (owner decision, July 2026) —
pricing is « en fonction du besoin / devis après cadrage ». The old
« from 5 800 € HT » (and the wrong 9 800) are both obsolete: never
reintroduce a figure nor day-rate/fixed-fee wording. Applies to: services
cards, chatbot, FAQ, pillar pages, JSON-LD Offers, llms.txt, README.

## 2. Stack (and what it is NOT)
- Vanilla **HTML5 + CSS3 + JS**, zero framework, zero bundler.
- **PHP** `contact.php`: PHPMailer over Infomaniak SMTP + Cloudflare Turnstile
  anti-bot + honeypot + localized HTML auto-responder (hidden `lang` field).
  SMTP creds in `_secret/config.php` (gitignored; example provided).
- `<model-viewer>` 4.2.0 (Three.js) for the 3D.
- Build-time only (not shipped to browser): Blender 4.x + glTF-Transform +
  Draco + Puppeteer (see `package.json` devDependencies).
- **Never** call it "React/Vite/portfolio" — the GitHub About once said that and
  it was explicitly wrong. Correct GitHub About is set (description + topics).

## 3. Bilingual system (FR/EN)
- One HTML file per language; slugs are **real translations**:
  - `index.html` ↔ `index-en.html` (exception: index keeps the name)
  - `loisirs.html`? → folded into the homepage (see §7); historically
    `loisirs.html` ↔ `hobbies.html`
  - `mentions-legales.html` ↔ `legal-notice.html`
  - `confidentialite.html` ↔ `privacy.html`
- **Flag switcher** 🇫🇷🇬🇧 in the nav (chosen over text). On click: set cookie
  `nsy_lang=<fr|en>` (1 yr, SameSite=Lax) and redirect using the explicit
  `SLUG_FR_TO_EN` map in `js/app.js`.
- **Auto-detection** (owner asked for it): `.htaccess` on `/` (no cookie) reads
  `Accept-Language`; if it starts with `en`, 302 → `/index-en.html`. Cookie
  (user choice) wins thereafter.
- **hreflang** must be **reciprocal** `fr` / `en` / `x-default` on all 6 pages,
  each page self-canonical. Home references use the trailing-slash form
  `https://www.nsy.fr/` everywhere (canonical, hreflang, og:url, sitemap).
- All pages were translated to English (owner: "toutes les pages du site").

### A language change applies to the WHOLE site — every layer
Owner rule: any i18n change must be propagated everywhere, not just the
visible page copy. When touching language, go through all layers:
- **Visible HTML** copy on both the FR and EN page.
- **JS-injected UI strings** (`js/app.js`): the contact button states
  (`Envoi…/Sending…`, `Envoyé ✓/Sent ✓`, `Réessayer/Retry`) and the success /
  send-error / network-error **toasts** — keyed by `pageLang` (defined once at
  the top of the IIFE).
- **PHP server responses + transactional email** (`contact.php`): a hidden
  `lang` field is posted (`lang=fr` on the FR form, `lang=en` on the EN form).
  `contact.php` reads it and makes bilingual: every JSON error message (via a
  `$L(fr,en)` helper) **and the auto-responder email** to the prospect
  (subject, HTML body, AltBody, `<html lang>`, and the service label —
  e.g. "Web creation · AI" for EN). The admin notification to Cédric stays FR
  (it's internal).
- **Every `<form>` must carry the hidden `lang` field** matching its page.
- Plus the usual: meta / OG / Twitter / JSON-LD, legal pages, `sitemap.xml`,
  the chatbot.

### Feasibility questionnaire (`faisabilite.html` / `feasibility.html`)
- A **dedicated bilingual page** (NOT inlined in the homepage — keeps it light):
  a **7-step wizard**, ~80 fields, dark NSY theme, `.qz-` CSS namespace in
  `style.css`, behaviour in **`js/faisabilite.js`**. Reached from the Contact
  section via a `.faisa-cta` card and a footer "Contact" link on every page.
- Handler **`faisabilite.php`** mirrors `contact.php` exactly: SMTP + Turnstile
  + honeypot + 60s rate-limit, an admin notification in the **same light-card
  email style** (answers grouped by section) **and the same dark NSY
  auto-responder** to the visitor. Bilingual via the hidden `lang` field.
- **Single-source labels (DRY):** the question + answer labels live ONLY in the
  HTML (translated per page). `js/faisabilite.js` reads them from the DOM into a
  JSON `payload` = `[{section, items:[{label, value, sub}]}]` (empty answers
  skipped); `faisabilite.php` renders that payload generically, so it never
  needs to know the questions — **FR / EN / email can't drift**. Edit a question
  → edit the HTML only. Required radio/checkbox groups carry `data-required`;
  required text fields use `required`; `contact_nom` + `contact_email` are the
  server-validated fields. New slug pair added to `SLUG_FR_TO_EN` in `app.js`,
  to `sitemap.xml` (hreflang), and to `prepare-deploy.sh` (copy + required list).

## 4. Copy / terminology rules
- **The 3D section is "Conception 3D" (FR) / "3D Design" (EN)** — owner renamed
  it from "Loisirs & créations" / "Hobbies & creations". Appears in the section
  eyebrow + the footer "Navigation" link + the chatbot answers. Internal names
  (`#creations` id, `.hobbie-*` classes, chatbot cues `loisir`/`hobby`) unchanged.
- **"Wireframe" → "Maillage"** on FR pages (eyebrow, title, alt). EN keeps
  "Wireframe". The GLB filename `renault-wireframe.glb` is unchanged (it's a URL).
- **Ban "K2000" and "Knight Rider"** anywhere (HTML, README, code comments).
  Sober wording instead (e.g. "maillage cyan néon, en rotation temps réel").
- "création web propulsée par l'IA" is grammatically correct (propulsée ↔
  création, féminin) — leave it. Owner confirmed keep as is.

## 5. Cookies & legal compliance
- The site uses exactly **one cookie**: `nsy_lang`, functional, set only on an
  explicit user action (flag click) → exempt from prior consent under **CNIL
  deliberation 2020-091 (17 Sep 2020)**. **No cookie banner.** (Owner chose the
  "documentation only" route over a consent banner.)
- Legal pages (`mentions-legales`/`legal-notice`, `confidentialite`/`privacy`)
  must describe this cookie and otherwise state "no tracking cookies / no
  third-party analytics". If a new cookie is ever added, update the legal pages
  (owner flagged this explicitly).
- When a fact changes (price, founding year, etc.), propagate to legal pages,
  meta descriptions, JSON-LD, sitemap and the chatbot — not just the visible card.

## 6. Chatbot (`js/app.js`)
- **Rule-based intent engine — no LLM, no API key** (owner chose "règles
  enrichies (gratuit)" over a real Claude API integration). It must stay free,
  offline-capable, no secret.
- Engine: normalize input (lowercase, strip accents, strip punctuation) →
  specificity-weighted keyword scoring → best intent → rotate response variants.
  ~16 topics incl. pricing, availability, finance/insurance, services, web/AI,
  **3D/creations**, about Cédric, tech stack, process, location, references,
  GDPR, why-NSY, contact + smalltalk + fallback.
- **Per-message language detection**: reply in the language of the question
  (FR/EN), not just the page language. (Owner: "il parle anglais aussi".)
- Keep facts accurate (no prices displayed, founded 2018, etc.).

## 7. Homepage structure / the "Conception 3D" section
- The standalone Loisirs/Hobbies page was removed; its content is a homepage
  **section `id="creations"`** (eyebrow now **"Conception 3D"** / **"3D Design"**)
  placed right after "Principes de travail" / "Working principles".
  301-redirect the old slugs to it.
- **No top-nav link** (owner: the section is enough). The footer "Navigation"
  link ("Conception 3D" / "3D Design") points to `#creations`. Legal/other pages
  link to `index{,-en}.html#creations`.
- `#creations` layout: **desktop = 2 columns** — vertical YouTube **Short** on
  the **left** in a portrait card (`grid-template-columns: minmax(0,340px) 1fr`,
  so the Short is ~340px wide and the interactive wireframe is **larger on the
  right**). **Mobile (≤920px) = stacked**, one after the other; the Short stays
  capped at 340px and centered (`.hobbie-showcase.is-short`, `max-width:340px`).
- Creation 01 = **YouTube embed** of NSY's channel via `youtube-nocookie.com`
  (privacy-friendly), **Short** id **`bJPxWWbOFSM`** ("✨ Renault 25 Baccara V6
  Turbo Black Sherry | La légende française en 4K ✨ #shorts"). It is a **vertical 9:16** clip — the embed box
  uses `aspect-ratio: 9/16` via the `.hobbie-showcase.is-short` modifier (not the
  default 16:9). The old local `animation.mp4` is no longer deployed.
  Embed params: `rel=0&controls=0&playsinline=1&iv_load_policy=3` — **`controls=0`
  is deliberate** (owner wants a clean player with NO control/title overlay that
  fades in on play, so the video is fully visible immediately); `playsinline=1`
  keeps it inside the portrait card on iOS. Keep `controls=0` unless asked.

## 8. 3D Renault wireframe
- Source: `public/Renault_R25_Baccara_1992.blend` (gitignored, large). Ship only
  the optimized `public/renault-wireframe.glb` (~660 KB).
- **Color: cyan neon #00E5FF.** Rendering: **GL_LINES primitives**, NOT the
  Blender Wireframe modifier (its 3D tubes overlap into a solid blob — rejected).
- Pipeline `scripts/build-wireframe.sh`: Blender headless `process-renault.py`
  (purge decor, join 163 meshes, recenter+scale to ~2-unit centered bbox,
  decimate to ~15k tris, cyan emissive material, export TRIANGLES) →
  `tris-to-lines.mjs` (triangles → deduped edges, primitive mode LINES).
- Geometry MUST be **centered** (orbit pivot = car center) and not too far / not
  too small (owner's repeated complaints). Verify the bbox is symmetric.
- **Auto-rotate clockwise**: `rotation-per-second="-20deg"` (negative = clockwise).
- **Auto-rotate MUST survive a portrait↔landscape orientation change AND the
  expanded/fullscreen mode** (owner requirement). The turntable is governed by a
  single `syncModelRotation()` helper in `js/app.js`: `auto-rotate` stays ON
  while `#creations` is on-screen OR the model is expanded, and is removed ONLY
  when genuinely off-screen (power saving). It also listens to
  `orientationchange`/`resize`/`screen.orientation` to re-assert + reframe after
  the layout settles. Do NOT go back to toggling `auto-rotate` straight from the
  IntersectionObserver — that froze the model on rotation and when fullscreen.
- Anti-download: **dissuasion only, no watermark** — `.htaccess` anti-hotlink on
  mp4/glb (Referer check) + `controlsList="nodownload..."` / `oncontextmenu`.
- Owner pain point: do not push 3D blind. **Render/screenshot first**
  (`scripts/screenshot-glb.mjs` loads the GLB in headless Chrome via
  model-viewer; `scripts/render-comparison.py` does a Cycles render). Compare to
  the source before claiming success.

## 9. Responsive / cross-device
- Mobile nav: **2-row compact layout up to 940px** (so landscape phones — iPhone
  14 @844, Pro Max @932 — get it; the desktop 1-row nav needs ~914px and
  overflowed, cutting the "Disponible" CTA). A zero-height **`.nav-break`**
  element forces the links onto row 2 so the **flags stay inline in every
  language** (FR labels are wider and used to push flags to a 3rd line). The
  menus must look uniform across languages.
- Android Chrome **font-boosting** fix: `html,body { text-size-adjust: 100% }`
  + `overflow-x: hidden` safety net + `h1..h4,p { overflow-wrap: anywhere }`.
- Real overflow root-cause fixes over masking: e.g. `.hero-meta` 3-col grid was
  too wide on phones → goes 2-col ≤420px. Diagnose with overflow-x temporarily
  visible; fix the actual offending element.

## 10. Performance / power-saving
- Principle: **only decode / animate / render what's visible.**
  - Looping `<video>` paused off-screen (IntersectionObserver) + paused when tab
    hidden (`visibilitychange`).
  - Off-screen sections' CSS animations frozen via `.anim-paused`
    (`animation-play-state: paused`, pseudo-elements included), toggled on
    `.hero / .marquee / #about / #creations`.
  - `<model-viewer>` auto-rotate managed by `syncModelRotation()`: ON while
    `#creations` is visible OR the model is expanded, removed only off-screen
    (it already pauses WebGL rendering off-screen natively). NB: it must keep
    spinning across portrait↔landscape + in fullscreen — see §8.
- **Do NOT touch the chatbot's CSS animations** (cbot-ping/pulse/bounce) — they
  stay running. (Explicit owner instruction.)
- Recompress over-sized media to real display size (hero video was 1080p @5Mbps
  for a ~300px circular sphere → re-encoded to a centered 720×720 crop, ~−75%
  decode). Caching (`.htaccess` max-age) avoids re-download, not re-decode.

## 11. SEO / .htaccess
- Single canonical-host 301: force `https://www.nsy.fr` (http→https AND
  non-www→www in one hop). Verified live: `nsy.fr` → `www.nsy.fr` works.
- 301-redirect any retired slug to its replacement.
- Sitemap includes pages + anchors + hreflang `xhtml:link` alternates.
- `.htaccess` also: GZIP, cache headers, security headers, Accept-Language
  auto-detect, anti-hotlink for mp4/webm/ogv/glb/gltf.

## 12. Workflow & deployment
- **Autonomous execution** (owner's standing preference, in memory): run
  commands without asking; pause only for destructive/irreversible ops.
- **Nav & footer = `partials/` (single source of truth).** Edit
  `partials/{nav,footer}.{fr,en}.html`, then `node scripts/sync-partials.mjs`
  (`npm run partials`) rewrites the `<!-- @partial:nav/footer -->` regions in
  all 8 pages; `prepare-deploy.sh` runs it too. Never hand-edit `<nav>`/`<footer>`
  in a page (overwritten + you'd miss the other 7). `{{P}}` = anchor base path
  (`''` home / `index.html`|`index-en.html` sub). Reason it exists: the owner
  was tired of half the pages being forgotten on every nav/footer change.
- Develop in the git worktree; commit + push to **`main`** (fast-forward push
  `HEAD:main`), then `git pull --ff-only origin main` in the primary worktree.
  Commit messages end with `Co-Authored-By: Claude <model> <noreply@anthropic.com>`.
- **`./prepare-deploy.sh`** rebuilds `deploy/` (copies only used assets + the
  4 EN/FR pages + contact.php + vendor + _secret + media), verifies required
  files and broken refs. Run it after changes.
- **Deploy** = FTP the *contents* of `deploy/` into Infomaniak `public_html/`
  (must include hidden `.htaccess` and `_secret/`). After each change, tell the
  owner exactly which files to re-upload. Note: the live site only updates when
  the owner uploads — don't assume a fix is live until then (verify with `curl`
  if needed).
- Keep `README.md` current AND the **GitHub repo About** (description + topics)
  — both were explicitly requested to be maintained.
- **Verify before declaring done**: drive the page in headless Chrome/Puppeteer
  and screenshot; for 3D, render the GLB. The owner has repeatedly (and rightly)
  pushed back on "it's fixed" claims that weren't checked visually.
