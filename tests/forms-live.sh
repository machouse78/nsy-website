#!/bin/bash
# NSY — smoke test PRODUCTION des formulaires, SANS ENVOI D'EMAIL.
# Seuls des chemins de refus sont exercés : 405, honeypot (faux succès
# silencieux, aucun envoi), token Turnstile manquant. À lancer à la demande
# après un déploiement :   ./tests/forms-live.sh [base-url]
set -e
BASE="${1:-https://www.nsy.fr}"
pass=0; fail=0
chk() {
  local name="$1" want="$2" got="$3"
  if [ "$want" = "$got" ]; then echo "  ✓ $name"; pass=$((pass+1))
  else echo "  ✗ $name (attendu: $want · reçu: $got)"; fail=$((fail+1)); fi
}
for f in contact.php faisabilite.php; do
  echo "── $BASE/$f ──"
  chk "GET → 405" 405 "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/$f")"
  chk "honeypot → ok:true silencieux" '{"ok":true}' "$(curl -s -X POST -d 'website=spam&lang=fr' "$BASE/$f")"
  # Champs volontairement INVALIDES : même si Turnstile était désactivé côté
  # serveur, la validation bloque → ce test ne peut JAMAIS envoyer d'email.
  body=$(curl -s -X POST -d 'lang=fr&name=X' "$BASE/$f")
  case "$body" in
    *anti-bot*) echo "  ✓ Turnstile ACTIF côté serveur (token manquant → refus)"; pass=$((pass+1));;
    *invalide*|*Invalid*) echo "  ✗ Turnstile INACTIF côté serveur (la validation de champs a répondu à sa place) — vérifier turnstile_secret dans _secret/config.php"; fail=$((fail+1));;
    *) echo "  ✗ réponse inattendue : $body"; fail=$((fail+1));;
  esac
done
echo
if [ $fail -eq 0 ]; then echo "✅ LIVE SMOKE OK ($pass vérifications, aucun email envoyé)"
else echo "❌ $fail échec(s)"; exit 1; fi
