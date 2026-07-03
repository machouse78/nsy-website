// NSY — Capture automatisée d'une vignette de réalisation client.
//
// Rend le site cible dans un Chrome headless (layout desktop 1440px),
// attend que la page soit posée, et écrit un JPEG déjà à la taille
// d'affichage des cartes .realisation-card (~1100px de large = ~2× la
// largeur affichée, net sur écran Retina sans gonfler le poids).
//
// La vignette reste un fichier statique servi aux visiteurs (zéro coût
// runtime) — relancer ce script rafraîchit simplement l'image :
//
//   npm run capture:realisations
//   node scripts/capture-realisation.mjs <url> <sortie.jpg> [largeur-sortie]
//
// Astuce : pas de dépendance de resize (sharp…) — le deviceScaleFactor
// fractionnaire fait le ré-échantillonnage directement au rendu.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node scripts/capture-realisation.mjs <url> <sortie.jpg> [largeur-sortie=1100]');
  process.exit(1);
}
const [URL_CIBLE, SORTIE] = args;
const OUT_WIDTH = parseInt(args[2] || '1100', 10);

// Layout desktop de référence ; l'image sort en OUT_WIDTH × (ratio 16/10).
const RENDER_W = 1440;
const RENDER_H = 900;

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
try {
  const page = await browser.newPage();
  await page.setViewport({
    width: RENDER_W,
    height: RENDER_H,
    deviceScaleFactor: OUT_WIDTH / RENDER_W, // ré-échantillonnage au rendu
  });
  console.log(`[capture] ${URL_CIBLE} → ${SORTIE} (${OUT_WIDTH}px de large)`);
  await page.goto(URL_CIBLE, { waitUntil: 'networkidle2', timeout: 60000 });
  // Laisse retomber les animations d'entrée / lazy-load du haut de page.
  await new Promise((r) => setTimeout(r, 3000));
  await page.screenshot({ path: SORTIE, type: 'jpeg', quality: 82 });
  const kb = Math.round(fs.statSync(SORTIE).size / 1024);
  console.log(`[capture] ✅ ${path.basename(SORTIE)} — ${kb} Ko`);
} finally {
  await browser.close();
}
