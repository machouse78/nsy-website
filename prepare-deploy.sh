#!/bin/bash
# NSY — Préparation déploiement Infomaniak
# Reconstruit le dossier deploy/ avec les fichiers à uploader dans public_html/.

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "🚀 Préparation du déploiement NSY Website pour Infomaniak..."
echo "   Source : $ROOT"

# Reset propre
rm -rf deploy
mkdir -p deploy

# ───── Fichiers racine ─────
echo "📁 Copie des fichiers racine..."
cp index.html            deploy/
cp mentions-legales.html deploy/
cp confidentialite.html  deploy/
cp sitemap.xml           deploy/
cp robots.txt            deploy/
cp .htaccess             deploy/

# ───── Dossiers CSS et JS ─────
echo "📁 Copie de css/ et js/..."
cp -R css deploy/
cp -R js  deploy/

# ───── Public : on ne copie QUE les assets réellement utilisés ─────
echo "📁 Copie des assets utilisés (public/)..."
mkdir -p deploy/public

# Images
cp public/nsy-logo.png                  deploy/public/
cp public/photo-profil.png              deploy/public/
cp public/finance-assurance.png         deploy/public/
cp public/web-ia.png                    deploy/public/
cp public/cropped-NSY-logo-32x32.png    deploy/public/
cp public/cropped-NSY-logo-180x180.png  deploy/public/
cp public/cropped-NSY-logo-192x192.png  deploy/public/
cp public/cropped-NSY-logo-270x270.png  deploy/public/

# Vidéos
cp public/nsy-ia.mp4                    deploy/public/
cp public/finance-assurance.mp4         deploy/public/
cp public/web-ia.mp4                    deploy/public/

# ───── Nettoyage ─────
find deploy -name ".DS_Store" -delete 2>/dev/null || true

# ───── Vérification des fichiers requis ─────
echo ""
echo "✅ Vérification des fichiers requis..."

required=(
  "deploy/index.html"
  "deploy/mentions-legales.html"
  "deploy/confidentialite.html"
  "deploy/sitemap.xml"
  "deploy/robots.txt"
  "deploy/.htaccess"
  "deploy/css/style.css"
  "deploy/js/app.js"
  "deploy/public/nsy-logo.png"
  "deploy/public/photo-profil.png"
  "deploy/public/finance-assurance.png"
  "deploy/public/web-ia.png"
  "deploy/public/cropped-NSY-logo-32x32.png"
  "deploy/public/cropped-NSY-logo-180x180.png"
  "deploy/public/cropped-NSY-logo-192x192.png"
  "deploy/public/cropped-NSY-logo-270x270.png"
  "deploy/public/nsy-ia.mp4"
  "deploy/public/finance-assurance.mp4"
  "deploy/public/web-ia.mp4"
)

missing=0
for f in "${required[@]}"; do
  if [ -f "$f" ]; then
    echo "  ✓ $f"
  else
    echo "  ❌ $f  — MANQUANT"
    missing=$((missing + 1))
  fi
done

# ───── Vérification des références dans index.html ─────
echo ""
echo "🔍 Recherche de références broken dans index.html..."
broken=0
while IFS= read -r ref; do
  if [ ! -e "deploy/$ref" ]; then
    echo "  ⚠️  index.html référence \"$ref\" qui n'existe pas dans deploy/"
    broken=$((broken + 1))
  fi
done < <(grep -oE '(src|href)="(css|js|public)/[^"]+"' deploy/index.html | sed -E 's/.*"([^"]+)".*/\1/' | sort -u)

# ───── Rapport ─────
echo ""
echo "📊 Tailles des assets clés :"
du -h deploy/public/*.mp4 2>/dev/null | awk '{printf "  %-50s %s\n", $2, $1}'
du -h deploy/public/*.png 2>/dev/null | awk '{printf "  %-50s %s\n", $2, $1}'
du -h deploy/css/style.css deploy/js/app.js deploy/index.html 2>/dev/null | awk '{printf "  %-50s %s\n", $2, $1}'

total_size=$(du -sh deploy/ | awk '{print $1}')
file_count=$(find deploy -type f | wc -l | tr -d ' ')

echo ""
echo "📦 Bundle de déploiement :"
echo "  Fichiers : $file_count"
echo "  Taille totale : $total_size"
if [ "$missing" -eq 0 ] && [ "$broken" -eq 0 ]; then
  echo "  Statut : ✅ Prêt pour l'upload"
else
  echo "  Statut : ⚠️  $missing fichier(s) manquant(s), $broken référence(s) cassée(s)"
fi

echo ""
echo "📋 Étapes suivantes :"
echo "  1. Uploader le CONTENU de deploy/ (pas le dossier lui-même) dans public_html/ sur Infomaniak"
echo "  2. Vérifier que .htaccess est bien transféré (souvent caché dans les clients FTP — activez l'affichage des fichiers cachés)"
echo "  3. Tester https://www.nsy.fr"
echo "  4. Soumettre le sitemap dans Google Search Console : https://search.google.com/search-console"
echo "  5. Vérifier robots.txt : https://www.nsy.fr/robots.txt"
echo ""

if [ "$missing" -gt 0 ] || [ "$broken" -gt 0 ]; then
  exit 1
fi
