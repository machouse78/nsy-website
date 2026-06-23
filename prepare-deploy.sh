#!/bin/bash
# NSY — Préparation déploiement Infomaniak
# Reconstruit le dossier deploy/ avec les fichiers à uploader dans public_html/.

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "🚀 Préparation du déploiement NSY Website pour Infomaniak..."
echo "   Source : $ROOT"

# ───── Nav + footer : resynchronise toutes les pages depuis partials/ ─────
# (source unique ; voir scripts/sync-partials.mjs). Idempotent.
if command -v node >/dev/null 2>&1; then
  node scripts/sync-partials.mjs >/dev/null && echo "🧩 Nav/footer synchronisés depuis partials/"
else
  echo "  ⚠️  node introuvable — nav/footer NON resynchronisés."
  echo "      Après édition de partials/, lance : node scripts/sync-partials.mjs"
fi

# Reset propre — MAIS on préserve les miroirs non versionnés de l'ancien site
# (old-wp, boutique, forum, _old) qui doivent rester dans deploy/ pour l'upload
# FTP. On vide donc deploy/ de tout SAUF ces dossiers.
mkdir -p deploy
find deploy -mindepth 1 -maxdepth 1 \
  ! -name 'old-wp' ! -name 'boutique' ! -name 'forum' ! -name '_old' \
  -exec rm -rf {} +

# ───── Fichiers racine ─────
echo "📁 Copie des fichiers racine (FR)..."
cp index.html            deploy/
cp mentions-legales.html deploy/
cp confidentialite.html  deploy/
cp faisabilite.html      deploy/
cp realisations.html     deploy/
cp contact.php           deploy/
cp faisabilite.php       deploy/
cp sitemap.xml           deploy/
cp robots.txt            deploy/
cp .htaccess             deploy/

echo "📁 Copie des fichiers racine (EN)..."
cp index-en.html             deploy/
cp legal-notice.html  deploy/
cp privacy.html   deploy/
cp feasibility.html   deploy/
cp portfolio.html   deploy/

# ───── Dossiers CSS, JS, vendor (PHPMailer) ─────
echo "📁 Copie de css/, js/, vendor/..."
cp -R css deploy/
cp -R js  deploy/
cp -R vendor deploy/

# ───── Secrets (gitignored, mais copiés dans deploy/ pour upload FTP) ─────
echo "📁 Copie de _secret/ (credentials SMTP)..."
mkdir -p deploy/_secret
cp _secret/.htaccess          deploy/_secret/
cp _secret/config.php.example deploy/_secret/
if [ -f _secret/config.php ]; then
  cp _secret/config.php deploy/_secret/
else
  echo "  ⚠️  _secret/config.php absent — le formulaire ne fonctionnera PAS sans ce fichier."
fi

# ───── Public : on ne copie QUE les assets réellement utilisés ─────
echo "📁 Copie des assets utilisés (public/)..."
mkdir -p deploy/public

# Images
cp public/nsy-logo.png                  deploy/public/
cp public/nsy-og.jpg                    deploy/public/
cp public/photo-profil.png              deploy/public/
cp public/finance-assurance.png         deploy/public/
cp public/web-ia.png                    deploy/public/
cp public/prv-concept.jpg               deploy/public/
cp public/cropped-NSY-logo-32x32.png    deploy/public/
cp public/cropped-NSY-logo-180x180.png  deploy/public/
cp public/cropped-NSY-logo-192x192.png  deploy/public/
cp public/cropped-NSY-logo-270x270.png  deploy/public/

# Vidéos
cp public/nsy-ia.mp4                    deploy/public/
cp public/finance-assurance.mp4         deploy/public/
cp public/web-ia.mp4                    deploy/public/
# Note: public/animation.mp4 n'est plus déployée — l'animation 3D de la
# section Loisirs est désormais une intégration YouTube (chaîne NSY).

# Modèles 3D
cp public/renault-wireframe.glb         deploy/public/

# ───── Nettoyage ─────
find deploy -name ".DS_Store" -delete 2>/dev/null || true

# ───── Vérification des fichiers requis ─────
echo ""
echo "✅ Vérification des fichiers requis..."

required=(
  "deploy/index.html"
  "deploy/mentions-legales.html"
  "deploy/confidentialite.html"
  "deploy/index-en.html"
  "deploy/legal-notice.html"
  "deploy/privacy.html"
  "deploy/faisabilite.html"
  "deploy/feasibility.html"
  "deploy/realisations.html"
  "deploy/portfolio.html"
  "deploy/contact.php"
  "deploy/faisabilite.php"
  "deploy/sitemap.xml"
  "deploy/robots.txt"
  "deploy/.htaccess"
  "deploy/css/style.css"
  "deploy/js/app.js"
  "deploy/js/faisabilite.js"
  "deploy/vendor/PHPMailer/src/PHPMailer.php"
  "deploy/vendor/PHPMailer/src/SMTP.php"
  "deploy/vendor/PHPMailer/src/Exception.php"
  "deploy/_secret/.htaccess"
  "deploy/_secret/config.php"
  "deploy/public/nsy-logo.png"
  "deploy/public/nsy-og.jpg"
  "deploy/public/photo-profil.png"
  "deploy/public/finance-assurance.png"
  "deploy/public/web-ia.png"
  "deploy/public/prv-concept.jpg"
  "deploy/public/cropped-NSY-logo-32x32.png"
  "deploy/public/cropped-NSY-logo-180x180.png"
  "deploy/public/cropped-NSY-logo-192x192.png"
  "deploy/public/cropped-NSY-logo-270x270.png"
  "deploy/public/nsy-ia.mp4"
  "deploy/public/finance-assurance.mp4"
  "deploy/public/web-ia.mp4"
  "deploy/public/renault-wireframe.glb"
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
