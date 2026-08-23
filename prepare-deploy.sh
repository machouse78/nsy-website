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
cp services.html         deploy/
cp a-propos.html         deploy/
cp contact.html          deploy/
cp conception-3d.html    deploy/
cp faq.html              deploy/
cp expertise-migration-java-ee.html    deploy/
cp expertise-wildfly-jboss.html        deploy/
cp expertise-openshift-kubernetes.html deploy/
cp expertise-kafka-messagerie.html     deploy/
cp conformite-dora.html                deploy/
cp integration-claude-entreprise.html  deploy/
cp creation-site-ia.html               deploy/
cp glossaire-ia-web.html               deploy/
cp contact.php           deploy/
cp faisabilite.php       deploy/
cp chat.php              deploy/
cp antispam.php          deploy/   # filtre anti-spam partage (contact + faisabilite)
cp journal-stats.php     deploy/   # compteurs vues / j'aime du journal
cp sitemap.xml           deploy/
cp robots.txt            deploy/
# favicon.ico : emplacement historique interrogé par Google en secours du
# <link rel="icon">. Sans cette ligne il n'est jamais déployé (vécu 20/08/2026).
cp favicon.ico           deploy/
cp llms.txt              deploy/
cp llms-full.txt         deploy/
cp feed.xml              deploy/   # flux RSS du journal (FR)
cp feed-en.xml           deploy/   # flux RSS du journal (EN)
cp d41a70502f0e94a59a054e4eecc623c8.txt deploy/   # clé IndexNow (ping Bing après deploy)
cp .htaccess             deploy/

echo "📁 Copie des fichiers racine (EN)..."
cp index-en.html             deploy/
cp legal-notice.html  deploy/
cp privacy.html   deploy/
cp feasibility.html   deploy/
cp portfolio.html   deploy/
cp services-en.html deploy/
cp about.html       deploy/
cp contact-en.html  deploy/
cp 3d-design.html   deploy/
cp faq-en.html    deploy/
cp java-ee-migration.html           deploy/
cp wildfly-jboss-expert.html        deploy/
cp openshift-kubernetes-expert.html deploy/
cp kafka-messaging-expert.html      deploy/
cp dora-compliance.html             deploy/
cp claude-integration.html          deploy/
cp ai-website-creation.html         deploy/
cp ai-web-glossary.html             deploy/
cp blog.html                        deploy/
cp blog-en.html                     deploy/
cp seo-geo-etre-cite-par-les-ia.html deploy/
cp chatbot-ia-forum-base-de-connaissances.html deploy/
cp seo-geo-getting-cited-by-ai.html deploy/
cp ai-chatbot-forum-knowledge-base.html deploy/
cp superviser-production-teraoctets-megaoctet.html deploy/
cp production-monitoring-terabytes-megabyte.html deploy/
cp site-ia-en-un-week-end.html deploy/
cp ai-website-in-a-weekend.html deploy/
cp stats-collector.php deploy/
mkdir -p deploy/stats
cp stats/.htaccess stats/index.html stats/data.php stats/html2canvas.min.js deploy/stats/
[ -f stats/partage.html ] && cp stats/partage.html deploy/stats/   # page « Partager » (kits par groupe)
cp consultant-technique-paris.html  deploy/
cp technical-consultant-paris.html  deploy/
cp 404.html                            deploy/   # page d'erreur dédiée (ErrorDocument 404)
cp creation-site-internet-loiret.html  deploy/
cp creation-site-internet-orleans.html deploy/
cp creation-site-internet-tours.html deploy/
cp creation-site-internet-paris.html deploy/
cp creation-site-internet-lyon.html deploy/
cp creation-site-internet-bordeaux.html deploy/
cp refonte-site-internet.html deploy/
cp pourquoi-nsy.html                deploy/
cp website-creation-loiret.html     deploy/
cp website-creation-orleans.html    deploy/
cp website-creation-tours.html    deploy/
cp website-creation-paris.html    deploy/
cp website-creation-lyon.html    deploy/
cp website-creation-bordeaux.html    deploy/
cp website-redesign.html           deploy/
cp why-nsy.html                     deploy/

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
cp _secret/ai.php.example     deploy/_secret/
cp _secret/kpi.php.example    deploy/_secret/
if [ -f _secret/kpi.php ] && ! grep -q "CHANGE_ME" _secret/kpi.php; then
  cp _secret/kpi.php deploy/_secret/
else
  echo "  🛡  _secret/kpi.php absent ou incomplet — NON expédié (collecteur KPI inactif)."
fi
if [ -f _secret/.htpasswd ]; then
  cp _secret/.htpasswd deploy/_secret/
fi
if [ -f _secret/config.php ]; then
  if grep -q "CHANGE_ME_SET_THE_TURNSTILE_SECRET_KEY" _secret/config.php; then
    # Garde-fou (13/08/2026) : la clé Turnstile a été posée DIRECTEMENT sur le
    # serveur ; expédier une config locale encore en CHANGE_ME l'écraserait et
    # redésactiverait le captcha en silence (vécu — c'est comme ça qu'il est
    # tombé). L'upload FTP n'efface rien à distance : ne pas copier = le
    # serveur garde sa config complète.
    echo "  🛡  _secret/config.php local INCOMPLET (turnstile_secret=CHANGE_ME) — NON expédié, le serveur garde sa config."
  else
    cp _secret/config.php deploy/_secret/
  fi
else
  echo "  ⚠️  _secret/config.php absent — le formulaire ne fonctionnera PAS sans ce fichier."
fi

# ───── Public : on ne copie QUE les assets réellement utilisés ─────
echo "📁 Copie des assets utilisés (public/)..."
mkdir -p deploy/public

# Images
cp public/nsy-logo.png                  deploy/public/
cp public/nsy-og.jpg                    deploy/public/
cp public/nsy-hero-poster.jpg           deploy/public/   # vignette OPAQUE du hero (GSC refuse l'alpha)
cp public/photo-profil.jpg              deploy/public/
cp public/finance-assurance.png         deploy/public/
cp public/finance-assurance.webp        deploy/public/   # version allégée (-90%) chargée par les pages
cp public/web-ia.png                    deploy/public/
cp public/web-ia.webp                   deploy/public/   # (les .png restent : thumbnails du video sitemap)
cp public/prv-concept.jpg               deploy/public/
cp public/cropped-NSY-logo-32x32.png    deploy/public/
cp public/cropped-NSY-logo-180x180.png  deploy/public/
cp public/cropped-NSY-logo-192x192.png  deploy/public/
cp public/cropped-NSY-logo-270x270.png  deploy/public/

# Vidéos
cp public/nsy-hero.mp4                  deploy/public/
cp public/finance-assurance.mp4         deploy/public/
cp public/web-ia.mp4                    deploy/public/
cp public/prv-concept.mp4               deploy/public/   # apercu anime PRV Concept (page realisations)
cp public/le-cerf-thym.jpg              deploy/public/   # poster Le Cerf Thym (page realisations)
cp public/le-cerf-thym.mp4              deploy/public/   # apercu anime Le Cerf Thym (page realisations)
cp public/seo-geo-thumb.jpg             deploy/public/   # poster vignette animee du journal
cp public/seo-geo-thumb.mp4             deploy/public/   # vignette ANIMEE des cartes du journal
cp public/seo-geo-article.jpg           deploy/public/   # infographie FR dans l'article (+ OG)
cp public/seo-geo-article-en.jpg        deploy/public/   # infographie EN dans l'article (+ OG)
cp public/chatbot-forum-thumb.jpg       deploy/public/   # poster vignette article chatbot & forum
cp public/chatbot-forum-thumb.mp4       deploy/public/   # vignette ANIMEE article chatbot & forum
cp public/chatbot-forum-article.jpg     deploy/public/   # infographie FR article chatbot & forum (+ OG)
cp public/chatbot-forum-article-en.jpg  deploy/public/   # infographie EN article chatbot & forum (+ OG)
cp public/weekend-site-thumb.jpg        deploy/public/   # poster vignette article site IA week-end
cp public/weekend-site-thumb.mp4        deploy/public/   # vignette ANIMEE article site IA week-end
cp public/weekend-site-article.jpg      deploy/public/   # infographie FR article site IA week-end (+ OG)
cp public/weekend-site-article-en.jpg   deploy/public/   # infographie EN article site IA week-end (+ OG)
cp public/weekend-site-video.mp4        deploy/public/   # video pleine res article week-end (publication Facebook)
cp public/supervision-thumb.jpg         deploy/public/   # poster vignette article supervision
cp public/supervision-thumb.mp4         deploy/public/   # vignette ANIMEE article supervision
cp public/supervision-article.jpg       deploy/public/   # infographie FR article supervision (+ OG)
cp public/supervision-article-en.jpg    deploy/public/   # infographie EN article supervision (+ OG)
cp public/supervision-video.mp4         deploy/public/   # video pleine res article supervision (publication Facebook)
cp public/nsy-about.mp4                 deploy/public/   # portrait anime (page A propos)
cp public/ansley.mp4                    deploy/public/   # avatar chatbot (Ansley visage, boomerang)
cp public/ansley.png                    deploy/public/   # poster Ansley visage (avatars messages)
cp public/ansley-fab.mp4                deploy/public/   # mascotte FAB (Ansley buste + logo, boomerang)
cp public/ansley-fab.png                deploy/public/   # poster Ansley buste (FAB)
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
  "deploy/services.html"
  "deploy/services-en.html"
  "deploy/a-propos.html"
  "deploy/about.html"
  "deploy/contact.html"
  "deploy/contact-en.html"
  "deploy/conception-3d.html"
  "deploy/3d-design.html"
  "deploy/faq.html"
  "deploy/faq-en.html"
  "deploy/expertise-migration-java-ee.html"
  "deploy/expertise-wildfly-jboss.html"
  "deploy/expertise-openshift-kubernetes.html"
  "deploy/expertise-kafka-messagerie.html"
  "deploy/conformite-dora.html"
  "deploy/integration-claude-entreprise.html"
  "deploy/creation-site-ia.html"
  "deploy/glossaire-ia-web.html"
  "deploy/java-ee-migration.html"
  "deploy/wildfly-jboss-expert.html"
  "deploy/openshift-kubernetes-expert.html"
  "deploy/kafka-messaging-expert.html"
  "deploy/dora-compliance.html"
  "deploy/claude-integration.html"
  "deploy/ai-website-creation.html"
  "deploy/ai-web-glossary.html"
  "deploy/contact.php"
  "deploy/faisabilite.php"
  "deploy/chat.php"
  "deploy/antispam.php"
  "deploy/sitemap.xml"
  "deploy/robots.txt"
  "deploy/llms.txt"
  "deploy/llms-full.txt"
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
  "deploy/public/photo-profil.jpg"
  "deploy/public/nsy-about.mp4"
  "deploy/public/ansley.mp4"
  "deploy/public/ansley.png"
  "deploy/public/ansley-fab.mp4"
  "deploy/public/ansley-fab.png"
  "deploy/public/finance-assurance.png"
  "deploy/public/web-ia.png"
  "deploy/public/prv-concept.jpg"
  "deploy/public/cropped-NSY-logo-32x32.png"
  "deploy/public/cropped-NSY-logo-180x180.png"
  "deploy/public/cropped-NSY-logo-192x192.png"
  "deploy/public/cropped-NSY-logo-270x270.png"
  "deploy/public/nsy-hero.mp4"
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
