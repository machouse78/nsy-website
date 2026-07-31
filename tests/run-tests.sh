#!/bin/bash
# NSY — suite de tests unitaires (chatbot). À lancer AVANT tout commit qui
# touche chat.php ou js/app.js :   ./tests/run-tests.sh
set -e
cd "$(dirname "$0")/.."
echo "── Lint ──"
node --check js/app.js && echo "  ✓ js/app.js"
docker run --rm -v "$PWD:/app" php:8.3-cli-alpine php -l /app/chat.php | sed 's/^/  ✓ /'
echo "── mdToHtml (js/app.js, code réel) ──"
node tests/mdtohtml.test.mjs
echo "── nsy_sanitize_reply (chat.php, code réel) ──"
docker run --rm -v "$PWD:/app" php:8.3-cli-alpine php /app/tests/chat-sanitize.test.php
echo "✅ SUITE COMPLÈTE OK"
