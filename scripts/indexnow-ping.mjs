#!/usr/bin/env node
/**
 * indexnow-ping.mjs — notifie IndexNow (Bing, Seznam, Yandex…) après un déploiement.
 *
 * Bing = l'index derrière ChatGPT Search et Copilot → l'indexation quasi
 * immédiate des pages nouvelles/modifiées sert directement le GEO.
 *
 *   node scripts/indexnow-ping.mjs                → ping TOUTES les URLs du sitemap
 *   node scripts/indexnow-ping.mjs <url> [url...] → ping ciblé
 *
 * À lancer APRÈS ./deploy.sh (le fichier de clé doit être en ligne).
 * La clé vit dans <clé>.txt à la racine du site (déployé) — pas un secret :
 * elle prouve seulement que nous contrôlons le domaine.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = 'd41a70502f0e94a59a054e4eecc623c8';
const HOST = 'www.nsy.fr';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let urls = process.argv.slice(2);
if (!urls.length) {
  const sm = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
  urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}
const payload = {
  host: HOST,
  key: KEY,
  keyLocation: `https://${HOST}/${KEY}.txt`,
  urlList: urls,
};
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});
console.log(`IndexNow: ${urls.length} URLs → HTTP ${res.status} ${res.status === 200 || res.status === 202 ? '✅ (accepté)' : '⚠️ ' + (await res.text())}`);
