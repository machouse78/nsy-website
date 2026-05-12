# NSY — Cabinet de conseil technique & création web propulsée par l'IA

[![Site](https://img.shields.io/badge/site-www.nsy.fr-00E5FF)](https://www.nsy.fr)
[![Hébergement](https://img.shields.io/badge/h%C3%A9bergement-Infomaniak-1AB7EA)](https://www.infomaniak.com)

Site one-page pour **NSY**, EURL fondée par Cédric Barme à Epieds-en-Beauce. Positionnement double : missions techniques senior pour la finance / assurance, et création de sites web propulsés par l'IA pour les PME/ETI en transition.

## Direction artistique

Design **"Cyber Cabinet"** — palette navy profond + cyan électrique + accent orange du logo. Typographie : Space Grotesk (display) + Manrope (corps) + JetBrains Mono (annotations).

| Couleur | Hex | Usage |
|---|---|---|
| `--bg-1` | `#0A0F1C` | Fond principal |
| `--accent` | `#00E5FF` | Cyan électrique — CTA, liens actifs, glow |
| `--warm` | `#F08A2C` | Orange du logo — points d'accent rares |
| `--fg-0` / `--fg-1` / `--fg-2` | `#F2F6FF` → `#8993AF` | Échelle de gris-bleu du texte |

## Stack

- **HTML5 + CSS3 + JavaScript vanilla** — zéro framework, zéro bundler
- **Google Fonts** : Space Grotesk, Manrope, JetBrains Mono
- **CSS custom properties** + `@property` pour les transitions interpolables (CTA banner gradient)
- **Vidéos MP4** servies directement, `preload="metadata"` pour ne pas saturer le first paint

## Structure du site

Page unique avec ancres :

| Section | id | Contenu |
|---|---|---|
| Hero | `top` | Headline + CTA + sphère vidéo `nsy-ia.mp4` + terminaux ASCII flottants |
| Marquee | — | Bandeau défilant des domaines couverts |
| Capabilities | — | 2 cards : Conseil senior / Création web IA |
| Process | — | 4 étapes : Discovery → Design → Build → Handover |
| Trust strip | — | 3 valeurs : Indépendance / Confidentialité / Engagement |
| Services | `services` | 2 cards détaillées avec swap image ↔ vidéo au survol |
| About | `about` | Profil Cédric Barme, signaux clés, parcours, principes |
| Contact | `contact` | Formulaire avec choix de service + canaux directs + mentions légales |
| CTA banner | — | Bandeau "Prochain créneau" avec spotlight souris suivant |
| Footer | — | Navigation + expertise + contact + réseaux sociaux |

## Fonctionnalités interactives

- **Année et expérience dynamiques** : `data-current-year`, `data-years`, `data-years-fr` injectés en JS (basé sur `2026 - 14 = 2012` comme année de début de carrière)
- **Scroll-spy nav** via `IntersectionObserver` — la rubrique active passe en cyan dans le menu
- **Sphère hero** : vidéo `nsy-ia.mp4` en `object-fit: cover`, masquée en cercle, terminaux ASCII et tags qui flottent au-dessus avec `z-index: 3`
- **Cards services** : au survol, l'image PNG cross-fade vers une vidéo MP4 qui se lance ; au mouseleave, retour à `currentTime = 0`
- **CTA banner "Prochain créneau"** : 2 dégradés radiaux (cyan + orange) qui suivent la souris en temps réel via custom properties `--mx` / `--my`, avec retour en douceur (550 ms) quand on quitte la zone — grâce à `@property` qui rend les pourcentages interpolables
- **Chatbot flottant** : FAB cyan en bas-droite, panneau glassmorphic, réponses par mots-clés (tarifs, dispo, services, contact, parcours, banque…)
- **Formulaire contact** : option pour choisir le service (Conseil technique / Création web IA), horizon de démarrage, message libre. Toast de confirmation après submit (stub front-only, à brancher sur un backend pour la prod)

## Structure du repo

```
nsy-website/
├── index.html                    # Page principale (one-page complet)
├── css/style.css                 # Styles complets (~1500 lignes)
├── js/app.js                     # Logique chatbot, swaps vidéo, scroll-spy, CTA spotlight
├── public/                       # Assets servis publiquement
│   ├── nsy-logo.png              # Logo principal
│   ├── cropped-NSY-logo-*.png    # Favicons (32, 180, 192, 270)
│   ├── photo-profil.png          # Photo Cédric Barme (section About)
│   ├── finance-assurance.png     # Visuel statique service 01
│   ├── finance-assurance.mp4     # Vidéo au survol service 01
│   ├── web-ia.png                # Visuel statique service 02
│   ├── web-ia.mp4                # Vidéo au survol service 02
│   └── nsy-ia.mp4                # Vidéo de la sphère hero
├── sitemap.xml                   # Plan du site (page + images + vidéos)
├── robots.txt                    # Règles pour les crawlers
├── .htaccess                     # Config Apache pour Infomaniak (GZIP + cache + HTTPS)
├── prepare-deploy.sh             # Script de build du dossier deploy/
├── deploy/                       # Dossier généré, à uploader dans public_html/
├── DEPLOIEMENT-INFOMANIAK.md     # Guide hébergement
└── README.md                     # Ce fichier
```

## Tester en local

```bash
# Python (préinstallé sur macOS)
python3 -m http.server 8000
open http://localhost:8000

# ou Node
npx serve .

# ou VS Code / Cursor — extension "Live Server", clic droit sur index.html
```

## Préparer un déploiement

```bash
./prepare-deploy.sh
```

Le script :
1. Reconstruit le dossier `deploy/` à zéro
2. Copie **uniquement les assets utilisés** (images, vidéos, CSS, JS, racine) — environ 97 Mo
3. Vérifie que tous les fichiers requis sont présents
4. Vérifie que chaque `src=` / `href=` dans `index.html` pointe vers un fichier qui existe
5. Affiche un tableau récapitulatif + tailles
6. Sort en code 1 si quelque chose manque (utilisable en CI)

## Déployer sur Infomaniak

1. Lancer `./prepare-deploy.sh`
2. Uploader le **contenu** de `deploy/` (pas le dossier lui-même) dans `public_html/` via FTP / SFTP
3. **Important** : activer l'affichage des fichiers cachés dans le client FTP pour transférer `.htaccess`
4. Tester `https://www.nsy.fr` — SSL automatique via Let's Encrypt
5. Soumettre le sitemap sur [Google Search Console](https://search.google.com/search-console)
6. Vérifier `https://www.nsy.fr/robots.txt`

Le `.htaccess` configure : GZIP, cache headers (1 mois images/vidéos, 1 semaine CSS/JS, 1h HTML), force HTTPS, security headers (`X-Frame-Options`, `Strict-Transport-Security`, etc.).

## SEO & partage social

- **Sitemap** référençant la page principale + ses ancres + les pages légales + les 4 images clés (dont la bannière OG) + les 3 vidéos hero/services
- **Robots.txt** avec Allow explicite pour les assets utilisés, Disallow des répertoires techniques
- **JSON-LD Organization** avec founder = Cédric Barme + sameAs LinkedIn/GitHub
- **Canonical URL** : `https://www.nsy.fr`
- **hreflang** : `fr` + `x-default`

### Open Graph & Twitter Card

Chaque page (accueil + `mentions-legales.html` + `confidentialite.html`) embarque un bloc complet :

| Balise | Valeur (accueil) |
|---|---|
| `og:type` / `og:site_name` / `og:locale` | `website` / `NSY` / `fr_FR` |
| `og:title` / `og:description` | Titre + description (~120 caractères) spécifique à la page |
| `og:image` (+ `:secure_url`, `:type`, `:width`, `:height`, `:alt`) | `https://www.nsy.fr/public/nsy-og.jpg` · `image/jpeg` · **1200×630** · alt "NSY — L'IA au service du numérique" |
| `twitter:card` | `summary_large_image` |
| `twitter:title` / `twitter:description` / `twitter:image` / `twitter:image:alt` | équivalents Twitter (mêmes valeurs en pratique) |

**Bannière OG** (`public/nsy-og.jpg`, **145 Ko**, 1200×630) : dérivée du master `public/nsy-logo-ai.png` (1672×941) via :

```bash
ffmpeg -i public/nsy-logo-ai.png \
  -vf "scale=-2:630,pad=1200:630:(1200-iw)/2:0:color=0x0A0F1C" \
  -q:v 4 public/nsy-og.jpg
```

→ Mise à hauteur 630px sans déformation, puis padding navy `#0A0F1C` (couleur de fond du site) à gauche et à droite jusqu'aux 1200px canoniques. Aucun crop, tout le contenu reste visible et le padding fond avec les bords sombres de l'image source. Pour régénérer dans d'autres formats : reprendre `public/nsy-logo-ai.png`.

**Validation après upload** :
- Facebook / LinkedIn : [opengraph.xyz](https://www.opengraph.xyz) ou [developers.facebook.com/tools/debug](https://developers.facebook.com/tools/debug)
- Twitter/X : [cards-dev.twitter.com/validator](https://cards-dev.twitter.com/validator) (déprécié mais encore actif)
- WhatsApp / Slack / Discord : envoi à soi-même

## Crédits

- **Conception & développement** : Cédric Barme — assisté de Claude (Anthropic)
- **Design system** : direction "Cyber Cabinet" issue du brief Claude Design
- **Photo profil** : Cédric Barme
- **Vidéos** : générées via outils IA (Veo / Sora) ou tournage perso, intégrées telles quelles

## Contact

- **Email** : [contact@nsy.fr](mailto:contact@nsy.fr)
- **LinkedIn** : [linkedin.com/in/cédric-barme](https://www.linkedin.com/in/c%C3%A9dric-barme/)
- **GitHub** : [github.com/machouse78/nsy-website](https://github.com/machouse78/nsy-website)
- **Localisation** : Epieds-en-Beauce, Centre-Val de Loire

---

© 2026 NSY · EURL · SIREN 842 078 453 · Mention "Site créé avec l'IA — transparence totale" en footer.
