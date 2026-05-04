# NSY - Site Web Moderne

Site web professionnel pour NSY, expert en intelligence artificielle et solutions numériques.

## 🚀 Fonctionnalités

- **Design moderne et responsive** avec thème technologique IA/numérique
- **Animations fluides** avec Framer Motion
- **Interface utilisateur intuitive** optimisée pour tous les appareils
- **Performance optimisée** pour un chargement rapide
- **Compatible Infomaniak** pour hébergement mutualisé
- **Section IA dédiée** mettant en avant l'expertise en intelligence artificielle

## 🛠️ Technologies utilisées

- **React 18** - Framework JavaScript moderne
- **Vite** - Build tool ultra-rapide
- **Tailwind CSS** - Framework CSS utilitaire
- **Framer Motion** - Animations et micro-interactions
- **Lucide React** - Icônes modernes et cohérentes

## 📦 Installation

1. **Cloner ou télécharger le projet**
```bash
# Si vous avez Git
git clone <url-du-projet>
cd nsy-website

# Ou extraire l'archive ZIP dans le dossier nsy-website
```

2. **Installer les dépendances**
```bash
npm install
```

## 🔧 Scripts disponibles

### Développement local
```bash
npm run dev
```
Lance le serveur de développement sur http://localhost:3000

### Build de production
```bash
npm run build
```
Génère les fichiers optimisés dans le dossier `dist/`

### Aperçu du build
```bash
npm run preview
```
Permet de tester le build de production localement

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

## 📁 Structure du projet

```
nsy-website/
├── public/
│   ├── .htaccess          # Configuration serveur Infomaniak
│   └── vite.svg           # Favicon
├── src/
│   ├── components/        # Composants réutilisables
│   │   ├── common/       # Header, Footer
│   │   └── ui/           # Composants UI spécialisés
│   ├── sections/         # Sections principales du site
│   ├── data/            # Contenu et configuration
│   ├── styles/          # Styles CSS globaux
│   └── utils/           # Utilitaires
├── dist/                # Build de production (généré)
└── package.json         # Configuration npm
```

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

## 🤖 Mentions IA

Le site inclut les mentions obligatoires concernant l'utilisation de l'IA :
> "Site généré avec l'aide de l'intelligence artificielle, conçu avec Cursor comme IDE et Claude comme assistant IA."

Cette mention apparaît de manière élégante dans le footer du site.

## 📞 Support

Pour toute question ou modification :
- Email : cedric.barme@nsy.fr
- Téléphone : 06 72 94 71 06

## 📄 Licence

Projet propriétaire - NSY © 2024