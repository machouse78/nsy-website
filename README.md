# NSY — Cabinet de conseil technique & création web propulsée par l'IA

[![Site](https://img.shields.io/badge/site-www.nsy.fr-00E5FF)](https://www.nsy.fr)
[![Hébergement](https://img.shields.io/badge/h%C3%A9bergement-Infomaniak-1AB7EA)](https://www.infomaniak.com)

Site one-page **bilingue (FR/EN)** pour **NSY**, EURL fondée par Cédric Barme en 2018 à Epieds-en-Beauce. Positionnement double : missions techniques senior pour la finance / assurance, et création de sites web propulsés par l'IA pour les PME/ETI en transition.

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
| Services | `services` | 2 cards détaillées avec swap image ↔ vidéo au survol |
| About | `about` | Profil Cédric Barme, signaux clés, parcours, principes |
| **Loisirs & créations** | `creations` | **Section 3D** : vidéo YouTube (chaîne NSY) + modèle wireframe interactif — 2 colonnes desktop, empilé mobile |
| Contact | `contact` | Formulaire (PHP) avec choix de service + canaux directs + mentions légales |
| CTA banner | — | Bandeau "Prochain créneau" avec spotlight souris suivant |
| Footer | — | Navigation + expertise + contact + réseaux sociaux |

Pages annexes : `mentions-legales.html` / `legal-notice.html` (EN) et `confidentialite.html` / `privacy.html` (EN).

## Bilingue (FR / EN)

Une page HTML par langue (pas de build, SEO propre), avec slugs **réellement traduits** :

| FR | EN |
|---|---|
| `index.html` (`/`) | `index-en.html` |
| `mentions-legales.html` | `legal-notice.html` |
| `confidentialite.html` | `privacy.html` |

- **Switch de langue** : drapeaux 🇫🇷 / 🇬🇧 dans la nav → pose un cookie `nsy_lang` (1 an, `SameSite=Lax`) et redirige vers la variante. Mapping de slugs explicite dans `js/app.js`.
- **Auto-détection** : sur `/` (sans cookie), `.htaccess` lit `Accept-Language` et redirige en 302 vers `/index-en.html` si le navigateur est en anglais. Le choix utilisateur (cookie) prime ensuite.
- **hreflang réciproque** `fr` / `en` / `x-default` sur les 6 pages, canoniques auto-référencées.
- **Cookie `nsy_lang`** : unique cookie fonctionnel, posé sur action explicite (clic drapeau) — exempté de consentement (délibération CNIL 2020-091). Documenté dans les pages légales.

## Fonctionnalités interactives

- **Année & expérience dynamiques** : `data-current-year`, `data-years`, `data-years-fr` injectés en JS (basé sur `2026 - 14 = 2012` comme année de début de carrière)
- **Scroll-spy nav** via `IntersectionObserver` — la rubrique active passe en cyan
- **Sphère hero** : vidéo `nsy-ia.mp4` en `object-fit: cover`, masquée en cercle, terminaux ASCII flottants
- **Cards services** : au survol, l'image PNG cross-fade vers une vidéo MP4 ; retour à `currentTime = 0` au mouseleave
- **CTA banner "Prochain créneau"** : 2 dégradés radiaux (cyan + orange) qui suivent la souris via `--mx` / `--my`, retour en douceur (550 ms) grâce à `@property`
- **Section 3D `#creations`** :
  - **Vidéo YouTube** de la chaîne NSY, intégrée via `youtube-nocookie.com` (aucun cookie avant lecture)
  - **Modèle wireframe interactif** d'une Renault R25 Baccara 1992 (`<model-viewer>`) — esthétique K2000 cyan, rotation auto + drag souris/tactile
  - Disposition **2 colonnes** sur desktop (vidéo agrandie à gauche, wireframe à droite), **empilée** sur mobile (≤ 920 px)
- **Chatbot intelligent** (voir ci-dessous)
- **Formulaire contact** : choix du service, horizon de démarrage, message libre → traité par `contact.php` (envoi réel + auto-réponse)

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
3. Envoie le message à `contact@nsy.fr` via **PHPMailer + SMTP Infomaniak**
4. Envoie une **auto-réponse HTML** au prospect, localisée selon le champ caché `lang` (FR/EN)
5. Répond en JSON (`{ ok: true }`) → toast de confirmation côté front

Les identifiants SMTP vivent dans `_secret/config.php` (gitignored). Modèle fourni : `_secret/config.php.example`.

## Pipeline wireframe 3D

Le modèle `public/renault-wireframe.glb` (**660 Ko**, esthétique K2000 cyan) est généré depuis un `.blend` source via une chaîne reproductible (`scripts/`) :

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

## Structure du repo

```
nsy-website/
├── index.html / index-en.html          # Page principale FR / EN
├── mentions-legales.html / legal-notice.html
├── confidentialite.html / privacy.html
├── contact.php                          # Backend formulaire (PHPMailer + Turnstile)
├── css/style.css                        # Styles complets
├── js/app.js                            # Chatbot, i18n, swaps vidéo, scroll-spy, 3D framing
├── scripts/                             # Pipeline 3D (Blender + glTF-Transform + Puppeteer)
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

## SEO & partage social

- **Sitemap** : page principale (FR + EN) + ancres + pages légales + images clés + vidéos, avec `xhtml:link` hreflang
- **hreflang réciproque** `fr` / `en` / `x-default` sur les 6 pages
- **Canonique cohérente** : tout pointe vers `https://www.nsy.fr/` (slash final uniforme), renforcée par la redirection `.htaccess`
- **JSON-LD Organization** : founder = Cédric Barme + sameAs LinkedIn/GitHub
- **Robots.txt** : Allow explicite des médias utilisés, Disallow des `.glb`/`.gltf`

### Open Graph & Twitter Card

Chaque page embarque un bloc OG/Twitter complet. Bannière (`public/nsy-og.jpg`, **145 Ko**, 1200×630) dérivée du master `public/nsy-logo-ai.png` :

```bash
ffmpeg -i public/nsy-logo-ai.png \
  -vf "scale=-2:630,pad=1200:630:(1200-iw)/2:0:color=0x0A0F1C" \
  -q:v 4 public/nsy-og.jpg
```

→ mise à hauteur 630 px sans déformation, puis padding navy `#0A0F1C` jusqu'aux 1200 px. Aucun crop.

**Validation après upload** : [opengraph.xyz](https://www.opengraph.xyz) · [Facebook Debugger](https://developers.facebook.com/tools/debug) · envoi WhatsApp/Slack à soi-même.

## Crédits

- **Conception & développement** : Cédric Barme — assisté de Claude (Anthropic)
- **Design system** : direction "Cyber Cabinet"
- **Modèle 3D** : Renault R25 Baccara 1992, retravaillé sous Blender en wireframe
- **Vidéos** : générées via outils IA ou tournage perso

## Contact

- **Email** : [contact@nsy.fr](mailto:contact@nsy.fr)
- **LinkedIn** : [linkedin.com/in/cédric-barme](https://www.linkedin.com/in/c%C3%A9dric-barme/)
- **GitHub** : [github.com/machouse78/nsy-website](https://github.com/machouse78/nsy-website)
- **Localisation** : Epieds-en-Beauce, Centre-Val de Loire

---

© 2026 NSY · EURL · SIREN 842 078 453 · Mention "Site créé avec l'IA — transparence totale" en footer.
