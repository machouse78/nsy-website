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

# ───── Pré-vérification Turnstile (02/09/2026) ─────
# Cloudflare avait cessé d'accepter la clé secrète et chaque humain recevait une
# 403 sur les formulaires. Depuis, formulaires.php contourne le contrôle quand la
# clé est rejetée ; ici on le DIT à chaque déploiement, pour ne jamais l'oublier.
if [ -f _secret/config.php ] && command -v python3 >/dev/null; then
  ts_verdict="$(python3 - <<'PY'
import re, urllib.request, urllib.parse, json
c = open('_secret/config.php', encoding='utf-8').read()
m = re.search(r"'turnstile_secret'\s*=>\s*'([^']*)'", c)
sec = m.group(1) if m else ''
if not sec or sec.startswith('CHANGE_ME'):
    print('absente'); raise SystemExit
try:
    d = urllib.parse.urlencode({'secret': sec, 'response': 'sonde-deploy-nsy'}).encode()
    r = urllib.request.urlopen(urllib.request.Request('https://challenges.cloudflare.com/turnstile/v0/siteverify', d), timeout=10)
    codes = json.load(r).get('error-codes', [])
except Exception as e:
    try: codes = json.load(e).get('error-codes', [])
    except Exception: codes = ['injoignable']
print('saine' if codes == ['invalid-input-response'] else ','.join(map(str, codes)) or 'inconnu')
PY
)"
  case "$ts_verdict" in
    saine)   echo "🛡  Clé Turnstile : acceptée par Cloudflare." ;;
    absente) echo "⚠️  Clé Turnstile absente de _secret/config.php local — vérification impossible ici." ;;
    *)       echo "🚨 CLÉ TURNSTILE REJETÉE PAR CLOUDFLARE ($ts_verdict) : les formulaires fonctionnent en mode dégradé (anti-bot contourné)."
             echo "   → Cloudflare > Turnstile > widget nsy.fr : régénérer la clé secrète, la reporter dans _secret/config.php, puis relancer ./deploy.sh" ;;
  esac
fi

echo "🔄 Reconstruction de deploy/ ..."
pdlog="$(mktemp)"
if ! ./prepare-deploy.sh >"$pdlog" 2>&1; then
  # prepare-deploy sort en 1 si un fichier requis manque. Le seul toléré ici est
  # _secret/config.php (absent en local, présent sur le serveur ; et de toute
  # façon _secret/ est exclu de l'envoi). Tout autre manquant => abandon.
  if grep "MANQUANT" "$pdlog" | grep -qv "_secret/config.php"; then
    echo "❌ prepare-deploy : fichier(s) requis manquant(s) (hors _secret/) :"
    grep "MANQUANT" "$pdlog"; rm -f "$pdlog"; exit 1
  fi
  echo "  ⚠️  _secret/config.php absent en local (normal) — exclu de l'envoi, on continue."
fi
rm -f "$pdlog"
echo "🚀 Envoi FTPS (connexion unique) vers ${FTP_HOST}/${base} ..."

# Une SEULE connexion FTPS pour tous les fichiers (un curl par fichier
# déclenchait le 450 anti-flood d'Infomaniak). Le script Python gère les
# exclusions (_secret/, old-wp/, miroirs) et n'efface jamais rien côté serveur.
# Les identifiants sont déjà exportés (set -a; source) → lus depuis l'env.
python3 scripts/ftp-deploy.py

echo "   Vérifie : https://www.nsy.fr"
