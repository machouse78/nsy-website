# Guide Déploiement Infomaniak - NSY Website

## 📋 Préparatifs Réalisés

### ✅ Fichiers de Configuration
- `.htaccess` - Configuration Apache optimisée Infomaniak
- `robots.txt` - SEO et indexation moteurs de recherche  
- Meta-tags enrichis - Open Graph + Twitter + SEO

### ✅ Optimisations Techniques
- Compression GZIP activée pour tous les assets
- Cache headers configurés (images 1 mois, CSS/JS 1 semaine)
- Force HTTPS automatique
- Protection fichiers sensibles

### ✅ Structure Compatible Infomaniak
```
nsy-website/                    # Racine à uploader
├── index.html                  # Page principale
├── .htaccess                   # Configuration Apache
├── robots.txt                  # SEO robots
├── css/
│   └── style.css              # Styles complets
├── js/  
│   └── app.js                 # Logic + chatbot + animations
└── public/
    ├── video.mp4              # Vidéo hero (auto-play)
    └── nsy-logo.png           # Logo NSY
```

## 🚀 Instructions Déploiement

### 1. Préparation FTP
**Connectez-vous à votre espace Infomaniak :**
- Manager Infomaniak → Hébergement → Gestion des fichiers
- Ou FTP : `ftp.votre-domaine.ch` (selon config Infomaniak)

### 2. Upload des Fichiers
**Uploader dans le dossier `public_html/` ou racine web :**
```
public_html/
├── index.html                  # Upload
├── .htaccess                   # Upload  
├── robots.txt                  # Upload
├── css/style.css               # Upload
├── js/app.js                   # Upload
├── public/video.mp4            # Upload (attention taille)
└── public/nsy-logo.png         # Upload
```

### 3. Vérifications Post-Upload
- [ ] Site accessible sur https://votre-domaine.ch
- [ ] Vidéo se charge et joue automatiquement
- [ ] Navigation fonctionne (ancres #about, #services, etc.)
- [ ] Formulaire contact opérationnel
- [ ] Chatbot IA répond correctement
- [ ] Footer affiché avec copyright

### 4. Tests Spécifiques Infomaniak

#### Performance
```bash
# Test vitesse de chargement
curl -w "@curl-format.txt" -o /dev/null -s "https://votre-domaine.ch"
```

#### Vidéo
- Vérifier auto-play selon politique navigateur
- Tester sur mobile (playsinline attribute)
- Confirmer effet ralentissement 0.5s avant fin

#### SSL/HTTPS
- Certificat Let's Encrypt automatique Infomaniak
- Redirection HTTP → HTTPS via .htaccess

## ⚠️ Points d'Attention Infomaniak

### Limitations Hébergement Mutualisé
- **Taille fichiers** : 3 vidéos MP4 ~200MB total (vérifier limite upload)
- **Bande passante** : Surveillance consommation vidéo auto-play
- **PHP** : Non requis pour ce site (HTML/CSS/JS pur)

### Vidéos Multiples
- **3 vidéos** : video.mp4, video2.mp4, video3.mp4
- **Chargement aléatoire** : Une vidéo sélectionnée à chaque visite
- **Diversité contenu** : Expérience utilisateur variée

### Optimisations Conseillées
1. **CDN recommandé** : Pour héberger les 3 vidéos (200MB total)
2. **Monitoring bande passante** : Surveillance consommation

3. **Monitoring** : Surveiller métriques Core Web Vitals

## 🎯 Fonctionnalités Confirmées

### ✅ Compatible Infomaniak
- HTML/CSS/JS statique (pas de serveur requis)
- .htaccess Apache standard
- Pas de dépendances serveur
- Responsive et cross-browser

### ✅ SEO Ready
- Meta-tags complets (title, description, keywords)
- Open Graph + Twitter Cards
- Favicon et Apple Touch Icon
- Structure sémantique HTML5

### ✅ Performance Optimisée
- CSS/JS minifiés via CDN
- Images PNG optimisées
- Cache headers configurés
- Compression GZIP activée

## 🔗 URLs Post-Déploiement

- **Site principal** : https://www.nsy.fr
- **Test mobile** : https://www.nsy.fr (responsive natif)
- **Admin Infomaniak** : manager.infomaniak.com

## 📞 Support

En cas de problème lors du déploiement :
- **Support Infomaniak** : Ticket depuis manager.infomaniak.com
- **Vérifications techniques** : Logs Apache dans l'interface Infomaniak
- **SSL** : Activation automatique Let's Encrypt

Le site NSY est prêt pour la mise en ligne Infomaniak ! 🚀