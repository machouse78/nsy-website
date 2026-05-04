# Commandes pour NSY Website

## Installation et lancement

### 1. Installation des dépendances
```bash
cd nsy-website
npm install
```

### 2. Lancement en mode développement
```bash
npm run dev
```
→ Ouvre http://localhost:3000

### 3. Build de production
```bash
npm run build
```
→ Génère le dossier `dist/` avec les fichiers optimisés

### 4. Aperçu du build de production
```bash
npm run preview
```

## Déploiement sur Infomaniak

### Étapes à suivre :

1. **Générer le build de production**
   ```bash
   npm run build
   ```

2. **Récupérer le contenu du dossier `dist/`**
   - Tous les fichiers du dossier `dist/` doivent être uploadés

3. **Upload via FTP/SFTP sur Infomaniak**
   - Se connecter à l'espace d'hébergement Infomaniak
   - Aller dans le dossier `public_html/` ou `www/`
   - Uploader tout le contenu du dossier `dist/`

4. **Vérification**
   - Le fichier `.htaccess` est déjà inclus et configuré
   - Le site devrait fonctionner immédiatement

## Structure des fichiers générés

Après `npm run build`, le dossier `dist/` contiendra :
```
dist/
├── index.html              # Page principale
├── assets/
│   ├── index-[hash].js     # JavaScript principal
│   ├── index-[hash].css    # Styles CSS
│   └── vendor-[hash].js    # Librairies tierces
├── .htaccess              # Configuration serveur
└── vite.svg               # Favicon
```

## Résolution de problèmes

### Si le site ne charge pas après déploiement :
1. Vérifier que tous les fichiers sont bien uploadés
2. Vérifier que le `.htaccess` est présent
3. Vérifier les permissions des fichiers (755 pour les dossiers, 644 pour les fichiers)

### Si les routes ne fonctionnent pas :
- Le fichier `.htaccess` gère les routes React Router
- Vérifier que mod_rewrite est activé sur le serveur Infomaniak

### Problèmes de performance :
- La compression Gzip est activée via `.htaccess`
- Le cache est configuré pour optimiser le chargement

## Modification du contenu

Pour modifier les textes, services, ou informations :
1. Éditer le fichier `src/data/content.js`
2. Relancer `npm run build`
3. Re-uploader le contenu du dossier `dist/`

## Support technique

En cas de problème :
- Email : cedric.barme@nsy.fr
- Téléphone : 06 72 94 71 06