#!/usr/bin/env node
/**
 * sites-clients.mjs — déduit la liste des SITES CLIENTS du tableau de bord KPI
 * (rubrique « Backlinks clients », constante CLIENTS de stats/index.html) depuis la
 * page Réalisations, source unique.
 *
 * Pourquoi : la liste était une constante tenue à la main — un site livré sans sa
 * ligne n'apparaissait jamais dans les backlinks (owner, 15/10/2026 : « je préfère
 * que la liste se déduise d'elle-même »). Désormais, une carte de realisations.html
 * dont le `.realisation-url` est un NOM DE DOMAINE (www.lecerfthym.fr) entre dans la
 * liste ; les cartes vidéo (« youtube.com/@… », « PRV Concept ») et notre propre
 * site (nsy.fr) sont ignorées. `hote` = domaine sans www. (cherché en sous-chaîne
 * par le dashboard : couvre www. et les sous-domaines).
 *
 *   node scripts/sites-clients.mjs            # réécrit le bloc balisé de stats/index.html
 *   node scripts/sites-clients.mjs --check    # code 1 si le bloc n'est pas à jour
 *
 * Lancé par prepare-deploy.sh ; idempotent.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'realisations.html');
const DST = resolve(ROOT, 'stats/index.html');
const DEBUT = '  // @sites-clients:debut';
const FIN = '  // @sites-clients:fin';
const PROPRE = 'nsy.fr';

const html = readFileSync(SRC, 'utf8');
const cartes = [...html.matchAll(/<div class="realisation-card">([\s\S]*?)<div class="realisation-tags">/g)];
const clients = [];
for (const [, carte] of cartes) {
  const nom = (carte.match(/<h3>([\s\S]*?)<\/h3>/) || [])[1];
  const url = (carte.match(/<span class="realisation-url">([^<]*)<\/span>/) || [])[1];
  if (!nom || !url) continue;
  const texte = url.trim().toLowerCase();
  if (!/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(texte)) continue; // pas un domaine nu
  const hote = texte.replace(/^www\./, '');
  if (hote === PROPRE || hote.endsWith('.' + PROPRE)) continue;
  clients.push({ nom: nom.replace(/<[^>]+>/g, '').replace(/&rsquo;/g, '’').trim(), hote, url: 'https://' + texte });
}
if (!clients.length) { console.error('sites-clients : aucun site client trouvé dans realisations.html — rien réécrit'); process.exit(1); }

const larg = Math.max(...clients.map((c) => c.nom.length + 2));
const lignes = clients.map((c) => `    { nom: ${(`'${c.nom.replace(/'/g, "\\'")}',`).padEnd(larg + 1)} hote: '${c.hote}', url: '${c.url}' },`);
const bloc = [DEBUT,
  '  // Généré par scripts/sites-clients.mjs depuis realisations.html — NE PAS ÉDITER :',
  '  // ajouter un client = sa carte sur la page Réalisations, avec son domaine dans',
  '  // `.realisation-url`. La rubrique « Backlinks clients » lit `ref_hosts`, donc la',
  "  // ligne vaut aussi pour l'historique déjà collecté.",
  '  const CLIENTS = [', ...lignes, '  ];', FIN].join('\n');

const page = readFileSync(DST, 'utf8');
const i = page.indexOf(DEBUT), j = page.indexOf(FIN);
if (i < 0 || j < 0) { console.error(`sites-clients : balises ${DEBUT.trim()} / ${FIN.trim()} introuvables dans stats/index.html`); process.exit(1); }
const apres = page.slice(0, i) + bloc + page.slice(j + FIN.length);
const check = process.argv.includes('--check');
if (apres === page) { console.log(`sites-clients : à jour (${clients.map((c) => c.hote).join(', ')})`); process.exit(0); }
if (check) { console.error('sites-clients : stats/index.html N\'EST PAS à jour — lance node scripts/sites-clients.mjs'); process.exit(1); }
writeFileSync(DST, apres);
console.log(`sites-clients : stats/index.html réécrit (${clients.map((c) => c.hote).join(', ')})`);
