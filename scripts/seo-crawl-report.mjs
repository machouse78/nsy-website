#!/usr/bin/env node
/**
 * seo-crawl-report.mjs — qui crawle nsy.fr ? (SEO + GEO/LLMO)
 *
 * Analyse un access log Apache/Nginx au format « combined » (avec User-Agent)
 * et classe les requêtes par crawler : assistants IA (GPTBot, ClaudeBot,
 * PerplexityBot, MistralAI-User…), moteurs de recherche (Googlebot, Bingbot…),
 * outils SEO, humains. Sortie : hits / IP uniques / jours vus par bot, + les
 * pages et jours vus pour les crawlers IA (le signal GEO clé).
 *
 *   node scripts/seo-crawl-report.mjs <access.log> [access2.log ...]
 *
 * À relancer chaque semaine sur les logs bruts Infomaniak. Note : « Google-Extended »
 * et « Applebot-Extended » sont des JETONS robots.txt (pas des UA) — on ne les
 * voit donc jamais en log ; c'est Googlebot / Applebot qui crawlent.
 */
import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node scripts/seo-crawl-report.mjs <access.log> [...]'); process.exit(1); }

// UA → [catégorie, nom]. Ordre = priorité (le 1er match gagne).
const UA = [
  // ─ Assistants IA (le groupe GEO/LLMO) ─
  [/GPTBot/i,                 ['AI','OpenAI · GPTBot (entraînement)']],
  [/OAI-SearchBot/i,          ['AI','OpenAI · OAI-SearchBot (ChatGPT Search)']],
  [/ChatGPT-User/i,           ['AI','OpenAI · ChatGPT-User (navigation)']],
  [/Claude-SearchBot/i,       ['AI','Anthropic · Claude-SearchBot']],
  [/Claude-User/i,            ['AI','Anthropic · Claude-User (navigation)']],
  [/ClaudeBot|anthropic-ai/i, ['AI','Anthropic · ClaudeBot (entraînement)']],
  [/PerplexityBot/i,          ['AI','Perplexity · PerplexityBot (index)']],
  [/Perplexity-User/i,        ['AI','Perplexity · Perplexity-User (navigation)']],
  [/MistralAI-User|MistralAI/i,['AI','Mistral · Le Chat']],
  [/CCBot/i,                  ['AI','Common Crawl · CCBot (corpus LLM)']],
  [/Bytespider/i,             ['AI','ByteDance · Bytespider (Doubao)']],
  [/meta-externalagent|FacebookBot|facebookexternalhit/i,['AI','Meta · Llama / Meta AI']],
  [/Amazonbot/i,              ['AI','Amazon · Amazonbot']],
  [/Google-Extended/i,        ['AI','Google-Extended (rare en UA)']],
  // ─ Moteurs de recherche ─
  [/Googlebot|Google-InspectionTool|Storebot-Google/i,['SE','Googlebot (Google)']],
  [/bingbot|BingPreview|msnbot/i,['SE','Bingbot (→ ChatGPT Search, Copilot)']],
  [/Applebot/i,               ['SE','Applebot (Apple)']],
  [/DuckDuckBot|DuckDuckGo/i, ['SE','DuckDuckBot']],
  [/YandexBot|YandexImages/i, ['SE','YandexBot']],
  [/PetalBot/i,               ['SE','PetalBot (Huawei/Petal)']],
  [/SeznamBot/i,              ['SE','SeznamBot']],
  // ─ Outils SEO / monitoring / scanners ─
  [/SemrushBot/i,             ['TOOL','SemrushBot']],
  [/AhrefsBot/i,              ['TOOL','AhrefsBot']],
  [/DotBot|dataforseo|MJ12bot|BLEXBot|serpstat|Barkrowler|ZoominfoBot|DataForSeo/i,['TOOL','Autres outils SEO']],
  [/UptimeRobot|Pingdom|StatusCake|monitoring/i,['TOOL','Monitoring uptime']],
  [/censys|Expanse|InternetMeasurement|Palo Alto|masscan|zgrab|CensysInspect/i,['TOOL','Scanners réseau']],
  // ─ Réseaux sociaux (aperçus de liens) ─
  [/Twitterbot|Slackbot|WhatsApp|TelegramBot|LinkedInBot|Discordbot|Pinterest|redditbot/i,['SOCIAL','Aperçu réseau social']],
  // ─ Bots génériques ─
  [/\bbot\b|crawler|spider|http-client|python-requests|curl\/|Go-http|Java\/|Scrapy|axios|node-fetch|headless/i,['BOT','Bot/scraper générique']],
];
const isBrowser = (ua) => /Mozilla\/5\.0/.test(ua) && /(Chrome|Firefox|Safari|Edg|OPR)\//.test(ua) && !/bot|crawl|spider|preview|-User|GPTBot|Claude|Perplexity|python|Go-http/i.test(ua);

const LINE = /^\S+\s+(\S+)\s+-\s+-\s+\[(\d+)\/(\w+)\/(\d+):[^\]]+\]\s+"(\S+)\s+(\S+)[^"]*"\s+(\d+)\s+\S+\s+"[^"]*"\s+"([^"]*)"/;

const cats = {}; // name → {cat, req, ips:Set, days:Set, paths:Map, status:Map}
let total = 0, human = 0, parsedFail = 0;
const daySet = new Set();

for (const f of files) {
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const m = line.match(LINE);
    if (!m) { parsedFail++; continue; }
    const [, ip, d, mon, yr, , path, status, ua] = m;
    total++;
    const day = `${yr}-${mon}-${d}`;
    daySet.add(day);
    let hit = null;
    for (const [re, meta] of UA) if (re.test(ua)) { hit = meta; break; }
    if (!hit) { if (isBrowser(ua)) { human++; continue; } hit = ['BOT', 'Bot/scraper générique']; }
    const [cat, name] = hit;
    const o = (cats[name] ??= { cat, req: 0, ips: new Set(), days: new Set(), paths: new Map(), status: new Map() });
    o.req++; o.ips.add(ip); o.days.add(day);
    o.paths.set(path, (o.paths.get(path) || 0) + 1);
    o.status.set(status, (o.status.get(status) || 0) + 1);
  }
}

const byCat = (c) => Object.entries(cats).filter(([, o]) => o.cat === c).sort((a, b) => b[1].req - a[1].req);
const line = (name, o) => `  ${name.padEnd(42)} ${String(o.req).padStart(4)} req · ${String(o.ips.size).padStart(2)} IP · ${String(o.days.size).padStart(2)}j`;
const days = [...daySet].sort();

console.log(`\n📊 ${total} requêtes · ${human} de navigateurs (humains) · période ${days[0]} → ${days[days.length-1]} (${days.length} jours)\n`);

console.log('🤖 CRAWLERS IA / ASSISTANTS (le signal GEO)');
const ai = byCat('AI');
if (!ai.length) console.log('  — AUCUN vu sur la période —');
for (const [n, o] of ai) console.log(line(n, o));

console.log('\n🔎 MOTEURS DE RECHERCHE');
for (const [n, o] of byCat('SE')) console.log(line(n, o));

const tools = byCat('TOOL'), social = byCat('SOCIAL'), bots = byCat('BOT');
const sum = (arr) => arr.reduce((a, [, o]) => a + o.req, 0);
console.log('\n🛠  OUTILS SEO / SCANNERS :', sum(tools), 'req ·  RÉSEAUX SOCIAUX :', sum(social), 'req ·  BOTS/SCRAPERS génériques :', sum(bots), 'req');

// Détail des pages vues par les crawlers IA (+ ont-ils lu llms.txt / le sitemap ?)
if (ai.length) {
  console.log('\n📄 Pages vues par les crawlers IA :');
  for (const [n, o] of ai) {
    const top = [...o.paths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([p, c]) => `${p}${c > 1 ? '×' + c : ''}`).join(', ');
    console.log(`  ${n.split(' · ')[0].padEnd(12)} → ${top}`);
  }
}
