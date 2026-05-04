# NSY Website 🚀

> Site web moderne pour NSY - Expert en Intelligence Artificielle et Solutions Numériques

[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-4.5.14-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.2.7-38B2AC.svg)](https://tailwindcss.com/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-10.0.0-FF0055.svg)](https://www.framer.com/motion/)

## 📋 Description

Site web professionnel présentant l'expertise en intelligence artificielle et développement full-stack de **Cédric Barme**. Cette application React moderne offre une expérience utilisateur immersive avec des animations interactives, un design responsive et un ChatBot IA intégré.

## ✨ Fonctionnalités

### 🎨 **Design & Interface**
- **Thème sombre élégant** avec palette NSY personnalisée (orange/rouge/doré/cyan)
- **Design 100% responsive** optimisé mobile-first
- **Glassmorphisme** et effets de blur modernes
- **Logo NSY animé** avec réseau neuronal de 50 particules interactives
- **Effets magnétiques intelligents** avec fondu de couleur progressif
- **Interface épurée** sans éléments perturbants
- **Hiérarchie visuelle optimisée** avec titre centré au-dessus de l'animation

### ⚡ **Animations Avancées**
- **Framer Motion** pour des transitions fluides 60fps
- **Animation typing** dans la section Hero avec effet machine à écrire
- **Réseau neuronal interactif** avec 50 particules et connexions dynamiques
- **Fondu de couleur progressif** (orange ↔ bleu) avec interpolation RGB
- **Forces magnétiques** et attraction vers la souris
- **Animation continue** avec mouvements sinusoïdaux organiques
- **Timeline interactive** pour la méthodologie
- **Effets de parallaxe** et animations au scroll
- **Micro-interactions** sur tous les éléments

### 🤖 **Fonctionnalités Interactives**
- **ChatBot IA intégré** avec réponses contextuelles
- **Formulaire de contact** fonctionnel
- **Navigation smooth** entre sections
- **ScrollToTop automatique**
- **Statistiques dynamiques** (expérience calculée depuis 2012)

### 📱 **Sections du Site**
1. **Hero** - Présentation avec animation logo et statistiques
2. **À propos** - Profil Cédric Barme avec expérience dynamique
3. **Services** - 6 services en cards interactives
4. **IA & Innovation** - Expertise en intelligence artificielle
5. **Méthodes** - Processus en 6 étapes avec timeline
6. **Construction** - Transparence sur le développement IA
7. **Contact** - Formulaire et informations de contact

## 🛠️ Technologies Utilisées

### Frontend Core
- **React 18.2.0** - Framework JavaScript moderne
- **Vite 4.5.14** - Build tool ultra-rapide
- **React Router DOM 6.8.1** - Routing côté client

### Styling & Animations
- **Tailwind CSS 3.2.7** - Framework CSS utilitaire
- **Framer Motion 10.0.0** - Animations et micro-interactions
- **PostCSS 8.4.21** + **Autoprefixer 10.4.14**

### UI & Icons
- **Lucide React 0.363.0** - Bibliothèque d'icônes modernes
- **Particules Canvas** personnalisées (50 particules interactives)

## 🚀 Installation et Utilisation

### Prérequis
- **Node.js** 16+ 
- **npm** ou **yarn**

### Installation
```bash
# Cloner le repository
git clone https://github.com/machouse78/nsy-website.git

# Aller dans le dossier
cd nsy-website

# Installer les dépendances
npm install
```

### Développement
```bash
# Lancer le serveur de développement
npm run dev

# Ouvrir http://localhost:3001 dans votre navigateur
```

### Production
```bash
# Créer le build optimisé
npm run build

# Prévisualiser le build
npm run preview
```

### Déploiement
Le projet est optimisé pour l'hébergement mutualisé Infomaniak :
- Build statique dans le dossier `dist/`
- Fichier `.htaccess` configuré pour Apache
- Assets optimisés et compressés

## 📊 Contenu Dynamique

### Calculs Automatiques
- **Expérience** : Calculée automatiquement depuis 2012 (14+ en 2024, 15+ en 2025, etc.)
- **Copyright** : Année courante mise à jour automatiquement
- **Statistiques** : Technologies (20+), Clients (2), Expertise (Full-Stack)

### Informations de Contact
- **Email** : cedric.barme@nsy.fr
- **Téléphone** : 06 72 94 71 06
- **LinkedIn** : [Cédric Barme](https://www.linkedin.com/in/cédric-barme/)

## 🌐 Déploiement sur Infomaniak

1. **Générer le build de production**
```bash
npm run build
```

2. **Télécharger le contenu du dossier `dist/`**
Le dossier `dist/` contient tous les fichiers nécessaires pour votre site web.

3. **Uploader via FTP/SFTP**
- Connectez-vous à votre espace Infomaniak via FTP/SFTP
- Naviguez vers le dossier racine de votre site (généralement `public_html/` ou `www/`)
- Uploadez tout le contenu du dossier `dist/` vers ce répertoire

4. **Vérifier le fichier .htaccess**
Le fichier `.htaccess` est inclus et configuré pour :
- Gérer les routes React Router
- Optimiser les performances (cache, compression)
- Sécuriser le site
- Être compatible avec l'hébergement Infomaniak

## 🎯 Architecture du Projet

```
nsy-website/
├── src/
│   ├── components/          # Composants réutilisables
│   │   ├── common/         # Header, Footer
│   │   └── ui/             # ChatBot, Animations, Particules
│   ├── sections/           # Sections principales du site
│   ├── data/               # Contenu centralisé
│   ├── utils/              # Utilitaires (calculs dates)
│   └── styles/             # Styles globaux
├── public/                 # Assets statiques
├── dist/                   # Build de production
└── docs/                   # Documentation développement (50+ fichiers)
```

## 🔧 Configuration

### Couleurs Personnalisées (Tailwind)
```javascript
colors: {
  primary: '#f97316',    // Orange NSY
  cyber: '#06b6d4',      // Cyan technologique
  ai: '#d946ef',         // Violet IA
  dark: '#0f172a'        // Thème sombre
}
```

### Animations & Interactions
- **60fps** garantis avec Framer Motion et Canvas natif
- **Réseau neuronal stable** avec 50 particules permanentes
- **Animation continue** même sans interaction utilisateur
- **Fondu RGB progressif** (orange #f97316 ↔ bleu #3b82f6)
- **Forces physiques** : gravitation, magnétisme, mouvement sinusoïdal
- **Régénération intelligente** avec contrôle temporel anti-spam
- **Timeline responsive** avec breakpoints
- **Interface sans distraction** (suppression des textes perturbants)

## 🎨 Personnalisation

### Contenu
Modifiez le fichier `src/data/content.js` pour :
- Changer les textes
- Modifier les informations de contact
- Ajouter/supprimer des services
- Personnaliser les méthodologies

### Couleurs et design
Le fichier `tailwind.config.js` contient :
- Palette de couleurs personnalisée (primary, cyber, ai, dark)
- Animations et transitions
- Typographie

### Animations
Les animations sont configurées dans `src/styles/index.css` et utilisent Framer Motion.

## 🔒 Sécurité

Le fichier `.htaccess` inclut :
- Protection XSS
- Content Security Policy (CSP)
- Protection contre l'affichage des répertoires
- Sécurisation des fichiers sensibles

## 📱 Responsive Design

Le site est entièrement responsive et optimisé pour :
- Mobiles (320px+)
- Tablettes (768px+)
- Desktop (1024px+)
- Large screens (1280px+)

## ⚡ Performance

Optimisations incluses :
- Code splitting automatique
- Lazy loading des composants
- Compression Gzip
- Cache optimisé
- Images optimisées

## 🔧 Améliorations Récentes

### Interface & UX
- **Repositionnement du titre principal** au-dessus de l'animation NSY pour un impact visuel maximal
- **Centrage du sous-titre** "Expert indépendant..." pour une parfaite lisibilité
- **Alignement vertical optimisé** entre l'animation et le contenu textuel
- **Suppression des éléments perturbants** (texte "Effet magnétique actif")

### Animation du Réseau Neuronal
- **Stabilisation complète** : plus de recréation lors des mouvements de souris
- **Animation continue** avec forces sinusoïdales pour un mouvement organique
- **Fondu de couleur progressif** avec interpolation RGB mathématique précise
- **Système de régénération intelligent** avec contrôle temporel (1s minimum)
- **50 particules permanentes** formant un réseau neuronal cohérent
- **Transitions fluides** orange (#f97316) ↔ bleu (#3b82f6) sans cassure visuelle

### Corrections Techniques
- **Couleurs Tailwind CSS** : résolution des erreurs `cyber-500` avec palette cyan
- **Build optimisé** : installation automatique de `terser` pour la minification
- **Repository Git** : initialisation et synchronisation avec GitHub
- **Documentation complète** : README professionnel avec badges et instructions

## 📈 Processus de Développement

### Approche Innovante
- **Développement assisté par IA** avec transparence totale
- **IDE** : Cursor avec intégration IA native et synchronisation Git
- **Assistant** : Claude 4 Sonnet (Anthropic via OpenRouter)
- **Temps de développement** : ~3 heures avec itérations d'amélioration
- **Documentation complète** : 50+ fichiers MD + commits Git détaillés
- **Processus itératif** : corrections UX et optimisations animation en temps réel

### Philosophie
Transparence sur l'utilisation de l'IA dans le processus de création, démontrant comment l'expertise humaine et l'IA peuvent collaborer efficacement.

## 🚦 Statut du Projet

- ✅ **Build fonctionnel** - Aucune erreur de compilation
- ✅ **Animation stable** - Réseau neuronal fluide sans recréation intempestive
- ✅ **Interface optimisée** - Hiérarchie visuelle parfaite (titre → sous-titre → animation)
- ✅ **Interactions fluides** - Fondu de couleur progressif et forces magnétiques
- ✅ **Responsive design** - Testé sur mobile/tablet/desktop  
- ✅ **Performance optimisée** - Vite + code splitting + Canvas 60fps
- ✅ **SEO ready** - Meta tags et structure HTML
- ✅ **Git configuré** - Repository synchronisé avec GitHub
- ✅ **Production ready** - Prêt pour déploiement Infomaniak

## 👤 Auteur

**Cédric Barme**
- 🌐 Site web : [nsy.fr](https://nsy.fr)
- 📧 Email : cedric.barme@nsy.fr
- 💼 LinkedIn : [Cédric Barme](https://www.linkedin.com/in/cédric-barme/)
- 📱 Téléphone : 06 72 94 71 06

## 📄 Licence

Ce projet est la propriété de NSY. Tous droits réservés.

## 🤝 Contribution

Pour toute suggestion d'amélioration ou question technique :
1. Créer une issue sur GitHub
2. Contacter directement Cédric Barme
3. Proposer une pull request avec description détaillée

---

**NSY** - Transformez vos idées en solutions numériques innovantes 🚀