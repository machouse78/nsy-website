# NSY — Technical consulting & AI-powered web creation

[![Site](https://img.shields.io/badge/site-www.nsy.fr-00E5FF)](https://www.nsy.fr)
[![Hosting](https://img.shields.io/badge/hosting-Infomaniak-1AB7EA)](https://www.infomaniak.com)

[🇫🇷 Français](README.md) · 🇬🇧 **English**

**Multi-page bilingual (FR/EN)** website for **NSY**, a French single-member company (EURL) founded by Cédric Barme in 2018. Dual positioning: senior technical consulting for finance / insurance, and AI-powered website creation for SMEs going through their digital transition.

## Art direction

**"Cyber Cabinet"** design — deep navy + electric cyan + the logo's orange accent. Typography: Space Grotesk (display) + Manrope (body) + JetBrains Mono (annotations).

| Colour | Hex | Usage |
|---|---|---|
| `--bg-1` | `#0A0F1C` | Main background |
| `--accent` | `#00E5FF` | Electric cyan — CTAs, active links, glow, 3D wireframe |
| `--warm` | `#F08A2C` | Logo orange — rare accent touches |
| `--fg-0` / `--fg-1` / `--fg-2` | `#F2F6FF` → `#8993AF` | Blue-grey text scale |

## Stack

- **Front** : HTML5 + CSS3 + vanilla JavaScript — no framework, no bundler
- **Back (form)** : PHP + [PHPMailer](https://github.com/PHPMailer/PHPMailer) over Infomaniak SMTP, anti-bot [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/)
- **Real-time 3D** : [`<model-viewer>`](https://modelviewer.dev/) 4.2.0 (Three.js under the hood) for the interactive wireframe
- **3D pipeline (build-time)** : headless Blender 4.x + [glTF-Transform](https://gltf-transform.dev/) + Draco — see [§ Wireframe pipeline](#3d-wireframe-pipeline)
- **Google Fonts** : Space Grotesk, Manrope, JetBrains Mono
- **CSS custom properties** + `@property` for interpolable transitions (CTA banner gradient)

## Site structure

**Multi-page** site (one page per menu item) — the home page is a **landing** that funnels to the dedicated pages.

| Page | FR ↔ EN URL | Content |
|---|---|---|
| **Home** | `index.html` ↔ `index-en.html` | Landing: hero + marquee + preview of the 2 offerings (→ Services) + profile teaser (→ About) + CTA banner (→ Contact) |
| **Services** | `services.html` ↔ `services-en.html` | 2 detailed cards (consulting / AI web) + method (4 steps) + values + 3D preview (→ 3D Design) |
| **Work** | `realisations.html` ↔ `portfolio.html` | Portfolio of client sites (auto-captured thumbnails; first: PRV Concept) |
| **About** | `a-propos.html` ↔ `about.html` | Cédric Barme's profile, signals, background, sectors, principles |
| **Contact** | `contact.html` ↔ `contact-en.html` | Form (PHP) + direct channels + feasibility request |
| **3D Design** | `conception-3d.html` ↔ `3d-design.html` | Interactive Renault wireframe model + YouTube animation (3D demos) |

The contact form is still served by `contact.php` (unchanged). The top nav has **5 links** (Home, Services, Work, About, Contact); 3D Design and the FAQ are reachable from the footer.

Ancillary pages: **FAQ** `faq.html` / `faq-en.html`, **8 pairs of pillar pages** (expertise & offerings, GEO wave 2), **feasibility questionnaire** `faisabilite.html` / `feasibility.html`, legal pages.

## Bilingual (FR / EN)

One HTML page per language (no build, clean SEO), with **truly translated** slugs:

| FR | EN |
|---|---|
| `index.html` (`/`) | `index-en.html` |
| `mentions-legales.html` | `legal-notice.html` |
| `confidentialite.html` | `privacy.html` |
| `realisations.html` | `portfolio.html` |
| `faisabilite.html` | `feasibility.html` |
| `faq.html` | `faq-en.html` |
| `expertise-migration-java-ee.html` | `java-ee-migration.html` |
| `expertise-wildfly-jboss.html` | `wildfly-jboss-expert.html` |
| `expertise-openshift-kubernetes.html` | `openshift-kubernetes-expert.html` |
| `expertise-kafka-messagerie.html` | `kafka-messaging-expert.html` |
| `conformite-dora.html` | `dora-compliance.html` |
| `integration-claude-entreprise.html` | `claude-integration.html` |
| `creation-site-ia.html` | `ai-website-creation.html` |
| `glossaire-ia-web.html` | `ai-web-glossary.html` |
| `services.html` | `services-en.html` |
| `a-propos.html` | `about.html` |
| `contact.html` | `contact-en.html` |
| `conception-3d.html` | `3d-design.html` |

- **Language switch** : 🇫🇷 / 🇬🇧 flags in the nav → set an `nsy_lang` cookie (1 year, `SameSite=Lax`) and redirect to the counterpart. Explicit slug mapping in `js/app.js`.
- **Auto-detection** : on `/` (no cookie), `.htaccess` reads `Accept-Language` and 302-redirects to `/index-en.html` if the browser is in English. The user's choice (cookie) then takes precedence.
- **Reciprocal hreflang** `fr` / `en` / `x-default` on all 36 pages, self-referencing canonicals.
- **`nsy_lang` cookie** : the only functional cookie, set on explicit action (flag click) — consent-exempt (CNIL deliberation 2020-091). Documented on the legal pages.

> ⚠️ **A language change applies to the WHOLE site, at every layer** — not just the visible text. Remember: the visible HTML (FR + EN), the **JS-injected UI strings** (form button states and toasts in `js/app.js`, driven by `pageLang`), the **server responses + the email** (`contact.php`, driven by the hidden `lang` field), the **hidden `lang` field on every form**, the meta/OG/JSON-LD, the legal pages, the sitemap and the chatbot. The contact form is bilingual end to end (front + server errors + auto-reply email).

## Interactive features

- **Dynamic year & experience** : `data-current-year`, `data-years`, `data-years-fr` injected in JS (based on `2026 - 14 = 2012` as the career start year)
- **Sticky nav** (`position: sticky`) + a cyan **reading gauge** under the menu (composited scaleX). Gotcha solved: `overflow-x: hidden` on `html/body` silently disabled sticky → replaced with `overflow-x: clip` (same fix as prv-concept.com), with `scroll-padding-top` so anchors land below the menu
- **Nav scroll-spy** via `IntersectionObserver` — the active item turns cyan
- **Animations & micro-interactions** (UX pass): staggered hero entrance, scroll reveals with per-container stagger, **animated counters** on scroll-in (14+, 3 max…), **mouse parallax** on the hero visual (5 depth planes, damped lerp, desktop only), sheen on the main CTA, step/chip/arrow hovers, animated footer underlines, marquee paused on hover — all **`transform`/`opacity` only**, rAF loops that auto-stop at rest, and **full `prefers-reduced-motion` support**
- **Hero video** : `nsy-hero.mp4` with `object-fit: cover`, masked inside the **large outer circle**, floating ASCII terminals — animated NSY monogram at the heart of an energy orb (cyan finance network + orange AI mesh)
- **Service cards** : on hover, the PNG image cross-fades to an MP4 video; back to `currentTime = 0` on mouseleave
- **CTA banner** : 2 radial gradients (cyan + orange) that follow the mouse via `--mx` / `--my`, easing back (550 ms) thanks to `@property`
- **3D Design** — dedicated page `conception-3d.html` / `3d-design.html` (section `#creations`), plus a **model preview** at the bottom of the Services page:
  - **YouTube video** from NSY's channel, embedded via `youtube-nocookie.com` (no cookie before playback)
  - **Interactive wireframe model** of a 1992 Renault R25 Baccara (`<model-viewer>`) — neon cyan wireframe render, auto-rotate + mouse/touch drag; **×2 supersampling on non-Retina screens** (crisp lines at DPR 1) and a "Drag to rotate" pill auto-hidden after the first interaction
  - Dedicated page in **2 columns** on desktop (enlarged video left, wireframe right), **stacked** on mobile (≤ 920 px); the Services preview shows only the model (`loading="lazy"`) with an "Explore 3D Design" link
- **Smart chatbot** (see below)
- **Contact form** : service choice, start horizon, free-text message → handled by `contact.php` (real send + auto-reply)
- **Feasibility questionnaire** (`faisabilite.html` / `feasibility.html`) : a **7-step** wizard (~80 fields) in the site's theme, reachable from the Contact section. Submission mirrors the contact form → `faisabilite.php` (same SMTP / Turnstile / anti-bot, admin email + auto-reply in the same style). Labels live in the HTML (FR/EN); the JS serialises them into a structured payload rendered generically by PHP, so FR / EN / email never drift

### Chatbot — bilingual rule engine

Cyan FAB bottom-right, glassmorphic panel. **No LLM, no API** (deliberate: free, instant, keyless, works offline) — a carefully tuned intent engine:

- **Input normalisation** : lowercasing + accent stripping + punctuation removal ("coût", "cout", "Combien ?" → same intent)
- **Specificity-weighted scoring** : each intent is scored by the cumulative length of its matched keywords (multi-word phrases win), stem matching (tarif→tarifs)
- **~16 topics** : pricing, availability, web/AI, finance & insurance, 3D, services, Cédric's background, tech stack, how an engagement runs, location, references (NDA), data/GDPR, why NSY, contact — plus greetings (hello / thanks / goodbye)
- **2 reply variants** per topic, drawn at random → no repetition
- **Per-message language detection** : replies in FR or EN based on the question's language (not just the page's); tie → page language
- **Lightweight follow-up** : "and?", "more details", "tell me more" reopens the previous topic; a **fallback** lists what the bot can do

### Contact form — PHP backend

`contact.php` :
1. Verifies the **Cloudflare Turnstile token** (anti-bot) server-side
2. **Honeypot** anti-spam (hidden field only bots fill in)
3. Sends the message to the NSY inbox via **PHPMailer + Infomaniak SMTP** (internal notification in FR). The address appears **nowhere on the public site nor in this README** (anti-scraping): visitors go through the form, the auto-reply carries an internal `Reply-To`
4. Sends an **HTML auto-reply** to the prospect, **localised FR/EN** based on the hidden `lang` field (subject, HTML body, text version, `<html lang>`, service label)
5. Responds in JSON (`{ ok: true }` or `{ ok: false, error }`) → front-end toast

**Bilingual end to end** : every JSON error message sent back to the front (via a `$L(fr, en)` helper) **and** the auto-reply email follow the visitor's language (hidden `lang` field). On the browser side, the button states (`Envoi…/Sending…`, `Envoyé ✓/Sent ✓`, `Réessayer/Retry`) and toasts are driven by `pageLang` in `js/app.js`.

SMTP credentials live in `_secret/config.php` (gitignored). Template provided: `_secret/config.php.example`.

## 3D wireframe pipeline

The `public/renault-wireframe.glb` model (**575 KB**, neon cyan wireframe render) is generated from a source `.blend` via a reproducible chain (`scripts/`):

```bash
./scripts/build-wireframe.sh
```

1. **Headless Blender** (`process-renault.py`) : purges the set, joins the 163 meshes, recenters + normalises scale (bbox ~2 units centred on the origin), decimates aggressively (~15 k triangles), applies an emissive cyan `#00E5FF` material, exports to GLB **TRIANGLES**.
2. **Node post-processing** (`tris-to-lines.mjs`) : converts triangle indices → deduplicated unique edges and switches the primitive to **`GL_LINES`** → a true 1-pixel wireframe (not 3D tubes that merge into a blob).

Verification tools (I learned never to ship without looking at the render):
- `render-comparison.py` — renders a `.blend` or a `.glb` via Cycles
- `screenshot-glb.mjs` — loads the GLB in headless Chrome + `<model-viewer>` (render identical to the browser)
- `diagnose-renault.py` — renders the raw `.blend` from multiple angles

**Prerequisites** : Blender 4.x (`/Applications/Blender.app` on macOS) + `npm install` (devDeps: `@gltf-transform/*`, `draco3dgltf`, `puppeteer`). The source `.blend` is gitignored (too heavy) — only the optimised `.glb` is shipped.

## Performance & resource-frugality

A "cyber" site with videos, real-time 3D and animations can heat up the CPU/GPU fast. Everything that loops is paused the moment it isn't visible — the principle: **only decode / animate / render what the user is looking at**.

- **Videos** : a `<video loop>` re-decodes every frame continuously (there is no "decoded frame cache"). An `IntersectionObserver` (`js/app.js`) **pauses each looping video when it leaves the screen** and resumes it on return; a `visibilitychange` listener **pauses everything when the tab is hidden**. On load, only visible videos decode.
- **Hero video** (`nsy-hero.mp4`) : AI-generated (Higgsfield, image-to-video from the NSY logo), square **960×960**, **no audio track**, recompressed to **0.60 MB**. **Fade-to-transparent loop**: the element opacity is animated from `currentTime` (`js/app.js`) — fade-in at the start, fade-out at the end — so at the seam the video dissolves into the blue disc behind (no alpha-channel video). Paused off-screen like the other videos.
- **CSS animations** : the `.anim-paused` class, placed on a section via `IntersectionObserver` when it leaves the viewport, freezes all its animations (`animation-play-state: paused`, pseudo-elements included); removed when the section comes back.
- **3D model** : `<model-viewer>` already pauses WebGL rendering off-screen; we additionally stop `auto-rotate` when the 3D Design section isn't visible. The ×2 supersampling (sharpness) only applies to DPR 1 screens, so it costs nothing on mobile/Retina.
- **JS animations** (hero parallax, counters, reading gauge) : `requestAnimationFrame` loops that **stop by themselves at rest** (converged lerp, finished counter) — no infinite loops; all cut by `prefers-reduced-motion`.
- **Cache** : `.htaccess` sets `Cache-Control: max-age` (1 month for media) — avoids **re-downloading** (but not re-decoding, hence the pausing above).

Measured effect: steady-state video decoding at load drops from about **94 → 12 M pixels/s** (≈ −87 %), and off-screen sections repaint nothing.

## Repo structure

```
nsy-website/
├── index.html / index-en.html          # Home (landing) FR / EN
├── services.html / services-en.html     # Services: 2 offerings + method + 3D preview FR / EN
├── a-propos.html / about.html           # About: Cédric Barme's profile FR / EN
├── contact.html / contact-en.html       # Contact: PHP form + direct channels FR / EN
├── conception-3d.html / 3d-design.html  # 3D Design: wireframe model + YouTube animation FR / EN
├── mentions-legales.html / legal-notice.html
├── confidentialite.html / privacy.html
├── faisabilite.html / feasibility.html  # Feasibility questionnaire (7-step wizard) FR / EN
├── realisations.html / portfolio.html   # Client work (auto-captured thumbnails)
├── faq.html / faq-en.html               # GEO/LLMO FAQ: 52 bilingual Q&As + FAQPage JSON-LD
├── (8 pairs of GEO pillar pages)        # One expertise per URL, FR ↔ EN (see slug table):
│                                        #   expertise-migration-java-ee, expertise-wildfly-jboss,
│                                        #   expertise-openshift-kubernetes, expertise-kafka-messagerie,
│                                        #   conformite-dora, integration-claude-entreprise,
│                                        #   creation-site-ia, glossaire-ia-web
├── llms.txt / llms-full.txt             # Structured context for AI (llmstxt.org spec)
├── SEO-GEO-LLMO.md                      # Internal SEO/GEO strategy (not deployed)
├── contact.php                          # Contact form backend (PHPMailer + Turnstile)
├── faisabilite.php                      # Questionnaire backend (same pipeline as contact.php)
├── css/style.css                        # Complete styles (includes the .qz- questionnaire namespace)
├── js/app.js                            # Chatbot, i18n, video swaps, scroll-spy, 3D framing
├── js/faisabilite.js                    # Questionnaire wizard (navigation + collection + send)
├── partials/                            # ⭐ Single source of the nav + footer (FR/EN)
│   ├── nav.fr.html / nav.en.html        #    Top menu ({{P}} token = anchor base path)
│   └── footer.fr.html / footer.en.html  #    Footer
├── scripts/                             # Build tooling (3D + partials sync)
│   ├── sync-partials.mjs                # ⭐ Injects nav/footer into all 36 pages (npm run partials)
│   ├── capture-realisation.mjs          # Auto Work thumbnail (npm run capture:realisations)
│   ├── build-wireframe.sh               # Blender → GL_LINES orchestrator
│   ├── process-renault.py               # Headless Blender: decimation, material, export
│   ├── tris-to-lines.mjs                # Triangles → GL_LINES
│   ├── render-comparison.py             # Cycles render (.blend or .glb)
│   ├── screenshot-glb.mjs               # Capture via headless model-viewer
│   └── diagnose-renault.py              # Multi-angle render of the raw .blend
├── vendor/PHPMailer/                     # Mail-sending lib (src/ only)
├── _secret/                             # SMTP credentials (config.php gitignored)
│   ├── config.php.example
│   └── .htaccess                        # Deny all
├── public/                              # Publicly served assets
│   ├── nsy-logo.png + cropped-NSY-logo-*.png (favicons)
│   ├── photo-profil.jpg                 # Cédric's photo (About)
│   ├── finance-assurance.{png,mp4}      # Service 01
│   ├── web-ia.{png,mp4}                 # Service 02
│   ├── nsy-hero.mp4                     # Hero video (NSY monogram, large circle)
│   ├── nsy-og.jpg                       # Open Graph banner 1200×630
│   ├── prv-concept.jpg                  # Work thumbnail (npm run capture:realisations)
│   └── renault-wireframe.glb            # Sharp-edge wireframe 3D model (575 KB)
├── package.json                         # 3D build tooling only (devDependencies)
├── skills/                              # Claude Code skills (docs, NOT deployed) — see dedicated §
│   ├── skill-nsy-website/               #   project conventions & facts
│   ├── frontend-responsive-perf/        #   reusable responsive/perf techniques
│   ├── seo-geo-llmo/                    #   reusable SEO + GEO/LLMO playbook
│   ├── frontend-design/                 #   distinctive production-grade interfaces
│   └── video-to-website/                #   scroll-animated site from a video
├── sitemap.xml / robots.txt
├── .htaccess                            # Apache: redirects, GZIP, cache, i18n, anti-hotlink
├── prepare-deploy.sh                    # Builds the deploy/ folder
├── deploy/                              # Generated (~12 MB), to upload into public_html/
├── README.md                            # French version
└── README.en.md                         # This file (EN)
```

## Test locally

```bash
# Static server (Python preinstalled on macOS)
python3 -m http.server 8080
open http://localhost:8080
```

> The static server is enough for everything **except the form** (`contact.php` needs PHP + SMTP access, so it's only testable in production or with `php -S`). The 3D and the chatbot work locally. Cloudflare Turnstile shows a benign error on `localhost`.

## Prepare a deployment

```bash
./prepare-deploy.sh
```

The script rebuilds `deploy/` from scratch, copies **only the assets actually used** (FR+EN pages, `contact.php`, `vendor/`, `_secret/`, CSS/JS, media, `renault-wireframe.glb`), checks that required files and the references in `index.html` are present, prints the sizes, and exits with code 1 if anything is missing (CI-friendly). Final bundle ≈ **12 MB**.

## Deploy to Infomaniak

1. Run `./prepare-deploy.sh`
2. Make sure `_secret/config.php` exists (SMTP credentials) — otherwise the form won't work
3. Upload the **contents** of `deploy/` (not the folder itself) into `public_html/` via FTP / SFTP
4. **Important** : enable showing hidden files to transfer `.htaccess` and `_secret/`
5. Test `https://www.nsy.fr` — automatic SSL via Let's Encrypt
6. Check the canonical redirect: `http://nsy.fr` and `https://nsy.fr` must redirect to `https://www.nsy.fr`
7. Submit the sitemap in [Google Search Console](https://search.google.com/search-console)

The `.htaccess` configures:
- **Single canonical redirect** to `https://www.nsy.fr` (http→https **and** non-www→www, one 301)
- **301 redirects** from old URLs to the new slugs (e.g. `hobbie.html` → `conception-3d.html`, `mentions-legales-en.html` → `legal-notice.html`)
- **Language auto-detection** (`Accept-Language`) at the root
- **Anti-hotlink** on proprietary media (`mp4`, `glb`…) via Referer checking
- **GZIP**, **caching** (1 month media, 1 week CSS/JS, 1h HTML), **security headers** (`X-Frame-Options`, `Strict-Transport-Security`…)

### FTP deploy (on demand)

**Direct option — `./deploy.sh`** (recommended): rebuilds `deploy/` and uploads
it over **FTPS** (curl, `--ssl-reqd`) with **no remote deletion**. One command,
nothing ships without running it. Credentials live in **`_secret/ftp.env`**
(gitignored, like `_secret/config.php`; template: `_secret/ftp.env.example`) —
the password is handed to curl via an ephemeral config file (never in the process
list). For NSY: `FTP_DIR="web"`.

**Cloud option — GitHub Actions**: the [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
workflow uploads `deploy/` over **FTPS** too. It is **manual** (`workflow_dispatch`),
**decoupled from push**: nothing ships until it's triggered
(**Actions → Déploiement FTP → Run workflow**, or `gh workflow run deploy.yml`).
Handy to deploy from anywhere without local credentials.

- **Incremental** upload (only changed files) and **no deletion**
  (`dangerous-clean-slate: false`): `_secret/config.php` — absent from the
  versioned `deploy/` — is **never** touched on the server.
- **Secrets to create once** (GitHub → *Settings → Secrets and variables → Actions → Secrets*):
  `FTP_SERVER` (Infomaniak FTP host), `FTP_USERNAME`, `FTP_PASSWORD`.
  **Variable** `FTP_SERVER_DIR` (*Variables* tab) = the exact path your FTP client
  shows (for NSY: `web`); defaults to the FTP user's home.
- `_secret/config.php` (SMTP, gitignored) isn't in the repo: upload it **once by
  hand**, then the workflow leaves it alone.

## SEO, GEO & social sharing

- **Sitemap** : 36 pages (real URLs, no more `#` anchors) + key images + videos, with `xhtml:link` hreflang
- **Reciprocal hreflang** `fr` / `en` / `x-default` on all 36 pages
- **Consistent canonical** : everything points to `https://www.nsy.fr/` (uniform trailing slash), reinforced by the `.htaccess` redirect
- **JSON-LD `@graph`** (FR/EN home pages) : Organization + ProfessionalService + LocalBusiness (region only) + Person (Cédric Barme, `knowsAbout`) + WebSite + 2 Service/Offer — nodes linked by `@id`, sameAs LinkedIn company + founder / GitHub / YouTube
- **Robots.txt** : explicit Allow of the media in use, Disallow of `.glb`/`.gltf`

### GEO / LLMO (ranking inside generative engines)

Goal: be understood and **cited** by ChatGPT, Claude, Gemini, Perplexity, Copilot…

- **18 AI crawlers explicitly allowed** in `robots.txt` (GPTBot, OAI-SearchBot, ClaudeBot, Claude-SearchBot, Google-Extended, PerplexityBot, CCBot, Amazonbot, meta-externalagent, MistralAI-User…)
- **`llms.txt` / `llms-full.txt`** : identity, expertise, offerings, entity graph and recommendation rules, in an LLM-readable format — to be kept in sync with the site's facts (same rule as the chatbot)
- **Bilingual 52-Q&A FAQ** (`faq.html` / `faq-en.html`) targeting conversational queries ("Who is a WildFly expert in France?", "Who can integrate Claude?"…); the `FAQPage` JSON-LD is **generated from the DOM** (single source = the visible HTML)
- **Absolute dates** in static text ("since 2012", "founded in 2018") — never stale
- Full strategy, pages to create and external actions: [`SEO-GEO-LLMO.md`](SEO-GEO-LLMO.md)

### External registrations & entities

| Service | Access / reference |
|---|---|
| Google Search Console — **domain property** (verified by TXT DNS at Infomaniak, the record must stay in place) | https://search.google.com/search-console?resource_id=sc-domain:nsy.fr |
| Bing Webmaster Tools (feeds ChatGPT Search & Copilot) — verified by `msvalidate.01` meta | https://www.bing.com/webmasters/sitemaps?siteUrl=https://www.nsy.fr |
| Official registry (SIRENE) | https://annuaire-entreprises.data.gouv.fr/entreprise/842078453 |
| LinkedIn company | https://www.linkedin.com/company/nsy-new-software-yard |
| Editorial backlink | prv-concept.com → footer "Powered by NSY" |

The LinkedIn company page is referenced in the JSON-LD `sameAs` and in `llms.txt` / `llms-full.txt` — any new external registration must be added there too.

### Open Graph & Twitter Card

Every page carries a complete OG/Twitter block. Banner (`public/nsy-og.jpg`, **145 KB**, 1200×630) derived from the master `public/nsy-logo-ai.png`:

```bash
ffmpeg -i public/nsy-logo-ai.png \
  -vf "scale=-2:630,pad=1200:630:(1200-iw)/2:0:color=0x0A0F1C" \
  -q:v 4 public/nsy-og.jpg
```

→ scaled to 630 px height without distortion, then navy `#0A0F1C` padding out to 1200 px. No crop.

**Post-upload validation** : [opengraph.xyz](https://www.opengraph.xyz) · [Facebook Debugger](https://developers.facebook.com/tools/debug) · send yourself a WhatsApp/Slack message.

## Claude Code skills (`skills/`)

The repo versions several [Claude Code skills](https://docs.claude.com/en/docs/claude-code/skills) — **passive documentation** loaded by Claude when relevant (they execute nothing and don't change the site by themselves). They are **not deployed** (excluded from `deploy/`).

- **`skill-nsy-website`** — the project-specific "what": facts (founded 2018, pricing based on the need…), bilingual conventions, terminology (3D Design / Wireframe), chatbot constraints, 3D pipeline, deployment workflow. Saves re-stating these rules every session.
- **`frontend-responsive-perf`** — the reusable, framework-agnostic technical "how": mobile/tablet/desktop/landscape responsiveness, nav/widget alignment, CPU/GPU optimisations (off-screen pausing of videos/animations/3D, media recompression), lightweight LLM-free chatbot, and the headless-Chrome verification method.
- **`seo-geo-llmo`** — the reusable SEO + GEO/LLMO playbook (nsy.fr, prv-concept.com, client sites): AI-crawler allowlist, llms.txt, JSON-LD `@graph`, conversational FAQ, external registrations (Bing WT, GSC domain property, Google Business, backlinks) with the pitfalls lived through and the verification methods.
- **`frontend-design`** and **`video-to-website`** — the two creative skills used to design the site (distinctive design, scroll-animated site from a video). Historically in `.claude/skills/` (project skills); moved into `skills/` + symlink so they're available across all sessions.

**Activation** : Claude Code reads skills from `~/.claude/skills/`. Copy or link the folders (`cp -R skills/* ~/.claude/skills/` or `ln -s`). Details in [`skills/README.md`](skills/README.md).

## Credits

- **Design & development** : Cédric Barme — assisted by Claude (Anthropic)
- **Design system** : "Cyber Cabinet" direction
- **3D model** : 1992 Renault R25 Baccara, reworked in Blender into a wireframe
- **Videos** : generated with AI tools or shot personally

## Contact

- **Form** : [www.nsy.fr/contact-en.html](https://www.nsy.fr/contact-en.html) (reply within 48 business hours)
- **LinkedIn** : [linkedin.com/in/cédric-barme](https://www.linkedin.com/in/c%C3%A9dric-barme/)
- **GitHub** : [github.com/machouse78/nsy-website](https://github.com/machouse78/nsy-website)
- **Location** : France (engagements mostly remote)

---

© 2026 NSY · EURL · SIREN 842 078 453 · "Site built with AI — full transparency" mention in the footer.
