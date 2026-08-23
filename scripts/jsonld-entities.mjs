#!/usr/bin/env node
/**
 * jsonld-entities.mjs — entités JSON-LD partagées, depuis une SOURCE UNIQUE.
 *
 * Pourquoi : Google ne suit pas un `{"@id": "…#org"}` d'une page à l'autre.
 * Une page qui RÉFÉRENCE l'organisation ou la personne sans la DÉFINIR pointe
 * vers le vide (audit externe, 24/08/2026 : 18 pages pour #org, 6 pour
 * #person). Plutôt que de recopier un bloc dans 26 fichiers, ce script :
 *
 *   1. lit les nœuds #org et #person COMPLETS sur index.html (source unique)
 *      et en dérive des nœuds COMPACTS (identité, URL, logo, téléphone,
 *      adresse, SIREN, sameAs) ;
 *   2. les injecte dans tout @graph qui les référence sans les définir —
 *      jamais s'ils sont déjà présents (idempotent) ;
 *   3. dote les pages SANS JSON-LD d'un @graph minimal (WebPage +
 *      BreadcrumbList + Organization), et d'un ItemList sur les réalisations ;
 *   4. génère le FAQPage des pages FAQ AU BUILD, statiquement, depuis le HTML
 *      visible (même source que l'ancien générateur JS, désormais retiré) :
 *      lisible sans JavaScript par Bing et les crawlers d'IA, pas seulement
 *      par Googlebot.
 *
 * Usage : node scripts/jsonld-entities.mjs        (appelé par prepare-deploy.sh)
 *         node scripts/jsonld-entities.mjs --check (0 modification attendue)
 * Idempotent : relancer ne change rien tant que les sources sont inchangées.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://www.nsy.fr/';
const CHECK = process.argv.includes('--check');
const RX = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;

// ── 1. Source unique : les nœuds complets de l'accueil ──────────────────────
const home = readFileSync(join(ROOT, 'index.html'), 'utf8');
const homeGraph = JSON.parse([...home.matchAll(RX)][0][1])['@graph'];
const full = (suffix) => homeGraph.find((n) => (n['@id'] || '').endsWith(suffix));
const pick = (n, keys) => Object.fromEntries(keys.filter((k) => k in n).map((k) => [k, n[k]]));
const ORG = pick(full('#org'), ['@type', '@id', 'name', 'legalName', 'url', 'logo', 'telephone', 'email',
  'foundingDate', 'identifier', 'address', 'sameAs']);
const PERSON = pick(full('#person'), ['@type', '@id', 'name', 'jobTitle', 'worksFor', 'image', 'sameAs']);
PERSON.url = SITE + 'a-propos.html';

// ── Pages sans JSON-LD : libellés du fil d'Ariane ───────────────────────────
const BARE = {
  'realisations.html':     { fr: true,  crumb: 'Réalisations',               list: true },
  'portfolio.html':        { fr: false, crumb: 'Work',                       list: true },
  'faisabilite.html':      { fr: true,  crumb: 'Demande de faisabilité' },
  'feasibility.html':      { fr: false, crumb: 'Feasibility request' },
  'mentions-legales.html': { fr: true,  crumb: 'Mentions légales' },
  'legal-notice.html':     { fr: false, crumb: 'Legal notice' },
  'confidentialite.html':  { fr: true,  crumb: 'Politique de confidentialité' },
  'privacy.html':          { fr: false, crumb: 'Privacy policy' },
};
const REALISATIONS = [
  { name: 'PRV Concept', url: 'https://www.prv-concept.com/' },
  { name: 'Le Cerf Thym', url: 'https://www.lecerfthym.fr/' },
];
const FAQ_PAGES = { 'faq.html': 'fr', 'faq-en.html': 'en' };

const refs = (obj, acc = new Set()) => {
  if (Array.isArray(obj)) obj.forEach((v) => refs(v, acc));
  else if (obj && typeof obj === 'object') {
    const k = Object.keys(obj);
    if (k.length === 1 && k[0] === '@id') acc.add(obj['@id']);
    else k.forEach((key) => refs(obj[key], acc));
  }
  return acc;
};
const defines = (graph, id) => graph.some((n) => n['@id'] === id);
const text = (h) => h.replace(/<[^>]+>/g, '').replace(/&rsquo;/g, '’').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&agrave;/g, 'à')
  .replace(/&ecirc;/g, 'ê').replace(/&ucirc;/g, 'û').replace(/\s+/g, ' ').trim();

function faqNode(html, lang, url) {
  const start = html.indexOf('class="legal-page faq"');
  const end = html.indexOf('</article>', start);
  const zone = html.slice(start, end);
  const items = [...zone.matchAll(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)].map((m) => ({
    '@type': 'Question', name: text(m[1]),
    acceptedAnswer: { '@type': 'Answer', text: text(m[2]) },
  }));
  return { '@type': 'FAQPage', '@id': url + '#faq', inLanguage: lang, mainEntity: items };
}

let changed = 0;
for (const file of readdirSync(ROOT).filter((f) => f.endsWith('.html') && f !== '404.html')) {
  const path = join(ROOT, file);
  let html = readFileSync(path, 'utf8');
  const before = html;
  const url = SITE + (file === 'index.html' ? '' : file);
  const lang = /<html lang="en"/.test(html) ? 'en' : 'fr';
  const blocks = [...html.matchAll(RX)];

  if (blocks.length === 0 && BARE[file]) {
    const b = BARE[file];
    const title = text((html.match(/<title>([^<]*)/) || [, file])[1]).replace(/\s*[—|-]\s*NSY\s*$/, '');
    const graph = [
      ORG,
      { '@type': 'WebPage', '@id': url + '#page', url, name: title, inLanguage: lang,
        isPartOf: { '@type': 'WebSite', '@id': SITE + '#website', url: SITE, name: 'NSY' },
        about: { '@id': ORG['@id'] } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: b.fr ? 'Accueil' : 'Home', item: b.fr ? SITE : SITE + 'index-en.html' },
        { '@type': 'ListItem', position: 2, name: b.crumb, item: url } ] },
    ];
    if (b.list) graph.push({ '@type': 'ItemList', '@id': url + '#list', name: b.crumb,
      itemListElement: REALISATIONS.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.name, url: r.url })) });
    const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
    html = html.replace('</head>', `<script type="application/ld+json">\n${json}\n</script>\n</head>`);
  } else if (blocks.length) {
    // Premier bloc = graphe principal de la page.
    const m = blocks[0];
    let data;
    try { data = JSON.parse(m[1]); } catch (e) { console.error(`✗ ${file} : JSON-LD invalide (${e.message})`); process.exitCode = 1; continue; }
    // Un bloc « nœud seul » (sans @graph) devient un @graph dès qu'on y ajoute
    // quelque chose — sinon le nouveau nœud serait perdu à la réécriture.
    const single = !data['@graph'];
    const graph = single ? [Object.fromEntries(Object.entries(data).filter(([k]) => k !== '@context'))] : data['@graph'];
    let touched = false;
    const wanted = refs(graph);
    if (wanted.has(ORG['@id']) && !defines(graph, ORG['@id'])) { graph.unshift(ORG); touched = true; }
    if (wanted.has(PERSON['@id']) && !defines(graph, PERSON['@id'])) {
      graph.splice(defines(graph, ORG['@id']) ? 1 : 0, 0, PERSON); touched = true;
    }
    if (FAQ_PAGES[file]) {
      const node = faqNode(html, FAQ_PAGES[file], url);
      const i = graph.findIndex((n) => n['@type'] === 'FAQPage');
      if (i >= 0) { if (JSON.stringify(graph[i]) !== JSON.stringify(node)) { graph[i] = node; touched = true; } }
      else { graph.push(node); touched = true; }
      // L'ancien générateur JavaScript n'a plus lieu d'être.
      const js = html.match(/<script>\s*\/\/ FAQPage JSON-LD généré[\s\S]*?<\/script>\n?/);
      if (js) { html = html.replace(js[0], ''); touched = true; }
    }
    if (touched) {
      const out = (single && graph.length === 1) ? { '@context': 'https://schema.org', ...graph[0] }
        : { '@context': 'https://schema.org', ...(single ? {} : data), '@graph': graph };
      html = html.replace(m[0], `<script type="application/ld+json">\n${JSON.stringify(out, null, 2)}\n</script>`);
    }
  }

  if (html !== before) {
    changed++;
    if (CHECK) console.log(`Δ ${file}`);
    else { writeFileSync(path, html, 'utf8'); console.log(`✓ ${file}`); }
  }
}
if (CHECK && changed) { console.error(`${changed} page(s) ne sont pas à jour — lancer node scripts/jsonld-entities.mjs`); process.exit(1); }
console.log(`JSON-LD : ${changed} page(s) ${CHECK ? 'à mettre à jour' : 'mise(s) à jour'}.`);
