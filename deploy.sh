#!/bin/bash
# NSY — Déploiement FTP direct (FTPS) vers Infomaniak.
#
# Reconstruit deploy/ puis envoie son contenu sur le serveur FTP, en FTPS
# (chiffré), SANS suppression distante (n'efface jamais _secret/config.php ni
# quoi que ce soit d'autre côté serveur). Déclenché à la demande — rien ne part
# tant qu'on ne lance pas ce script.
#
# Identifiants : lus depuis _secret/ftp.env (gitignoré, comme _secret/config.php).
#   Copie _secret/ftp.env.example -> _secret/ftp.env et renseigne FTP_PASS.
# Le mot de passe est passé à curl via un fichier de config éphémère (process
# substitution) pour ne PAS apparaître dans la liste des processus.
#
# Usage : ./deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

ENVF="_secret/ftp.env"
if [ ! -f "$ENVF" ]; then
  echo "❌ $ENVF manquant. Copie _secret/ftp.env.example -> _secret/ftp.env et renseigne FTP_PASS."
  exit 1
fi
set -a; # shellcheck disable=SC1090
source "$ENVF"; set +a
: "${FTP_HOST:?FTP_HOST manquant dans _secret/ftp.env}"
: "${FTP_USER:?FTP_USER manquant dans _secret/ftp.env}"
if [ -z "${FTP_PASS:-}" ]; then
  echo "❌ FTP_PASS vide dans $ENVF — renseigne ton mot de passe FTP puis relance."
  exit 1
fi
FTP_DIR="${FTP_DIR:-}"
base="${FTP_DIR#/}"; base="${base%/}"; [ -n "$base" ] && base="$base/"

echo "🔄 Reconstruction de deploy/ ..."
./prepare-deploy.sh >/dev/null
echo "🚀 Envoi FTPS vers ${FTP_HOST}/${base} ..."

# On EXCLUT :
#  - deploy/_secret/*  → ne jamais écraser le config.php SMTP du serveur
#    (déjà en place ; à uploader une seule fois à la main lors du 1er setup) ;
#  - les miroirs de l'ancien site (old-wp/_old/boutique/forum) s'ils existent.
sent=0
while IFS= read -r -d '' f; do
  rel="${f#deploy/}"
  curl -sS --ssl-reqd --ftp-create-dirs --connect-timeout 25 \
    -K <(printf 'user = "%s:%s"\n' "$FTP_USER" "$FTP_PASS") \
    -T "$f" "ftp://${FTP_HOST}/${base}${rel}" \
    || { echo "❌ Échec sur ${rel}"; exit 1; }
  sent=$((sent + 1))
  printf '  ↑ %s\n' "$rel"
done < <(find deploy -type f ! -name '.DS_Store' \
           ! -path 'deploy/_secret/*' \
           ! -path 'deploy/old-wp/*' ! -path 'deploy/_old/*' \
           ! -path 'deploy/boutique/*' ! -path 'deploy/forum/*' -print0)

echo "✅ Terminé — ${sent} fichier(s) envoyé(s) vers ${FTP_HOST}/${base}"
echo "   Vérifie : https://www.nsy.fr"
