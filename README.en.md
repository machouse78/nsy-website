# NSY — Technical consulting & AI-powered web creation

[![Site](https://img.shields.io/badge/site-www.nsy.fr-00E5FF)](https://www.nsy.fr)
[![Hosting](https://img.shields.io/badge/hosting-Infomaniak-1AB7EA)](https://www.infomaniak.com)

[🇫🇷 Français](README.md) · 🇬🇧 **English**

**Multi-page bilingual (FR/EN)** website for **NSY** (*New Software Yard*), an independent French company founded by Cédric Barme in 2018. Dual positioning: senior technical consulting for finance / insurance, and AI-powered website creation for SMEs going through their digital transition.

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
| **Home** | `index.html` ↔ `index-en.html` | Landing: hero + marquee + **journal news** (→ Insights, animated thumbnail) + preview of the 2 offerings (→ Services) + profile teaser (→ About) + CTA banner (→ Contact) |
| **Insights** | `blog.html` ↔ `blog-en.html` (FR: « Journal ») | Field notes (bilingual articles, RSS feeds `feed.xml`/`feed-en.xml`); 5-latest-articles teaser on the home page (newest first); « Read on LinkedIn / Facebook » buttons at the end of articles |
| **Services** | `services.html` ↔ `services-en.html` | 2 detailed cards (consulting / AI web) + method (4 steps) + values + 3D preview (→ 3D Design) |
| **Work** | `realisations.html` ↔ `portfolio.html` | Client cards with **animated previews** (`record-realisation.mjs`), in chronological order: PRV Concept then Le Cerf Thym |
| **About** | `a-propos.html` ↔ `about.html` | Cédric Barme's profile, signals, background, **"Why NSY exists" story**, principles |
| **Why NSY?** | `pourquoi-nsy.html` ↔ `why-nsy.html` | The philosophy: single point of contact, direct-accountability model, ESN partnerships (large accounts), 3 clients max — FAQPage JSON-LD, linked from the footer and About |
| **Contact** | `contact.html` ↔ `contact-en.html` | Form (PHP) + direct channels + feasibility request |
| **3D Design** | `conception-3d.html` ↔ `3d-design.html` | Interactive Renault wireframe model + YouTube animation (3D demos) |

The contact form is still served by `contact.php` (unchanged). The top nav has **6 links** (Home, Insights, Services, Work, About, Contact); 3D Design and the FAQ are reachable from the footer.

Ancillary pages: **FAQ** `faq.html` / `faq-en.html`, **8 pairs of pillar pages** (expertise & offerings, GEO wave 2), **journal articles** (3: « SEO vs GEO », « Wiring an AI chatbot into a forum », « Building your website with AI in a weekend » — animated thumbnails), **2 city pages** (Paris consultant · Orléans website creation), **feasibility questionnaire** `faisabilite.html` / `feasibility.html`, legal pages — **50 pages** in total.

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
| `pourquoi-nsy.html` | `why-nsy.html` |
| `contact.html` | `contact-en.html` |
| `conception-3d.html` | `3d-design.html` |

- **Language switch** : 🇫🇷 / 🇬🇧 flags in the nav → set an `nsy_lang` cookie (1 year, `SameSite=Lax`) and redirect to the counterpart. Explicit slug mapping in `js/app.js`.
- **Auto-detection** : on `/` (no cookie), `.htaccess` reads `Accept-Language` and 302-redirects to `/index-en.html` if the browser is in English. The user's choice (cookie) then takes precedence.
- **Reciprocal hreflang** `fr` / `en` / `x-default` on all 50 pages, self-referencing canonicals.
- **`nsy_lang` cookie** : the only functional cookie, set on explicit action (flag click) — consent-exempt (CNIL deliberation 2020-091). Documented on the legal pages.

> ⚠️ **A language change applies to the WHOLE site, at every layer** — not just the visible text. Remember: the visible HTML (FR + EN), the **JS-injected UI strings** (form button states and toasts in `js/app.js`, driven by `pageLang`), the **server responses + the email** (`contact.php`, driven by the hidden `lang` field), the **hidden `lang` field on every form**, the meta/OG/JSON-LD, the legal pages, the sitemap and the chatbot. The contact form is bilingual end to end (front + server errors + auto-reply email).

## Interactive features

- **Private KPI dashboard** (`/stats/`, Basic Auth): human visitors (bots
  excluded), pageviews, **AI readings** (ChatGPT-User, OAI-SearchBot… — the GEO
  KPI), Facebook followers/engagement/public reshares, provenance (referrals +
  detailed referrer hosts), **visitor profiles** (devices/OS/browsers) and
  **journeys** (entry/exit pages, transitions, depth, duration), journal
  counters, a **dedicated AI-provenance section** (visits arriving from an
  assistant's answer, one curve per assistant, a dual-axis "bot readings →
  human visits" funnel, the pages the assistants actually cite, and how those
  visitors behave compared with the site average) — **ELK-like** time navigation (quick/absolute ranges,
  day/week/month buckets, prior-period comparison) + **filters** (clickable
  pills, query bar `bot:` `page:` `referral:` `ia:`, metric selector,
  split series). Collected daily at D-1 by `stats-collector.php` (Infomaniak
  scheduled task) from access logs and the Graph API, **unlimited** JSON history, **logs only** (never AWStats exports: bots
  included, broken scale), **no personal data**
  (aggregates only)
- **Journal view/like counters**: a discreet bar under each article's date
  (`journal-stats.php`, file storage in `_secret/`, no personal data — per-article
  aggregates only, one shared counter per FR/EN pair). View counted once per
  session, toggleable like (state in localStorage), hashed-IP daily cap,
  dedicated unit + HTTP tests.

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
- **Conversational AI assistant** — free Mistral LLM (EU) grounded in the site's content (RAG), API-less local fallback (see below)
- **Contact form** : service choice, start horizon, free-text message → handled by `contact.php` (real send + auto-reply)
- **Feasibility questionnaire** (`faisabilite.html` / `feasibility.html`) : a **7-step** wizard (~80 fields) in the site's theme, reachable from the Contact section. Submission mirrors the contact form → `faisabilite.php` (same SMTP / Turnstile / anti-bot, admin email + auto-reply in the same style). Labels live in the HTML (FR/EN); the JS serialises them into a structured payload rendered generically by PHP, so FR / EN / email never drift

### AI assistant — free LLM + RAG, local fallback

The assistant has an identity: **Ansley, NSY's AI architect** — an animated mascot (portrait FAB with halo + greeter bubble, animated avatar in the panel header, AI-generated boomerang loops). Glassmorphic panel, present on **all 50 pages** (partial `partials/chatbot.{fr,en}.html`). A two-tier architecture, **100% free**:

**Tier 1 — generative AI (`chat.php`)**: the widget queries a PHP proxy that
calls a **Mistral** LLM (free "Experiment" tier, French company, data processed
in the EU) through the OpenAI-compatible API.

- **Homemade RAG**: the proxy injects `llms-full.txt` (the knowledge base already maintained for GEO) as system context → the bot answers with the **site's real facts**, in **the visitor's language** (any language), and knows how to say "I don't know". One source of truth, zero duplication.
- **Guardrails**: never a price nor an email address, **strictly factual** (no invention — the FACTS only, otherwise redirect to contact), **never points outside nsy.fr** — with one exception (July 2026): NSY's **official links** are whitelisted (delivered client sites prv-concept.com and lecerfthym.fr, company LinkedIn + founder profile, GitHub, YouTube, and the official social publications of journal articles) and rendered clickable in a new tab; any OTHER external link stays neutralised. Systematic redirect to the contact form, polite refusal of off-topic, resistance to hijacking attempts. Enforcement is **server-side**, not just via the prompt (`chat.php`: non-whitelisted Markdown link → label only, bare URL removed, empty `()` purged, banned ESN-unfriendly phrasings rewritten, and any FR reply citing a journal article gets its LinkedIn/Facebook links appended deterministically — `$journalSocials`). When a delivered site is mentioned: its URL from the first mention + the AI-website-creation offer link at the end of the reply.
- **Free-quota protection**: API key server-side only (`_secret/ai.php`, gitignored), origin check, per-IP rate limiting (8/min, 60/day, hashed — no content logged) + global cap (1,500/day), retry on provider 429.
- **Conversation memory**: history in `sessionStorage`, the discussion **follows the visitor from page to page**; typewriter effect (disabled under `prefers-reduced-motion`); minimal **safe** Markdown rendering (full escaping, only `**bold**` and internal `page.html` links reintroduced).
- **Transparency**: "AI · Mistral" badge in the header, EU/sensitive-data note in the widget footer, dedicated GDPR section in the privacy pages.

**Tier 2 — local fallback (rules)**: the previous bilingual intent engine (16 topics, specificity-weighted scoring, reply variants, per-message language detection) stays embedded. No key configured, quota reached, API down or offline → it answers instantly, and the UI says so honestly ("Automated answers").

**Availability indicator**: the widget header reflects Mistral's real state — **green** "Online · Generative AI" when available, **orange** "AI unavailable · local replies" otherwise. Driven by a `chat.php` **health** endpoint (`POST {health:true}` → `{available}`, no generation): a 90 s server cache fed by real request outcomes + a free `GET /v1/models` probe on cache miss; client pings on panel open (3 min cache). A per-IP throttle does **not** flip the dot — only genuine unavailability does.

**Setup** (once): create a free key on [console.mistral.ai](https://console.mistral.ai) (Experiment plan), copy `_secret/ai.php.example` → `_secret/ai.php` on the server and paste the key. Without this file, the bot runs in rules mode.

### Contact form — PHP backend

`contact.php` (shares `antispam.php` with `faisabilite.php`) :
1. Verifies the **Cloudflare Turnstile token** (anti-bot) server-side
2. **Honeypot** anti-spam (hidden field only bots fill in)
3. **Content anti-spam** (`antispam.php`): heuristic score (URLs, shorteners like `telegra.ph`/`t.me`, crypto/casino/backlink keywords, `$…` amounts, shouty ALL-CAPS). Above the threshold → **silent drop** (fake `{ ok: true }`, no email) + a trace in `_secret/spam.log` (403 over HTTP, readable over FTP) to catch a false positive. Plus a **per-IP daily cap** (5/day) on top of the **1 send / IP / 60 s** throttle
4. Sends the message to the NSY inbox via **PHPMailer + Infomaniak SMTP** (internal notification in FR). The address appears **nowhere on the public site nor in this README** (anti-scraping): visitors go through the form, the auto-reply carries an internal `Reply-To`
5. Sends an **HTML auto-reply** to the prospect, **localised FR/EN** based on the hidden `lang` field (subject, HTML body, text version, `<html lang>`, service label)
6. Responds in JSON (`{ ok: true }` or `{ ok: false, error }`) → front-end toast

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
- **Animated portrait (About)** (`nsy-about.mp4`) : Cédric's portrait brought to life — moving holographic tech background, subject held still — AI-generated (Higgsfield, Kling image-to-video from the photo, first 4K-upscaled then padded to 16:9). **960×720 (4:3), silent, ~0.32 MB**, **seamless loop** (end→start crossfade baked into the file). The profile card uses a `<video id="about-video">` (poster = `photo-profil.jpg`) instead of an `<img>`; excluded from the JS loop-fade (already seamless) but subject to the off-screen pause.
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
├── pourquoi-nsy.html / why-nsy.html     # Why NSY?: the philosophy (single contact, ESN partnerships) FR / EN
├── contact.html / contact-en.html       # Contact: PHP form + direct channels FR / EN
├── conception-3d.html / 3d-design.html  # 3D Design: wireframe model + YouTube animation FR / EN
├── mentions-legales.html / legal-notice.html
├── confidentialite.html / privacy.html
├── faisabilite.html / feasibility.html  # Feasibility questionnaire (7-step wizard) FR / EN
├── realisations.html / portfolio.html   # Client work (animated previews)
├── blog.html / blog-en.html             # Journal / Insights: article index FR / EN
├── seo-geo-etre-cite-par-les-ia.html    # 1st article: SEO vs GEO (EN: seo-geo-getting-cited-by-ai.html)
├── consultant-technique-paris.html      # City page: Paris (EN: technical-consultant-paris.html)
├── creation-site-internet-orleans.html  # City page: Orléans (EN: website-creation-orleans.html)
├── feed.xml / feed-en.xml               # Journal RSS feeds
├── faq.html / faq-en.html               # GEO/LLMO FAQ: 52 bilingual Q&As + FAQPage JSON-LD
├── (8 pairs of GEO pillar pages)        # One expertise per URL, FR ↔ EN (see slug table):
│                                        #   expertise-migration-java-ee, expertise-wildfly-jboss,
│                                        #   expertise-openshift-kubernetes, expertise-kafka-messagerie,
│                                        #   conformite-dora, integration-claude-entreprise,
│                                        #   creation-site-ia, glossaire-ia-web
├── llms.txt / llms-full.txt             # Structured context for AI (llmstxt.org spec)
├── SEO-GEO-LLMO.md                      # Internal SEO/GEO strategy (not deployed)
├── reseaux/                             # Not deployed: groupes.md (group registry for sharing) and
│                                        # ⚠️ fiches-annuaires.md holds the SYNC MATRIX: one identity
│                                        # fact (name, town, phone, hours, URL, description) lives on the
│                                        # site AND on every listing — a change must propagate across
│                                        # its whole row
│                                        # fiches-annuaires.md (canonical NAP + exact copy for Google
│                                        # Business Profile, Bing Places, directories — local AI visibility)
├── contact.php                          # Contact form backend (PHPMailer + Turnstile)
├── faisabilite.php                      # Questionnaire backend (same pipeline as contact.php)
├── chat.php                             # Assistant AI proxy (Mistral LLM + RAG on llms-full.txt)
├── antispam.php                         # Shared anti-spam filter (contact + feasibility)
├── stats-collector.php                  # Daily KPI collector (ik-logs + FB Graph API + counters) → _secret/kpi-history.json
├── stats/                               # Private KPI dashboard (Basic Auth) — cards, SVG charts, tables (index.html + data.php)
├── journal-stats.php                    # Journal view/like counters (file storage in _secret/)
├── css/style.css                        # Complete styles (includes the .qz- questionnaire namespace)
├── js/app.js                            # Chatbot, i18n, video swaps, scroll-spy, 3D framing
├── js/faisabilite.js                    # Questionnaire wizard (navigation + collection + send)
├── partials/                            # ⭐ Single source of the nav + footer + assistant widget (FR/EN)
│   ├── nav.fr.html / nav.en.html        #    Top menu ({{P}} token = anchor base path)
│   └── footer.fr.html / footer.en.html  #    Footer
├── scripts/                             # Build tooling (3D + partials sync)
│   ├── sync-partials.mjs                # ⭐ Injects nav/footer/chatbot into all 50 pages (npm run partials)
│   ├── record-realisation.mjs           # Animated Work preview (real-time screencast + encode)
│   ├── indexnow-ping.mjs                # IndexNow ping after deploys
│   ├── partage-page.py                  # ⭐ Builds /stats/partage.html — every article × group registry
│   ├── utm.mjs                          # One-off UTM-tagged links — know which post/group drives traffic
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
│   ├── photo-profil.jpg                 # Cédric's portrait, AI retina upscale (About) + video poster
│   ├── finance-assurance.{png,mp4}      # Service 01
│   ├── web-ia.{png,mp4}                 # Service 02
│   ├── nsy-hero.mp4                     # Hero video (NSY monogram, large circle)
│   ├── nsy-about.mp4                    # Animated About portrait (tech bg, seamless loop)
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

## Unit tests (chatbot)

`./tests/run-tests.sh` — lint + suites on the **real code** (incl. the journal
counters endpoint, HTTP-tested in a `php -S` sandbox): `nsy_sanitize_reply()`
from `chat.php` (official-links whitelist, FR/EN linkmap, `()` purge, cap,
banned-phrasing rewrite — ESN positioning —, deterministic append of article
social links) via Docker PHP, and `mdToHtml` from `js/app.js` (clickable
whitelisted links, XSS escaping) via Node. **Run before any commit touching `chat.php`, `js/app.js`, `contact.php`,
`faisabilite.php`, `antispam.php` or `journal-stats.php`.**

## Test locally

```bash
# Static server (Python preinstalled on macOS)
python3 -m http.server 8080
open http://localhost:8080
```

> The static server is enough for everything **except PHP** (`contact.php` needs PHP + SMTP access; `chat.php` needs PHP + the `_secret/ai.php` key — testable in production or with `php -S`). The 3D works locally; the AI assistant automatically switches to its **local rules mode** (its offline fallback). Cloudflare Turnstile shows a benign error on `localhost`.

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

Deployment is **on demand** via **`./deploy.sh`**: the script rebuilds `deploy/`
then uploads its contents over **FTPS** through
[`scripts/ftp-deploy.py`](scripts/ftp-deploy.py), with **no remote deletion**
(never touches `_secret/config.php` on the server). One command, nothing ships
until you run it.

```bash
./deploy.sh
```

- **Credentials**: in `_secret/ftp.env` (gitignored, like `_secret/config.php`;
  template: `_secret/ftp.env.example`). The password never appears in the process
  list.
- **`FTP_DIR=""`** (empty): the dedicated NSY FTP account **already lands on the
  web root** served by the domain. Only set a subfolder if your account lands one
  level above the docroot (otherwise you create a nested `web/` the site doesn't
  serve).
- **A single persistent FTPS connection** for every file: one `curl` per file
  opened ~63 rapid connections → Infomaniak returns **450 (anti-flood)**.
  `scripts/ftp-deploy.py` fixes this (sequential STOR + retry).
- **Exclusions**: `_secret/`, mirrors (`old-wp/`…), `.DS_Store`. `_secret/config.php`
  (SMTP, gitignored) is uploaded **once by hand** on first setup; deployment
  leaves it alone afterwards.

> A manual GitHub Actions workflow ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
> `workflow_dispatch`) also exists as a fallback, but `./deploy.sh` is the chosen path.

## SEO, GEO & social sharing

- **Sitemap** : 50 pages (real URLs, no more `#` anchors) + key images + videos (heroes, services, work previews, journal illustration), with `xhtml:link` hreflang
- **Reciprocal hreflang** `fr` / `en` / `x-default` on all 50 pages
- **Consistent canonical** : everything points to `https://www.nsy.fr/` (uniform trailing slash), reinforced by the `.htaccess` redirect
- **JSON-LD `@graph`** (FR/EN home pages) : Organization + ProfessionalService + LocalBusiness (region only) + Person (Cédric Barme, `knowsAbout`) + WebSite + 2 Service/Offer — nodes linked by `@id`, sameAs LinkedIn company + founder / GitHub / YouTube
- **Structured-data compliance** (3 Search Console alerts resolved in Aug 2026): every **required** field of a rich-result type carries the **inlined typed node** (same `@id`) — `ProfilePage.mainEntity`, but also `author` and `publisher` on articles, dates (`dateModified`, `datePublished`) are **full ISO 8601 with timezone**, and every `<video>` has a `poster=` plus its `video:video` block under **every** page that displays it. Causes, fixes and audit method: `seo-geo-llmo` skill §5
- **Robots.txt** : explicit Allow of the media in use, Disallow of `.glb`/`.gltf`
- **Journal RSS feeds** : `feed.xml` (FR) / `feed-en.xml` (EN) — updated with every article
- **IndexNow** : key at the root + `node scripts/indexnow-ping.mjs` after each deployment (near-instant indexing on Bing → ChatGPT Search/Copilot)

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

### Social distribution of journal articles

Every journal article follows the same publication cycle — covered end to end in the dedicated skill [`skills/journal-nsy/SKILL.md`](skills/journal-nsy/SKILL.md):

1. **Publish the article** (full checklist in the skill: FR/EN pair, blog cards, home teaser, RSS, sitemap, llms, IndexNow).
2. **Publish the two posts**: a **professional article on the NSY LinkedIn page** + a **general-public Facebook** version — two distinct rewrites (no prices, ESN-friendly wording, CTA to the offer). **Backlinks to nsy.fr go in the FIRST COMMENT of each post, never in the body** — the algorithms deprioritise posts with external links; the first comment preserves both reach and backlink. The Facebook side is **automated and VIDEO-first**: `node scripts/meta-publish.mjs post … --video-url … --go` publishes the article's animated video **in its original format** (never recomposed — Meta classifies it as a Reel) then the first comment via the Graph API (`--image-url` as a photo fallback; page token in `_secret/meta.env`, dry-run by default, media approved by the owner before any `--go`, guard rails: refuses a link in the body, refuses a comment without the backlink). LinkedIn stays a manual paste (no API for articles).
3. **Archive the post URLs** in [`SEO-GEO-LLMO.md`](SEO-GEO-LLMO.md) §6 (trust signals — GEO cross-referencing of the NSY entity).
4. **Add the « Read on LinkedIn / Facebook » buttons** at the end of the FR article (template: `seo-geo-etre-cite-par-les-ia.html`), then redeploy. The EN article only gets buttons if EN posts exist.
5. **Wire Ansley**: publication URLs in `llms-full.txt` (« Journal » block), 3-layer whitelist (`chat.php` + `js/app.js`, lowercase prefixes), the slug→URLs pair in `chat.php`'s `$journalSocials` map (deterministic append) and cases in both test suites.

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
- **`journal-nsy`** — the full lifecycle of a journal article (single source of truth): the nsy.fr publication checklist, the Facebook/LinkedIn social deliverables with the **first-comment backlink rule**, return backlinks on the article, the Ansley wiring (`$journalSocials`) and the automation (Facebook **automated** via `scripts/meta-publish.mjs` + Graph API, LinkedIn manual — no API for articles).
- **`frontend-responsive-perf`** — the reusable, framework-agnostic technical "how": mobile/tablet/desktop/landscape responsiveness, nav/widget alignment, CPU/GPU optimisations (off-screen pausing of videos/animations/3D, media recompression), lightweight LLM-free chatbot, and the headless-Chrome verification method.
- **`seo-geo-llmo`** — the reusable SEO + GEO/LLMO playbook (nsy.fr, prv-concept.com, client sites): AI-crawler allowlist, llms.txt, JSON-LD `@graph`, conversational FAQ, external registrations (Bing WT, GSC domain property, Google Business, backlinks) with the pitfalls lived through and the verification methods.
- **`site-kpi`** — the reusable daily KPI pipeline (log collector + Graph API, unlimited history, private ELK-like dashboard) — implemented on nsy.fr, portable to prv-concept.com and client sites.
- **`antispam`** — reusable anti-spam defense for web forms: defense in depth (honeypot, Turnstile, content scoring, rate-limit + daily cap, silent-drop + audit log) with a drop-in PHP `antispam.php` module. Extracted from nsy.fr's `antispam.php`, reusable on prv-concept.com and client sites.
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

© 2026 NSY · SIREN 842 078 453 · "Site built with AI — full transparency" mention in the footer.
