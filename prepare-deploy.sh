#!/bin/bash

# Script de préparation déploiement Infomaniak
# NSY Website

echo "🚀 Préparation du déploiement NSY Website pour Infomaniak..."

# Créer le dossier de déploiement
mkdir -p deploy

# Copier tous les fichiers nécessaires
echo "📁 Copie des fichiers..."
cp index.html deploy/
cp sitemap.xml deploy/
cp .htaccess deploy/
cp robots.txt deploy/
cp -r css deploy/
cp -r js deploy/
cp -r public deploy/

# Vérifier les fichiers essentiels
echo "✅ Vérifications..."

files_required=("deploy/index.html" "deploy/sitemap.xml" "deploy/.htaccess" "deploy/robots.txt" "deploy/public/video.mp4" "deploy/public/nsy-logo.png" "deploy/css/style.css" "deploy/js/app.js")

for file in "${files_required[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file - OK"
    else
        echo "❌ $file - MANQUANT"
    fi
done

# Tailles des fichiers
echo ""
echo "📊 Tailles des assets:"
du -h deploy/public/video.mp4 2>/dev/null | awk '{print "Vidéo: " $1}'
du -h deploy/public/nsy-logo.png 2>/dev/null | awk '{print "Logo: " $1}'
du -h deploy/css/style.css 2>/dev/null | awk '{print "CSS: " $1}'
du -h deploy/js/app.js 2>/dev/null | awk '{print "JavaScript: " $1}'

# Taille totale
total_size=$(du -sh deploy/ | awk '{print $1}')
echo "Total dossier deploy: $total_size"

echo ""
echo "📋 Instructions finales:"
echo "1. Uploadez le contenu du dossier 'deploy/' dans public_html/"
echo "2. Vérifiez que .htaccess est bien uploadé"
echo "3. Testez https://votre-domaine.ch"
echo ""
echo "🎉 Site prêt pour Infomaniak !"