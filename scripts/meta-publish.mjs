#!/usr/bin/env node
/**
 * meta-publish.mjs — publication automatique d'un article du journal sur la
 * page Facebook NSY via l'API Graph : le POST (sans lien), puis le PREMIER
 * COMMENTAIRE portant les backlinks vers nsy.fr (règle owner, août 2026 —
 * les algorithmes dépriorisent les posts à lien externe ; le 1ᵉʳ commentaire
 * préserve la portée ET le backlink). Cycle complet : skills/journal-nsy.
 *
 *   node scripts/meta-publish.mjs check                      → vérifie token + page (aucune écriture)
 *   node scripts/meta-publish.mjs smoke                      → post NON PUBLIÉ créé puis supprimé (invisible au public)
 *   node scripts/meta-publish.mjs post -p post.txt -c comment.txt          → RÉPÉTITION (dry-run, n'écrit rien)
 *   node scripts/meta-publish.mjs post -p post.txt -c comment.txt --go     → publie réellement post + 1ᵉʳ commentaire
 *
 * Credentials dans _secret/meta.env (gitignoré, local uniquement — jamais
 * déployé, jamais commité ; modèle : _secret/meta.env.example). Le token
 * n'est JAMAIS affiché. Publier est une action PUBLIQUE : `post --go` ne se
 * lance que sur demande explicite du propriétaire.
 *
 * Garde-fous codés (le serveur garantit, le prompt propose) :
 *   - lien http(s) ou nsy.fr dans le CORPS du post → refus (--allow-link-in-body pour outrepasser) ;
 *   - 1ᵉʳ commentaire sans backlink nsy.fr → refus (c'est sa raison d'être).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── Credentials ───────────────────────────────────────────────────────────────
function loadEnv() {
  let raw;
  try {
    raw = readFileSync(join(ROOT, '_secret', 'meta.env'), 'utf8');
  } catch {
    die("_secret/meta.env introuvable — copier _secret/meta.env.example et le remplir (voir skills/journal-nsy §3).");
  }
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  for (const k of ['FB_PAGE_ID', 'FB_PAGE_TOKEN']) {
    if (!env[k] || env[k].startsWith('CHANGE_ME')) die(`_secret/meta.env : ${k} manquant ou encore sur CHANGE_ME.`);
  }
  env.FB_GRAPH_VERSION = env.FB_GRAPH_VERSION || 'v21.0';
  return env;
}

function die(msg) { console.error(`✗ ${msg}`); process.exit(1); }

// ── Appels Graph ──────────────────────────────────────────────────────────────
async function graph(env, method, path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${env.FB_GRAPH_VERSION}/${path}`);
  const body = new URLSearchParams({ ...params, access_token: env.FB_PAGE_TOKEN });
  const res = method === 'GET'
    ? await fetch(`${url}?${body}`)
    : await fetch(url, { method, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    // Message d'erreur Graph sans jamais refléter le token.
    const e = json.error || {};
    die(`Graph ${method} /${path} → ${res.status} ${e.type || ''} (code ${e.code ?? '?'}) : ${e.message || 'réponse illisible'}`);
  }
  return json;
}

// ── Commandes ─────────────────────────────────────────────────────────────────
async function check(env) {
  const me = await graph(env, 'GET', 'me', { fields: 'id,name,link' });
  if (me.id !== env.FB_PAGE_ID) {
    die(`Le token répond pour l'objet ${me.id} (« ${me.name} ») mais FB_PAGE_ID=${env.FB_PAGE_ID} — token de page attendu (me/accounts), pas un token utilisateur.`);
  }
  console.log(`✓ Token de page valide — « ${me.name} » (id ${me.id})\n  ${me.link}`);
}

async function smoke(env) {
  const post = await graph(env, 'POST', `${env.FB_PAGE_ID}/feed`, {
    message: '[test technique NSY] Post non publié créé par scripts/meta-publish.mjs — supprimé immédiatement.',
    published: 'false',
  });
  console.log(`✓ Post NON PUBLIÉ créé (${post.id}) — invisible au public`);
  const del = await graph(env, 'DELETE', post.id);
  if (del.success !== true) die(`Suppression du post de test ${post.id} non confirmée — le supprimer depuis l'admin de la page.`);
  console.log('✓ Post de test supprimé — permissions de publication OK, aucune trace publique');
}

function readText(flagName, args) {
  const i = args.findIndex((a) => a === flagName || a === flagName.slice(1, 3));
  if (i === -1 || !args[i + 1]) die(`option ${flagName} <fichier> requise`);
  const txt = readFileSync(args[i + 1], 'utf8').trim();
  if (!txt) die(`${args[i + 1]} est vide`);
  return txt;
}

async function post(env, args) {
  const body = readText('--post-file', args);
  const comment = readText('--comment-file', args);
  const go = args.includes('--go');

  // Garde-fous — règle owner : les backlinks vivent dans le 1ᵉʳ commentaire.
  if (!args.includes('--allow-link-in-body') && /(https?:\/\/|nsy\.fr)/i.test(body)) {
    die('Le CORPS du post contient un lien — la règle veut les backlinks dans le 1ᵉʳ commentaire. (--allow-link-in-body pour outrepasser sciemment.)');
  }
  if (!/nsy\.fr/i.test(comment)) {
    die("Le 1ᵉʳ commentaire ne contient aucun lien nsy.fr — c'est sa raison d'être (backlinks vers l'article).");
  }

  console.log(`── POST (${body.length} car.) ──\n${body}\n── 1ᵉʳ COMMENTAIRE (${comment.length} car.) ──\n${comment}\n`);
  if (!go) {
    console.log('Répétition (dry-run) : rien n\'a été publié. Relancer avec --go pour publier réellement.');
    return;
  }

  const created = await graph(env, 'POST', `${env.FB_PAGE_ID}/feed`, { message: body });
  console.log(`✓ Post publié (${created.id})`);
  const com = await graph(env, 'POST', `${created.id}/comments`, { message: comment });
  console.log(`✓ 1ᵉʳ commentaire posté (${com.id})`);
  const perma = await graph(env, 'GET', created.id, { fields: 'permalink_url' });
  console.log(`\nURL de la publication (pour le câblage §4 du skill journal-nsy) :\n${perma.permalink_url}`);
}

// ── Entrée ────────────────────────────────────────────────────────────────────
const [cmd, ...args] = process.argv.slice(2);
const env = loadEnv();
if (cmd === 'check') await check(env);
else if (cmd === 'smoke') await smoke(env);
else if (cmd === 'post') await post(env, args);
else die('commande attendue : check | smoke | post (voir l\'en-tête du script)');
