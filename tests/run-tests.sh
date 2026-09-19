#!/bin/bash
# NSY — suite de tests unitaires (chatbot). À lancer AVANT tout commit qui
# touche chat.php ou js/app.js :   ./tests/run-tests.sh
set -e
cd "$(dirname "$0")/.."
echo "── Lint ──"
node --check js/app.js && echo "  ✓ js/app.js"
docker run --rm -v "$PWD:/app" php:8.3-cli-alpine sh -c 'php -l /app/chat.php && php -l /app/contact.php && php -l /app/faisabilite.php && php -l /app/antispam.php && php -l /app/formulaires.php && php -l /app/journal-stats.php && php -l /app/newsletter.php' | sed 's/^/  ✓ /'
python3 -B -c 'import ast, sys; ast.parse(open(sys.argv[1], encoding="utf-8").read())' scripts/newsletter-envoi.py && echo "  ✓ scripts/newsletter-envoi.py"
echo "── mdToHtml (js/app.js, code réel) ──"
node tests/mdtohtml.test.mjs
echo "── nsy_sanitize_reply (chat.php, code réel) ──"
docker run --rm -v "$PWD:/app" php:8.3-cli-alpine php /app/tests/chat-sanitize.test.php
echo "── Turnstile : verdicts et bypass (formulaires.php, code réel) ──"
docker run --rm -v "$PWD:/app" php:8.3-cli-alpine php /app/tests/turnstile.test.php
echo "── Anti-spam (antispam.php, code réel) ──"
docker run --rm -v "$PWD:/app" php:8.3-cli-alpine php /app/tests/antispam.test.php
echo "── Formulaires HTTP (contact.php + faisabilite.php, code réel en bac à sable) ──"
docker run --rm -v "$PWD:/app" php:8.3-cli-alpine php /app/tests/forms-http.test.php
echo "── Newsletter : états, jetons, purge, stockage, garde-fou (newsletter.php, code réel, PHP 8.5) ──"
docker run --rm -v "$PWD:/app" php:8.5-cli-alpine php /app/tests/newsletter.test.php
echo "── Newsletter HTTP : inscrire / confirmer / désinscrire en bac à sable (PHP 8.5, SMTP sur port fermé) ──"
docker run --rm -v "$PWD:/app" php:8.5-cli-alpine php /app/tests/newsletter-http.test.php
echo "── Newsletter : envoi en dry-run, abonnés factices (scripts/newsletter-envoi.py) ──"
python3 -B tests/newsletter-envoi.test.py
echo "── Déploiement FTP : envois atomiques, faux serveur sans réseau (ftp_atomique.py + ftp-deploy.py, code réel) ──"
python3 -B tests/ftp-atomique.test.py
echo "── Ansley : agrandir / réduire le panneau (navigateur réel) ──"
node tests/ansley-plein-ecran.test.mjs
echo "✅ SUITE COMPLÈTE OK"
