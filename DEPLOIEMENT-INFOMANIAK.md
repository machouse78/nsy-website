# Guide Déploiement Infomaniak - NSY Website

## 📋 Préparatifs Réalisés

### ✅ Fichiers de Configuration
- `.htaccess` - Configuration Apache optimisée Infomaniak
- `robots.txt` - SEO et indexation moteurs de recherche optimisés
- `sitemap.xml` - Plan du site complet avec images et vidéos
- Meta-tags enrichis - 50+ balises SEO + Open Graph + Twitter + Schema.org

### ✅ Optimisations Techniques
- Compression GZIP activée pour tous les assets
- Cache headers configurés (images 1 mois, CSS/JS 1 semaine)
- Force HTTPS automatique
- Protection fichiers sensibles
- DNS prefetch pour CDN et Google Fonts
- Preload des ressources critiques (CSS + JS)

### ✅ Structure Compatible Infomaniak
```
nsy-website/                    # Racine à uploader (225MB total)
├── index.html                  # Page principale (7 sections + SEO complet)
├── sitemap.xml                 # Plan du site pour moteurs de recherche
├── .htaccess                   # Configuration Apache optimisée
├── robots.txt                  # SEO robots avec instructions spécifiques
├── css/
│   └── style.css              # Styles complets + responsive + modal + liens sociaux
├── js/  
│   └── app.js                 # Logic + chatbot + animations + modal + navigation
└── public/
    ├── video.mp4              # Vidéo hero principale (69MB)
    ├── video2.mp4             # Vidéo alternative 2 (69MB)
    ├── video3.mp4             # Vidéo alternative 3 (69MB)
    ├── briefing.png           # Image processus NSY (modal zoom - 1.7MB)
    ├── nsy-logo.png           # Logo NSY original
    ├── cropped-NSY-logo-32x32.png     # Favicon 32x32 (686B)
    ├── cropped-NSY-logo-180x180.png   # Apple touch icon (2.5KB)
    ├── cropped-NSY-logo-192x192.png   # Android icon (2.7KB)
    └── cropped-NSY-logo-270x270.png   # Windows tile (4KB)
```

## 🚀 Instructions Déploiement

### 1. Préparation Automatique
**Utiliser le script de déploiement :**
```bash
./prepare-deploy.sh
# Génère automatiquement le dossier deploy/ (225MB)
# Copie tous les fichiers nécessaires
# Vérifie l'intégrité des assets
```

### 2. Connexion FTP Infomaniak
**Connectez-vous à votre espace Infomaniak :**
- Manager Infomaniak → Hébergement → Gestion des fichiers
- Ou FTP : `ftp.votre-domaine.ch` (selon config Infomaniak)
- Ou FileZilla avec identifiants Infomaniak

### 3. Upload des Fichiers (depuis deploy/)
**Uploader le contenu COMPLET de deploy/ dans `public_html/` :**
```
public_html/
├── index.html                  # Upload (7 sections + 50+ meta SEO)
├── sitemap.xml                 # Upload (plan du site)
├── .htaccess                   # Upload (configuration Apache)
├── robots.txt                  # Upload (instructions moteurs)
├── css/style.css               # Upload (styles + modal + social)
├── js/app.js                   # Upload (logic + chatbot + modal)
└── public/
    ├── video.mp4               # Upload (69MB - vidéo 1)
    ├── video2.mp4              # Upload (69MB - vidéo 2)  
    ├── video3.mp4              # Upload (69MB - vidéo 3)
    ├── briefing.png            # Upload (1.7MB - image processus)
    ├── nsy-logo.png            # Upload (8KB - logo principal)
    └── cropped-NSY-logo-*.png  # Upload (4 favicons - 686B à 4KB)
```

### 4. Vérifications Post-Upload
- [ ] Site accessible sur https://votre-domaine.ch
- [ ] 3 vidéos se chargent aléatoirement et jouent automatiquement
- [ ] Navigation fonctionne avec buffers optimisés (concept, processus, etc.)
- [ ] Formulaire contact génère mailto automatiquement
- [ ] Chatbot IA toggle fonctionne (ouvrir/fermer avec bulle bleue)
- [ ] Modal image briefing.png zoom depuis position source
- [ ] Footer affiché avec liens LinkedIn + GitHub + copyright automatique
- [ ] Favicons visibles dans navigateur et mobile (4 tailles)
- [ ] Sitemap accessible : https://votre-domaine.ch/sitemap.xml

### 5. Tests Spécifiques Infomaniak

#### Performance & SEO
```bash
# Test vitesse de chargement
curl -w "@curl-format.txt" -o /dev/null -s "https://votre-domaine.ch"

# Test SEO
curl -s "https://votre-domaine.ch" | grep -E "(title|description|og:|twitter:)"
```

#### Vidéos Multiples
- Vérifier chargement aléatoire des 3 vidéos (F5 pour tester)
- Tester auto-play selon politique navigateur
- Tester sur mobile (playsinline attribute)
- Confirmer effet ralentissement 0.5s avant fin avec playbackRate

#### SSL/HTTPS
- Certificat Let's Encrypt automatique Infomaniak
- Redirection HTTP → HTTPS via .htaccess
- Test liens sociaux HTTPS (LinkedIn + GitHub)

## ⚠️ Points d'Attention Infomaniak

### Limitations Hébergement Mutualisé
- **Taille totale** : 225MB avec 3 vidéos + assets (vérifier limite upload)
- **Bande passante** : Surveillance consommation vidéo auto-play
- **PHP** : Non requis pour ce site (HTML/CSS/JS pur)
- **Upload FTP** : Temps d'upload ~10-15min pour 3 vidéos (69MB chacune)

### Vidéos Multiples & Performance
- **3 vidéos** : video.mp4, video2.mp4, video3.mp4
- **Chargement aléatoire** : Math.random() sélectionne une vidéo à chaque visite
- **Diversité contenu** : Expérience utilisateur variée
- **Ralentissement** : JavaScript playbackRate (pas ffmpeg)

### Optimisations Conseillées
1. **CDN recommandé** : Pour héberger les 3 vidéos (207MB vidéos total)
2. **Monitoring bande passante** : Surveillance consommation auto-play
3. **Core Web Vitals** : Surveiller métriques avec preload critical resources
4. **Compression images** : briefing.png (1.7MB) pourrait être optimisée

## 🎯 Fonctionnalités Confirmées

### ✅ Compatible Infomaniak
- HTML/CSS/JS statique (pas de serveur requis)
- .htaccess Apache standard avec optimisations
- Pas de dépendances serveur (pas de PHP/MySQL)
- Responsive et cross-browser (Chrome, Firefox, Safari, Edge)

### ✅ SEO Ready Complet
- **50+ balises meta** : title, description, keywords étendus
- **Schema.org JSON-LD** : Organization + Person + Services
- **Open Graph enrichi** : Images 1200x630, locale fr_FR
- **Twitter Cards** : Large image + @nsy_fr / @cedric_barme
- **Sitemap.xml** : Pages + images + vidéos avec métadonnées
- **Robots.txt optimisé** : Instructions Google + Bing + crawl-delay
- **Favicons complets** : 4 tailles pour tous les appareils
- **Canonical URL** : https://www.nsy.fr
- **Géolocalisation** : France + langue française

### ✅ Performance Optimisée
- **CSS/JS** : Optimisés avec preload critical
- **Images PNG** : Optimisées + favicons multi-tailles
- **Cache headers** : 1 mois assets, 1 semaine code
- **Compression GZIP** : Tous les text assets
- **DNS prefetch** : CDN + Google Fonts + ressources externes

### ✅ UX/Fonctionnalités Avancées
- **Navigation précise** : Buffers différentiels par section (concept: 100px)
- **Chatbot IA** : Toggle ouvrir/fermer + réponses expertes NSY
- **Modal image** : briefing.png avec zoom naturel + clic pour fermer
- **Formulaire contact** : Génération mailto + validation HTML5
- **Liens sociaux** : LinkedIn + GitHub avec animations hover
- **Sections alternées** : align-left/right avec animations cohérentes
- **Espacements optimisés** : 12 points par section, scroll fluide

## 🔗 URLs Post-Déploiement

- **Site principal** : https://www.nsy.fr
- **Sitemap** : https://www.nsy.fr/sitemap.xml
- **Robots** : https://www.nsy.fr/robots.txt
- **Test mobile** : https://www.nsy.fr (responsive natif)
- **Admin Infomaniak** : manager.infomaniak.com

## 📊 Métriques à Surveiller

### Performance
- **First Contentful Paint** : < 2s (objectif)
- **Largest Contentful Paint** : < 4s avec vidéo (objectif)
- **Cumulative Layout Shift** : < 0.1 (objectif)
- **Time to Interactive** : < 5s (objectif)

### SEO & Indexation
- **Google Search Console** : Soumission sitemap.xml
- **Rich Snippets** : Vérification Schema.org avec test Google
- **Core Web Vitals** : Monitoring PageSpeed Insights
- **Indexation** : robots.txt respecté par moteurs

## 📞 Support

En cas de problème lors du déploiement :
- **Support Infomaniak** : Ticket depuis manager.infomaniak.com
- **Vérifications techniques** : Logs Apache dans l'interface Infomaniak
- **SSL** : Activation automatique Let's Encrypt
- **Vidéos** : Vérifier upload complet des 3 fichiers (69MB chacun)
- **Favicons** : Tester affichage sur différents appareils/navigateurs
- **SEO** : Vérifier sitemap.xml accessible et bien formé

---

## 🚀 Résumé Final

Le site NSY est maintenant **production-ready** avec :
- **✅ 7 sections** numérotées avec navigation optimisée  
- **✅ 3 vidéos** aléatoires avec ralentissement cinématographique
- **✅ SEO complet** : 50+ meta tags + sitemap + schema.org
- **✅ UX avancée** : Chatbot IA + modal + liens sociaux + formulaire
- **✅ Performance** : Cache + GZIP + preload + DNS prefetch
- **✅ Branding** : Favicons 4 tailles + logo professionnel
- **✅ Compatibilité** : Infomaniak + responsive + cross-browser

**Prêt pour mise en ligne ! 🎉**