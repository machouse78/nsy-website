#!/usr/bin/env node
/**
 * meta-publish.mjs — publication automatique d'un article du journal sur la
 * page Facebook NSY via l'API Graph : le POST (sans lien), puis le PREMIER
 * COMMENTAIRE portant les backlinks vers nsy.fr (règle owner, août 2026 —
 * les algorithmes dépriorisent les posts à lien externe ; le 1ᵉʳ commentaire
 * préserve la portée ET le backlink). Cycle complet : skills/journal-nsy.
 *
 *   node scripts/meta-publish.mjs setup                      → depuis un jeton UTILISATEUR COURT (+ app id/secret) :
 *                                                              échange longue durée + jeton de PAGE, écrits dans meta.env
 *   node scripts/meta-publish.mjs check                      → vérifie token + page (aucune écriture)
 *   node scripts/meta-publish.mjs smoke                      → post NON PUBLIÉ créé puis supprimé (invisible au public)
 *   node scripts/meta-publish.mjs post -p post.txt -c comment.txt [--video-url https://…]       → RÉPÉTITION (dry-run)
 *   node scripts/meta-publish.mjs post -p post.txt -c comment.txt [--video-url https://…] --go  → publie réellement
 *   (--video-url : post VIDÉO/réel — règle owner 17/08/2026 : le journal se
 *    publie en vidéo AU FORMAT ORIGINAL, jamais recomposée ; la vidéo doit être
 *    déjà en ligne sur nsy.fr, Meta la télécharge depuis le site.
 *    --image-url : repli photo si l'article n'a pas de déclinaison vidéo.
 *    Dans les deux cas, média montré au owner et validé AVANT --go — jamais de post nu.)
 *
 * Les liens nsy.fr du 1ᵉʳ commentaire sont AUTOMATIQUEMENT tagués UTM
 * (utm_source=facebook&utm_medium=page&utm_campaign=<slug de l'article>) — le
 * dashboard KPI sait alors quelles visites viennent de ce post précis. Facebook
 * ne transmet jamais l'origine réelle d'un clic : c'est le seul moyen.
 * `--no-utm` désactive le tag pour un cas exceptionnel.
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
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = join(ROOT, '_secret', 'meta.env');

// ── Credentials ───────────────────────────────────────────────────────────────
function loadEnv({ requirePage = true } = {}) {
  let raw;
  try {
    raw = readFileSync(ENV_PATH, 'utf8');
  } catch {
    die("_secret/meta.env introuvable — copier _secret/meta.env.example et le remplir (voir skills/journal-nsy §3).");
  }
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  for (const k of Object.keys(env)) if ((env[k] || '').startsWith('CHANGE_ME')) delete env[k];
  if (requirePage) {
    for (const k of ['FB_PAGE_ID', 'FB_PAGE_TOKEN']) {
      if (!env[k]) die(`_secret/meta.env : ${k} manquant — remplir FB_APP_ID + FB_APP_SECRET + FB_USER_TOKEN puis lancer \`setup\`.`);
    }
  }
  env.FB_GRAPH_VERSION = env.FB_GRAPH_VERSION || 'v21.0';
  return env;
}

function die(msg) { console.error(`✗ ${msg}`); process.exit(1); }

/** Tague les liens nsy.fr d'un texte avec les UTM (campagne = slug de la page). */
function tagUtm(text, source, medium) {
  return text.replace(/https:\/\/(?:www\.)?nsy\.fr\/\S*/g, (raw) => {
    const clean = raw.replace(/[.,;:!?)\]]+$/, '');       // ponctuation finale hors URL
    const tail = raw.slice(clean.length);
    try {
      const u = new URL(clean);
      if (u.searchParams.has('utm_source')) return raw;    // déjà tagué
      const file = u.pathname.split('/').pop() || 'accueil';
      const campaign = file.replace(/\.html$/, '') || 'accueil';
      u.searchParams.set('utm_source', source);
      u.searchParams.set('utm_medium', medium);
      u.searchParams.set('utm_campaign', campaign);
      return u.toString() + tail;
    } catch { return raw; }
  });
}

// ── Appels Graph ──────────────────────────────────────────────────────────────
async function graph(env, method, path, params = {}, token = env.FB_PAGE_TOKEN) {
  const url = new URL(`https://graph.facebook.com/${env.FB_GRAPH_VERSION}/${path}`);
  const body = new URLSearchParams(token ? { ...params, access_token: token } : params);
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
/**
 * setup — fait TOUT depuis un jeton utilisateur COURT collé dans meta.env :
 *   1. échange courte → longue durée (oauth/access_token, fb_exchange_token) ;
 *   2. me/accounts → repère la Page NSY (FB_PAGE_ID si présent, sinon nom
 *      contenant « nsy », sinon liste les Pages et s'arrête) ;
 *   3. réécrit _secret/meta.env avec le jeton de PAGE (n'expire pas).
 * Aucun jeton n'est jamais affiché ; le script écrit le fichier lui-même.
 */
async function setup(env) {
  for (const k of ['FB_APP_ID', 'FB_APP_SECRET', 'FB_USER_TOKEN']) {
    if (!env[k]) die(`_secret/meta.env : ${k} manquant pour \`setup\` (app « Journal Auto Publisher » → Paramètres → Général pour id/secret ; Graph Explorer pour le jeton utilisateur court).`);
  }
  const ll = await graph(env, 'GET', 'oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: env.FB_APP_ID,
    client_secret: env.FB_APP_SECRET,
    fb_exchange_token: env.FB_USER_TOKEN,
  }, '');
  console.log(`✓ Jeton utilisateur étendu en longue durée (expire dans ~${Math.round((ll.expires_in || 5184000) / 86400)} j)`);

  const acc = await graph(env, 'GET', 'me/accounts', { fields: 'name,id,access_token', limit: '100' }, ll.access_token);
  const pages = acc.data || [];
  if (!pages.length) die('me/accounts ne renvoie aucune Page — vérifier que le jeton a bien pages_show_list et que la Page NSY a été cochée dans la boîte de dialogue.');

  let page = env.FB_PAGE_ID ? pages.find((p) => p.id === env.FB_PAGE_ID) : null;
  if (!page) {
    const hits = pages.filter((p) => /nsy/i.test(p.name));
    if (hits.length === 1) page = hits[0];
  }
  if (!page && pages.length === 1) page = pages[0];
  if (!page) {
    console.log('Pages accessibles :');
    for (const p of pages) console.log(`  - ${p.name}  (id ${p.id})`);
    die('Impossible de choisir seul — poser FB_PAGE_ID=<id de la Page NSY> dans _secret/meta.env puis relancer `setup`.');
  }

  const stamp = new Date().toISOString().slice(0, 10);
  writeFileSync(ENV_PATH, `# Rempli par \`node scripts/meta-publish.mjs setup\` le ${stamp} — NE PAS committer (gitignoré).
FB_PAGE_ID=${page.id}
FB_PAGE_TOKEN=${page.access_token}

# Conservés pour une éventuelle régénération future (relancer setup avec un
# nouveau FB_USER_TOKEN court si l'API renvoie un jour une erreur code 190) :
FB_APP_ID=${env.FB_APP_ID}
FB_APP_SECRET=${env.FB_APP_SECRET}
FB_USER_TOKEN=
${env.FB_GRAPH_VERSION !== 'v21.0' ? `FB_GRAPH_VERSION=${env.FB_GRAPH_VERSION}\n` : ''}`, { mode: 0o600 });
  console.log(`✓ Jeton de PAGE écrit dans _secret/meta.env pour « ${page.name} » (id ${page.id}) — le jeton utilisateur court a été effacé du fichier`);

  const me = await graph(env, 'GET', 'me', { fields: 'id,name' }, page.access_token);
  if (me.id !== page.id) die('le jeton de Page fraîchement écrit ne répond pas pour la bonne Page — relancer `setup`.');
  console.log(`✓ Vérification : le jeton répond bien pour « ${me.name} ». Prochaine étape : \`node scripts/meta-publish.mjs smoke\``);
}

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
  let comment = readText('--comment-file', args);
  const go = args.includes('--go');
  if (!args.includes('--no-utm')) {
    const tagged = tagUtm(comment, 'facebook', 'page');
    if (tagged !== comment) console.log('ℹ️  liens du 1ᵉʳ commentaire tagués UTM (traçage de la provenance)');
    comment = tagged;
  }
  const iu = args.indexOf('--image-url');
  const imageUrl = iu !== -1 ? args[iu + 1] : null;
  if (iu !== -1 && !/^https:\/\/(www\.)?nsy\.fr\//.test(imageUrl || '')) {
    die('--image-url doit pointer sur une image déjà en ligne sur nsy.fr (déployer d\'abord).');
  }
  const vu = args.indexOf('--video-url');
  const videoUrl = vu !== -1 ? args[vu + 1] : null;
  if (vu !== -1 && !/^https:\/\/(www\.)?nsy\.fr\//.test(videoUrl || '')) {
    die('--video-url doit pointer sur une vidéo déjà en ligne sur nsy.fr (déployer d\'abord).');
  }
  if (imageUrl && videoUrl) die('--image-url et --video-url sont exclusifs.');

  // Garde-fous — règle owner : les backlinks vivent dans le 1ᵉʳ commentaire.
  if (!args.includes('--allow-link-in-body') && /(https?:\/\/|nsy\.fr)/i.test(body)) {
    die('Le CORPS du post contient un lien — la règle veut les backlinks dans le 1ᵉʳ commentaire. (--allow-link-in-body pour outrepasser sciemment.)');
  }
  if (!/nsy\.fr/i.test(comment)) {
    die("Le 1ᵉʳ commentaire ne contient aucun lien nsy.fr — c'est sa raison d'être (backlinks vers l'article).");
  }

  console.log(`── POST (${body.length} car.)${videoUrl ? ` + VIDÉO ${videoUrl}` : imageUrl ? ` + IMAGE ${imageUrl}` : ' — SANS MÉDIA'} ──\n${body}\n── 1ᵉʳ COMMENTAIRE (${comment.length} car.) ──\n${comment}\n`);
  if (!go) {
    console.log('Répétition (dry-run) : rien n\'a été publié. Relancer avec --go pour publier réellement.');
    return;
  }

  let postId;
  if (videoUrl) {
    const created = await graph(env, 'POST', `${env.FB_PAGE_ID}/videos`, { file_url: videoUrl, description: body });
    postId = created.id;
    console.log(`✓ Post VIDÉO publié (${postId})`);
    // ⚠️ L'envoi par file_url est ASYNCHRONE : tant que la vidéo n'est pas
    // « ready », l'objet répond « does not exist » et le commentaire échoue
    // (vécu 23/08/2026 : post publié, commentaire perdu). On attend donc la fin
    // du traitement — en général moins d'une minute — avant de commenter.
    for (let i = 0; i < 30; i++) {
      const st = await graph(env, 'GET', postId, { fields: 'status' }).catch(() => null);
      const ph = st?.status?.video_status;
      if (ph === 'ready') break;
      if (ph === 'error') throw new Error('traitement vidéo en erreur côté Facebook');
      await new Promise((r) => setTimeout(r, 5000));
    }
  } else if (imageUrl) {
    const created = await graph(env, 'POST', `${env.FB_PAGE_ID}/photos`, { url: imageUrl, message: body });
    postId = created.post_id || created.id;
    console.log(`✓ Post PHOTO publié (${postId})`);
  } else {
    const created = await graph(env, 'POST', `${env.FB_PAGE_ID}/feed`, { message: body });
    postId = created.id;
    console.log(`✓ Post publié (${postId})`);
  }
  const com = await graph(env, 'POST', `${postId}/comments`, { message: comment });
  console.log(`✓ 1ᵉʳ commentaire posté (${com.id})`);
  const perma = await graph(env, 'GET', postId, { fields: 'permalink_url' });
  let purl = perma.permalink_url || '';
  if (purl.startsWith('/')) purl = 'https://www.facebook.com' + purl;
  console.log(`\nURL de la publication (pour le câblage §4 du skill journal-nsy) :\n${purl}`);
}

// ── Entrée ────────────────────────────────────────────────────────────────────
const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'setup') await setup(loadEnv({ requirePage: false }));
else if (cmd === 'check') await check(loadEnv());
else if (cmd === 'smoke') await smoke(loadEnv());
else if (cmd === 'post') await post(loadEnv(), args);
else die('commande attendue : setup | check | smoke | post (voir l\'en-tête du script)');
