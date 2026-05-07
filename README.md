# 🚀 NSY Website - Intelligence Artificielle & Solutions Numériques

[![Website](https://img.shields.io/badge/Website-Live-brightgreen)](https://www.nsy.fr)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with](https://img.shields.io/badge/Built%20with-AI-purple)](https://github.com/machouse78/nsy-website)

> Site web professionnel pour NSY, ESN spécialisée en Intelligence Artificielle et transformation digitale. 
> Créé avec une approche Apple-style et des animations vidéo immersives.

![NSY Website Preview](public/nsy-logo.png)

## ✨ Fonctionnalités Principales

### 🎬 **Vidéo Hero Immersive**
- Animation vidéo fullscreen style Apple iPhone
- Auto-play au chargement (respect politique navigateurs)
- Effet de ralentissement progressif dans les 0.5 dernières secondes
- Pas de boucle, arrêt naturel sur dernière frame

### 🎨 **Design Premium Apple-Style**
- **Typographie distinctive** : Playfair Display + Inter (évite générique)
- **Palette minimaliste** : Bleu accent + fond noir pour thème IA
- **Layout asymétrique** : Sections latérales + composition moderne
- **Animations GSAP** : ScrollTrigger + Lenis smooth scroll

### 🤖 **Intelligence Artificielle Intégrée**
- **Chatbot IA expert** : Réponses contextuelles sur services NSY
- **Base de connaissances** : Technologies, prix, méthodologie, contact
- **Interface moderne** : Toggle fixe + fenêtre backdrop-blur

### 📱 **UX/Navigation Optimisée**
- **Navigation ultra-précise** : Liens avec buffers différentiels optimisés
- **Smooth scroll Lenis** : Transitions fluides entre sections
- **Responsive design** : Mobile-first avec breakpoints adaptatifs
- **Formulaire contact** : Génération mailto automatique + validation

## 🛠️ Technologies Utilisées

### Frontend Core
- **HTML5** - Structure sémantique moderne
- **CSS3** - Styling avancé avec variables custom
- **JavaScript ES6+** - Logic native sans frameworks

### Libraries & CDN
- **GSAP 3** + **ScrollTrigger** - Animations profesionnelles
- **Lenis** - Smooth scroll premium
- **Fonts Google** - Playfair Display + Inter

### Optimisations
- **Video API native** - playbackRate pour ralentissement
- **Canvas rendering** - Fallbacks si nécessaire  
- **Responsive images** - Optimisation mobile

## 📁 Structure du Projet

```
nsy-website/
├── index.html                  # Page principale
├── .htaccess                   # Configuration Apache/Infomaniak
├── robots.txt                  # SEO et indexation
├── css/
│   └── style.css              # Styles complets + responsive
├── js/
│   └── app.js                 # Logic + animations + chatbot
├── public/
│   ├── video.mp4              # Vidéo hero (69MB original)
│   ├── video_optimized.mp4    # Vidéo compressée (25MB)
│   └── nsy-logo.png           # Logo NSY
├── deploy/                     # Dossier déploiement auto-généré
├── .claude/
│   └── skills/                # Skills IA utilisés
├── DEPLOIEMENT-INFOMANIAK.md   # Guide hébergement
└── prepare-deploy.sh           # Script préparation
```

## 🎯 Skills IA Appliqués

### 🎨 **frontend-design**
- Interface distinctive évitant les clichés IA
- Compositions asymétriques et typographie caractérielle
- Animations orchestrées et détails atmosphériques

### 🎬 **video-to-website** 
- Intégration vidéo hero style Apple
- Effets de ralentissement cinématographique
- Optimisation performance et UX

## 🚀 Installation & Développement

### Prérequis
- Navigateur moderne (Chrome, Firefox, Safari, Edge)
- Serveur local pour développement

### Installation
```bash
# Cloner le repository
git clone https://github.com/machouse78/nsy-website.git
cd nsy-website

# Lancer serveur local
python3 -m http.server 8000
# Ou
npx serve .
# Ou
php -S localhost:8000

# Accéder au site
open http://localhost:8000
```

### Développement
```bash
# Préparer le déploiement
./prepare-deploy.sh

# Contenu à uploader = dossier deploy/
```

## 🌐 Déploiement Infomaniak

### Préparation Automatique
```bash
./prepare-deploy.sh  # Génère le dossier deploy/
```

### Upload FTP
1. Connectez-vous à votre espace Infomaniak
2. Uploadez le contenu de `deploy/` dans `public_html/`
3. Vérifiez que `.htaccess` est bien transféré

### Post-Déploiement
- ✅ Site accessible sur `https://www.nsy.fr`
- ✅ SSL automatique (Let's Encrypt Infomaniak)
- ✅ Compression GZIP activée
- ✅ Cache headers configurés

## 📊 Performance

### Métriques Cibles
- **First Contentful Paint** : < 2s
- **Largest Contentful Paint** : < 4s (avec vidéo)
- **Cumulative Layout Shift** : < 0.1
- **Time to Interactive** : < 5s

### Optimisations Appliquées
- **Compression vidéo** : 69MB → 25MB (CRF 28)
- **Cache stratégie** : 1 mois images/vidéos, 1 semaine CSS/JS
- **GZIP compression** : Activée pour tous les text assets
- **Critical CSS** : Inline styles pour above-the-fold

## 🎨 Sections & Contenu

### 📄 Pages/Sections
1. **Vidéo Hero** - Animation immersive + tagline
2. **La Société** (002) - Présentation NSY ESN
3. **Services** (003) - Développement & Innovation IA
4. **Stats** (avec overlay sombre) - 12 ans, 89% utilisateurs
5. **Expertise** (004) - Technologies de pointe
6. **Contact** (005) - Formulaire + informations

### 🤖 Chatbot IA Responses
- **Services** : Stack technique + domaines expertise
- **IA/ML** : Technologies + cas d'usage
- **Prix** : Grille tarifaire + consultations gratuites
- **Contact** : Coordonnées + délais réponse
- **Technologies** : Frontend/Backend/Cloud détaillé
- **Méthodologie** : Process 6 étapes + Agile

## 🔧 Configuration Technique

### Video Settings
```javascript
// Ralentissement 0.5s avant fin
fadeStartTime = videoDuration - 0.5;
fadeProgress = (currentTime - fadeStartTime) / 0.5;
playbackRate = 1.0 → 0.3 (ralentissement 70%)
```

### Navigation Buffers
```javascript
buffers = {
    about: 200px,      // La Société
    services: 200px,   // Services  
    contact: 600px,    // Contact (fin de page)
    expertise: 100px   // Expertise (parfait)
}
```

## 🤝 Contribution

Ce projet démontre l'utilisation de skills IA spécialisés pour créer des interfaces web distinctives et performantes.

### Développé par
- **NSY** - [nsy.fr](https://nsy.fr)
- **Cédric Barme** - Expert IA & Développement Full-Stack

### Built with ❤️ and 🤖
Site créé avec l'IA en toute transparence, appliquant les skills `frontend-design` et `video-to-website` pour un résultat premium.

---

## 📞 Contact

- **Email** : [contact@nsy.fr](mailto:contact@nsy.fr)
- **Website** : [nsy.fr](https://nsy.fr)
- **Expertise** : Intelligence Artificielle & Transformation Digitale

---

*© 2024 NSY. Tous droits réservés. | Site créé avec l'IA • Transparence totale*