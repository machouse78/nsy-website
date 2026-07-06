# NSY — Cabinet de conseil technique & création web propulsée par l'IA

[![Site](https://img.shields.io/badge/site-www.nsy.fr-00E5FF)](https://www.nsy.fr)
[![Hébergement](https://img.shields.io/badge/h%C3%A9bergement-Infomaniak-1AB7EA)](https://www.infomaniak.com)

Site one-page **bilingue (FR/EN)** pour **NSY**, EURL fondée par Cédric Barme en 2018. Positionnement double : missions techniques senior pour la finance / assurance, et création de sites web propulsés par l'IA pour les PME/ETI en transition.

## Direction artistique

Design **"Cyber Cabinet"** — palette navy profond + cyan électrique + accent orange du logo. Typographie : Space Grotesk (display) + Manrope (corps) + JetBrains Mono (annotations).

| Couleur | Hex | Usage |
|---|---|---|
| `--bg-1` | `#0A0F1C` | Fond principal |
| `--accent` | `#00E5FF` | Cyan électrique — CTA, liens actifs, glow, wireframe 3D |
| `--warm` | `#F08A2C` | Orange du logo — points d'accent rares |
| `--fg-0` / `--fg-1` / `--fg-2` | `#F2F6FF` → `#8993AF` | Échelle de gris-bleu du texte |

## Stack

- **Front** : HTML5 + CSS3 + JavaScript vanilla — zéro framework, zéro bundler
- **Back (formulaire)** : PHP + [PHPMailer](https://github.com/PHPMailer/PHPMailer) sur SMTP Infomaniak, anti-bot [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/)
- **3D temps réel** : [`<model-viewer>`](https://modelviewer.dev/) 4.2.0 (Three.js sous le capot) pour le wireframe interactif
- **Pipeline 3D (build-time)** : Blender 4.x headless + [glTF-Transform](https://gltf-transform.dev/) + Draco — voir [§ Pipeline wireframe](#pipeline-wireframe-3d)
- **Google Fonts** : Space Grotesk, Manrope, JetBrains Mono
- **CSS custom properties** + `@property` pour les transitions interpolables (CTA banner gradient)

## Structure du site

Page unique (FR `index.html` / EN `index-en.html`) avec ancres :

| Section | id | Contenu |
|---|---|---|
| Hero | `top` | Headline + CTA + sphère vidéo `nsy-ia.mp4` + terminaux ASCII flottants |
| Marquee | — | Bandeau défilant des domaines couverts |
| Capabilities | — | 2 cards : Conseil senior / Création web IA |
| Process | — | 4 étapes : Discovery → Design → Build → Handover |
| Trust strip | — | 3 valeurs : Indépendance / Confidentialité / Engagement |
| Services | `services` | 2 cards détaillées avec swap image ↔ vidéo au survol. La card Web·IA renvoie vers la page **Réalisations** (bouton « Voir nos réalisations ») |
| About | `about` | Profil Cédric Barme, signaux clés, parcours, principes |
| **Conception 3D** | `creations` | **Section 3D** : vidéo YouTube (chaîne NSY) + modèle wireframe interactif — 2 colonnes desktop, empilé mobile |
| Contact | `contact` | Formulaire (PHP) avec choix de service + canaux directs + mentions légales |
| CTA banner | — | Bandeau « Disponible maintenant » avec spotlight souris suivant |
| Footer | — | Navigation + expertise + contact + réseaux sociaux |

Pages annexes : `mentions-legales.html` / `legal-notice.html` (EN), `confidentialite.html` / `privacy.html` (EN), le **questionnaire de faisabilité** `faisabilite.html` / `feasibility.html` (EN, depuis la section Contact) et les **Réalisations** `realisations.html` / `portfolio.html` (EN, portfolio des sites clients — 1ʳᵉ réalisation : PRV Concept). Les vignettes des réalisations sont **capturées automatiquement** depuis les sites live (`npm run capture:realisations` → JPEG à la taille d'affichage, ~110 Ko) — à relancer avant un déploiement pour les rafraîchir ; les visiteurs ne reçoivent qu'une image statique (zéro iframe, zéro coût runtime).

## Bilingue (FR / EN)

Une page HTML par langue (pas de build, SEO propre), avec slugs **réellement traduits** :

| FR | EN |
|---|---|
| `index.html` (`/`) | `index-en.html` |
| `mentions-legales.html` | `legal-notice.html` |
| `confidentialite.html` | `privacy.html` |
| `realisations.html` | `portfolio.html` |
| `faisabilite.html` | `feasibility.html` |
| `faq.html` | `faq-en.html` |

- **Switch de langue** : drapeaux 🇫🇷 / 🇬🇧 dans la nav → pose un cookie `nsy_lang` (1 an, `SameSite=Lax`) et redirige vers la variante. Mapping de slugs explicite dans `js/app.js`.
- **Auto-détection** : sur `/` (sans cookie), `.htaccess` lit `Accept-Language` et redirige en 302 vers `/index-en.html` si le navigateur est en anglais. Le choix utilisateur (cookie) prime ensuite.
- **hreflang réciproque** `fr` / `en` / `x-default` sur les 12 pages, canoniques auto-référencées.
- **Cookie `nsy_lang`** : unique cookie fonctionnel, posé sur action explicite (clic drapeau) — exempté de consentement (délibération CNIL 2020-091). Documenté dans les pages légales.

> ⚠️ **Une modif de langue s'applique à TOUT le site, à chaque couche** — pas seulement le texte visible. Penser à : le HTML visible (FR + EN), les **chaînes d'UI injectées en JS** (états du bouton et toasts du formulaire dans `js/app.js`, pilotés par `pageLang`), les **réponses serveur + l'email** (`contact.php`, pilotés par le champ caché `lang`), le **champ caché `lang` de chaque formulaire**, le meta/OG/JSON-LD, les pages légales, le sitemap et le chatbot. Le formulaire de contact est bilingue de bout en bout (front + erreurs serveur + email d'auto-réponse).

## Fonctionnalités interactives

- **Année & expérience dynamiques** : `data-current-year`, `data-years`, `data-years-fr` injectés en JS (basé sur `2026 - 14 = 2012` comme année de début de carrière)
- **Nav ancrée** (`position: sticky`) + **jauge de lecture** cyan sous le menu (scaleX composité). Piège résolu : `overflow-x: hidden` sur `html/body` désactivait silencieusement le sticky → remplacé par `overflow-x: clip` (même correctif que prv-concept.com), avec `scroll-padding-top` pour que les ancres atterrissent sous le menu
- **Scroll-spy nav** via `IntersectionObserver` — la rubrique active passe en cyan
- **Animations & micro-interactions** (UX pass) : entrée hero échelonnée, reveal au scroll avec stagger par conteneur, **compteurs animés** au scroll-in (14+, 3 max…), **parallaxe souris** sur le visuel hero (5 plans de profondeur, lerp amorti, desktop uniquement), sheen sur le CTA principal, hovers étapes/chips/flèches, soulignés animés du footer, marquee en pause au survol — le tout **uniquement en `transform`/`opacity`**, rAF auto-stoppés au repos, et **`prefers-reduced-motion` intégral**
- **Sphère hero** : vidéo `nsy-ia.mp4` en `object-fit: cover`, masquée en cercle, terminaux ASCII flottants
- **Cards services** : au survol, l'image PNG cross-fade vers une vidéo MP4 ; retour à `currentTime = 0` au mouseleave
- **CTA banner "Prochain créneau"** : 2 dégradés radiaux (cyan + orange) qui suivent la souris via `--mx` / `--my`, retour en douceur (550 ms) grâce à `@property`
- **Section 3D `#creations`** :
  - **Vidéo YouTube** de la chaîne NSY, intégrée via `youtube-nocookie.com` (aucun cookie avant lecture)
  - **Modèle wireframe interactif** d'une Renault R25 Baccara 1992 (`<model-viewer>`) — rendu filaire cyan néon, rotation auto + drag souris/tactile ; **supersampling ×2 sur écrans non-Retina** (lignes lisses en DPR 1) et pastille « Faites pivoter » auto-masquée après la première manipulation
  - Disposition **2 colonnes** sur desktop (vidéo agrandie à gauche, wireframe à droite), **empilée** sur mobile (≤ 920 px)
- **Chatbot intelligent** (voir ci-dessous)
- **Formulaire contact** : choix du service, horizon de démarrage, message libre → traité par `contact.php` (envoi réel + auto-réponse)
- **Questionnaire de faisabilité** (`faisabilite.html` / `feasibility.html`) : wizard **7 étapes** (~80 champs) au thème du site, accessible depuis la section Contact. Soumission identique au formulaire de contact → `faisabilite.php` (mêmes SMTP / Turnstile / anti-bot, email admin + auto-réponse au même style). Les libellés vivent dans le HTML (FR/EN) ; le JS les sérialise en un payload structuré rendu génériquement par le PHP, donc FR / EN / email ne divergent jamais

### Chatbot — moteur de règles bilingue

FAB cyan en bas-droite, panneau glassmorphic. **Pas de LLM ni d'API** (volontaire : gratuit, instantané, sans clé, fonctionne hors-ligne) — un moteur d'intentions soigné :

- **Normalisation** de l'entrée : minuscules + suppression des accents + ponctuation (« coût », « cout », « Combien ? » → même intention)
- **Scoring pondéré par spécificité** : chaque intention est notée par la longueur cumulée de ses mots-clés trouvés (les expressions multi-mots l'emportent), correspondance par racine (tarif→tarifs)
- **~16 sujets** : tarifs, disponibilité, web/IA, finance & assurance, 3D, services, parcours de Cédric, stack technique, déroulé d'une mission, localisation, références (NDA), données/RGPD, pourquoi NSY, contact — plus politesses (bonjour / merci / au revoir)
- **2 variantes de réponse** par sujet, tirées au hasard → pas de répétition
- **Détection de langue par message** : répond en FR ou EN selon la langue de la question (pas seulement celle de la page) ; égalité → langue de la page
- **Suivi léger** : « et ? », « plus de détails », « tell me more » rouvre le sujet précédent ; **fallback** qui liste ce que le bot sait faire

### Formulaire contact — backend PHP

`contact.php` :
1. Vérifie le **token Cloudflare Turnstile** (anti-bot) côté serveur
2. **Honeypot** anti-spam (champ caché que seuls les bots remplissent)
3. Envoie le message à la boîte NSY via **PHPMailer + SMTP Infomaniak** (notification interne en FR). L'adresse n'apparaît **nulle part sur le site public ni dans ce README** (anti-scraping) : les visiteurs passent par le formulaire, l'auto-réponse porte un `Reply-To` interne
4. Envoie une **auto-réponse HTML** au prospect, **localisée FR/EN** selon le champ caché `lang` (objet, corps HTML, version texte, `<html lang>`, libellé du service)
5. Répond en JSON (`{ ok: true }` ou `{ ok: false, error }`) → toast côté front

**Bilingue de bout en bout** : tous les messages d'erreur JSON renvoyés au front (via un helper `$L(fr, en)`) **et** l'email d'auto-réponse suivent la langue du visiteur (champ caché `lang`). Côté navigateur, les états du bouton (`Envoi…/Sending…`, `Envoyé ✓/Sent ✓`, `Réessayer/Retry`) et les toasts sont pilotés par `pageLang` dans `js/app.js`.

Les identifiants SMTP vivent dans `_secret/config.php` (gitignored). Modèle fourni : `_secret/config.php.example`.

## Pipeline wireframe 3D

Le modèle `public/renault-wireframe.glb` (**660 Ko**, rendu filaire cyan néon) est généré depuis un `.blend` source via une chaîne reproductible (`scripts/`) :

```bash
./scripts/build-wireframe.sh
```

1. **Blender headless** (`process-renault.py`) : purge le décor, joint les 163 maillages, recentre + normalise l'échelle (bbox ~2 unités centrée sur l'origine), décime agressivement (~15 k triangles), applique un matériau cyan émissif `#00E5FF`, exporte en GLB **TRIANGLES**.
2. **Post-traitement Node** (`tris-to-lines.mjs`) : convertit les indices triangles → arêtes uniques dédoublonnées et bascule la primitive en **`GL_LINES`** → vrai filaire 1 pixel (et non des tubes 3D qui fusionnent en blob).

Outils de vérification (j'ai appris à ne rien pousser sans regarder le rendu) :
- `render-comparison.py` — rend un `.blend` ou un `.glb` via Cycles
- `screenshot-glb.mjs` — charge le GLB dans un Chrome headless + `<model-viewer>` (rendu identique au navigateur)
- `diagnose-renault.py` — rend le `.blend` brut sous plusieurs angles

**Prérequis** : Blender 4.x (`/Applications/Blender.app` sur macOS) + `npm install` (devDeps : `@gltf-transform/*`, `draco3dgltf`, `puppeteer`). Le `.blend` source est gitignored (trop lourd) — seul le `.glb` optimisé est livré.

## Performance & éco-ressources

Un site « cyber » avec vidéos, 3D temps réel et animations peut vite faire chauffer le CPU/GPU. Tout ce qui tourne en boucle est mis en pause dès que ce n'est pas visible — principe : **on ne décode / n'anime / ne rend que ce que l'utilisateur regarde**.

- **Vidéos** : une `<video loop>` re-décode chaque image en continu (aucun « cache de frames décodées »). Un `IntersectionObserver` (`js/app.js`) met chaque vidéo en boucle **en pause quand elle quitte l'écran** et la relance à son retour ; un écouteur `visibilitychange` met **tout en pause quand l'onglet est masqué**. Au chargement, seules les vidéos visibles décodent.
- **Vidéo hero** (`nsy-ia.mp4`) : recompressée du **1080p (4.8 Mo)** vers un **crop carré 720×720 (1.7 Mo)** — elle s'affiche dans une sphère de ~300px masquée en cercle, donc le 1080p et les bords 16:9 étaient inutiles. Décodage divisé par ~4.
- **Animations CSS** : la classe `.anim-paused`, posée sur une section via `IntersectionObserver` quand elle sort du champ, fige toutes ses animations (`animation-play-state: paused`, pseudo-éléments compris) ; retirée quand la section revient.
- **Modèle 3D** : `<model-viewer>` met déjà en pause le rendu WebGL hors écran ; on coupe en plus l'`auto-rotate` quand la section Conception 3D n'est pas visible. Le supersampling ×2 (netteté) ne s'applique qu'aux écrans DPR 1 et ne coûte donc rien sur mobile/Retina.
- **Animations JS** (parallaxe hero, compteurs, jauge de lecture) : boucles `requestAnimationFrame` qui **s'arrêtent d'elles-mêmes au repos** (lerp convergé, compteur fini) — aucune boucle infinie ; tout est coupé par `prefers-reduced-motion`.
- **Cache** : `.htaccess` pose `Cache-Control: max-age` (1 mois médias) — évite le **re-téléchargement** (mais pas le re-décodage, d'où la mise en pause ci-dessus).

Effet mesuré : le décodage vidéo en régime permanent au chargement passe d'environ **94 → 12 M pixels/s** (≈ −87 %), et les sections hors écran ne repeignent plus rien.

## Structure du repo

```
nsy-website/
├── index.html / index-en.html          # Page principale FR / EN
├── mentions-legales.html / legal-notice.html
├── confidentialite.html / privacy.html
├── faisabilite.html / feasibility.html  # Questionnaire de faisabilité (wizard 7 étapes) FR / EN
├── faq.html / faq-en.html               # FAQ GEO/LLMO : 52 Q/R bilingues + FAQPage JSON-LD
├── llms.txt / llms-full.txt             # Contexte structuré pour les IA (spec llmstxt.org)
├── SEO-GEO-LLMO.md                      # Stratégie SEO/GEO interne (non déployé)
├── contact.php                          # Backend formulaire contact (PHPMailer + Turnstile)
├── faisabilite.php                      # Backend questionnaire (même pipeline que contact.php)
├── css/style.css                        # Styles complets (inclut le namespace .qz- du questionnaire)
├── js/app.js                            # Chatbot, i18n, swaps vidéo, scroll-spy, 3D framing
├── js/faisabilite.js                    # Wizard du questionnaire (navigation + collecte + envoi)
├── partials/                            # ⭐ Source unique de la nav + du footer (FR/EN)
│   ├── nav.fr.html / nav.en.html        #    Menu du haut (token {{P}} = base des ancres)
│   └── footer.fr.html / footer.en.html  #    Pied de page
├── scripts/                             # Outillage build (3D + synchro partials)
│   ├── sync-partials.mjs                # ⭐ Injecte nav/footer dans les 12 pages (npm run partials)
│   ├── capture-realisation.mjs          # Vignette Réalisations auto (npm run capture:realisations)
│   ├── build-wireframe.sh               # Orchestrateur Blender → GL_LINES
│   ├── process-renault.py               # Blender headless : décimation, matériau, export
│   ├── tris-to-lines.mjs                # Triangles → GL_LINES
│   ├── render-comparison.py             # Rendu Cycles (.blend ou .glb)
│   ├── screenshot-glb.mjs               # Capture via model-viewer headless
│   └── diagnose-renault.py              # Rendu multi-angles du .blend brut
├── vendor/PHPMailer/                     # Lib d'envoi mail (src/ uniquement)
├── _secret/                             # Identifiants SMTP (config.php gitignored)
│   ├── config.php.example
│   └── .htaccess                        # Deny all
├── public/                              # Assets servis publiquement
│   ├── nsy-logo.png + cropped-NSY-logo-*.png (favicons)
│   ├── photo-profil.png                 # Photo Cédric (About)
│   ├── finance-assurance.{png,mp4}      # Service 01
│   ├── web-ia.{png,mp4}                 # Service 02
│   ├── nsy-ia.mp4                       # Sphère hero
│   ├── nsy-og.jpg                       # Bannière Open Graph 1200×630
│   └── renault-wireframe.glb            # Modèle 3D wireframe (660 Ko)
├── package.json                         # Build tooling 3D uniquement (devDependencies)
├── skills/                              # Skills Claude Code (doc, NON déployés) — voir § dédié
│   ├── skill-nsy-website/               #   conventions & faits du projet
│   └── frontend-responsive-perf/        #   techniques responsive/perf réutilisables
├── sitemap.xml / robots.txt
├── .htaccess                            # Apache : redirections, GZIP, cache, i18n, anti-hotlink
├── prepare-deploy.sh                    # Build du dossier deploy/
├── deploy/                              # Généré (~16 Mo), à uploader dans public_html/
├── DEPLOIEMENT-INFOMANIAK.md            # Guide hébergement
└── README.md                            # Ce fichier
```

## Tester en local

```bash
# Serveur statique (Python préinstallé sur macOS)
python3 -m http.server 8080
open http://localhost:8080
```

> Le serveur statique suffit pour tout **sauf le formulaire** (`contact.php` nécessite PHP + accès SMTP, donc testable seulement en prod ou avec `php -S`). La 3D et le chatbot fonctionnent en local. Cloudflare Turnstile affiche une erreur bénigne sur `localhost`.

## Préparer un déploiement

```bash
./prepare-deploy.sh
```

Le script reconstruit `deploy/` à zéro, copie **uniquement les assets utilisés** (pages FR+EN, `contact.php`, `vendor/`, `_secret/`, CSS/JS, médias, `renault-wireframe.glb`), vérifie la présence des fichiers requis et les références dans `index.html`, affiche les tailles, et sort en code 1 si quelque chose manque (utilisable en CI). Bundle final ≈ **16 Mo**.

## Déployer sur Infomaniak

1. Lancer `./prepare-deploy.sh`
2. S'assurer que `_secret/config.php` existe (identifiants SMTP) — sinon le formulaire ne marchera pas
3. Uploader le **contenu** de `deploy/` (pas le dossier) dans `public_html/` via FTP / SFTP
4. **Important** : activer l'affichage des fichiers cachés pour transférer `.htaccess` et `_secret/`
5. Tester `https://www.nsy.fr` — SSL automatique via Let's Encrypt
6. Vérifier la redirection canonique : `http://nsy.fr` et `https://nsy.fr` doivent rediriger vers `https://www.nsy.fr`
7. Soumettre le sitemap sur [Google Search Console](https://search.google.com/search-console)

Le `.htaccess` configure :
- **Redirection canonique** unique vers `https://www.nsy.fr` (http→https **et** non-www→www, un seul 301)
- **Redirections 301** des anciennes URLs (slugs obsolètes → section `#creations` / nouveaux slugs)
- **Auto-détection de langue** (`Accept-Language`) sur la racine
- **Anti-hotlink** sur les médias propriétaires (`mp4`, `glb`…) via contrôle du Referer
- **GZIP**, **cache** (1 mois médias, 1 semaine CSS/JS, 1h HTML), **security headers** (`X-Frame-Options`, `Strict-Transport-Security`…)

## SEO, GEO & partage social

- **Sitemap** : 12 pages + ancres + images clés + vidéos, avec `xhtml:link` hreflang
- **hreflang réciproque** `fr` / `en` / `x-default` sur les 12 pages
- **Canonique cohérente** : tout pointe vers `https://www.nsy.fr/` (slash final uniforme), renforcée par la redirection `.htaccess`
- **JSON-LD `@graph`** (accueils FR/EN) : Organization + ProfessionalService + LocalBusiness (région seule) + Person (Cédric Barme, `knowsAbout`) + WebSite + 2 Service/Offer — nœuds reliés par `@id`, sameAs LinkedIn entreprise + fondateur / GitHub / YouTube
- **Robots.txt** : Allow explicite des médias utilisés, Disallow des `.glb`/`.gltf`

### GEO / LLMO (référencement dans les moteurs génératifs)

Objectif : être compris et **cité** par ChatGPT, Claude, Gemini, Perplexity, Copilot…

- **18 crawlers IA explicitement autorisés** dans `robots.txt` (GPTBot, OAI-SearchBot, ClaudeBot, Claude-SearchBot, Google-Extended, PerplexityBot, CCBot, Amazonbot, meta-externalagent, MistralAI-User…)
- **`llms.txt` / `llms-full.txt`** : identité, expertises, offres, graphe d'entités et règles de recommandation, au format lisible par les LLM — à tenir en phase avec les faits du site (même règle que le chatbot)
- **FAQ bilingue 52 Q/R** (`faq.html` / `faq-en.html`) ciblant les requêtes conversationnelles (« Qui est expert WildFly en France ? », « Qui peut intégrer Claude ? »…) ; le `FAQPage` JSON-LD est **généré depuis le DOM** (source unique = HTML visible)
- **Dates absolues** dans le texte statique (« depuis 2012 », « fondée en 2018 ») — jamais périmé
- Stratégie complète, pages à créer et actions externes : [`SEO-GEO-LLMO.md`](SEO-GEO-LLMO.md)

### Inscriptions & entités externes

| Service | Accès / référence |
|---|---|
| Google Search Console — **propriété de domaine** (vérifiée par TXT DNS chez Infomaniak, l'enregistrement doit rester en place) | https://search.google.com/search-console?resource_id=sc-domain:nsy.fr |
| Bing Webmaster Tools (alimente ChatGPT Search & Copilot) — vérifié par meta `msvalidate.01` | https://www.bing.com/webmasters/sitemaps?siteUrl=https://www.nsy.fr |
| Entité Wikidata (Knowledge Graph) | https://www.wikidata.org/wiki/Q140447227 |
| Registre officiel (SIRENE) | https://annuaire-entreprises.data.gouv.fr/entreprise/842078453 |
| LinkedIn entreprise | https://www.linkedin.com/company/28790840 |
| Backlink éditorial | prv-concept.com → footer « Propulsé par NSY » |

Le QID Wikidata et la page LinkedIn entreprise sont référencés dans les `sameAs` du JSON-LD et dans `llms.txt` / `llms-full.txt` — toute nouvelle inscription externe doit y être ajoutée aussi.

### Open Graph & Twitter Card

Chaque page embarque un bloc OG/Twitter complet. Bannière (`public/nsy-og.jpg`, **145 Ko**, 1200×630) dérivée du master `public/nsy-logo-ai.png` :

```bash
ffmpeg -i public/nsy-logo-ai.png \
  -vf "scale=-2:630,pad=1200:630:(1200-iw)/2:0:color=0x0A0F1C" \
  -q:v 4 public/nsy-og.jpg
```

→ mise à hauteur 630 px sans déformation, puis padding navy `#0A0F1C` jusqu'aux 1200 px. Aucun crop.

**Validation après upload** : [opengraph.xyz](https://www.opengraph.xyz) · [Facebook Debugger](https://developers.facebook.com/tools/debug) · envoi WhatsApp/Slack à soi-même.

## Skills Claude Code (`skills/`)

Le dépôt versionne deux [skills Claude Code](https://docs.claude.com/en/docs/claude-code/skills) — de la **documentation passive** chargée par Claude quand elle est pertinente (ils n'exécutent rien et ne modifient pas le site par eux-mêmes). Ils ne sont **pas déployés** (hors `deploy/`).

- **`skill-nsy-website`** — le « quoi » spécifique au projet : faits (fondée 2018, prix 5 800 € HT…), conventions bilingues, terminologie (Conception 3D / Maillage, pas de « K2000 »), contraintes du chatbot, pipeline 3D, workflow de déploiement. Évite de re-préciser ces règles à chaque session.
- **`frontend-responsive-perf`** — le « comment » technique réutilisable, framework-agnostique : responsive mobile/tablette/desktop/paysage, alignement des nav/widgets, optimisations CPU/GPU (pause hors-écran des vidéos/animations/3D, recompression média), chatbot léger sans LLM, et la méthodo de vérification en Chrome headless.
- **`seo-geo-llmo`** — le playbook SEO + GEO/LLMO réutilisable (nsy.fr, prv-concept.com, sites clients) : allowlist des crawlers IA, llms.txt, JSON-LD `@graph`, FAQ conversationnelle, inscriptions externes (Bing WT, propriété de domaine GSC, Wikidata, Google Business, backlinks) avec les pièges vécus et les méthodes de vérification.

**Activation** : Claude Code lit les skills depuis `~/.claude/skills/`. Copier ou lier les dossiers (`cp -R skills/* ~/.claude/skills/` ou `ln -s`). Détails dans [`skills/README.md`](skills/README.md).

## Crédits

- **Conception & développement** : Cédric Barme — assisté de Claude (Anthropic)
- **Design system** : direction "Cyber Cabinet"
- **Modèle 3D** : Renault R25 Baccara 1992, retravaillé sous Blender en wireframe
- **Vidéos** : générées via outils IA ou tournage perso

## Contact

- **Formulaire** : [www.nsy.fr/#contact](https://www.nsy.fr/#contact) (réponse sous 48 h ouvrées)
- **LinkedIn** : [linkedin.com/in/cédric-barme](https://www.linkedin.com/in/c%C3%A9dric-barme/)
- **GitHub** : [github.com/machouse78/nsy-website](https://github.com/machouse78/nsy-website)
- **Localisation** : France (missions principalement en distanciel)

---

© 2026 NSY · EURL · SIREN 842 078 453 · Mention "Site créé avec l'IA — transparence totale" en footer.
