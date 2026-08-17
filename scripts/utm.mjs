#!/usr/bin/env node
/**
 * utm.mjs — génère les liens TRACÉS des publications (paramètres UTM).
 *
 * Pourquoi : Facebook (comme LinkedIn) ne transmet QUE son origine dans le
 * referer — jamais le chemin. Impossible donc de savoir NATIVEMENT de quel
 * groupe ou post vient un clic. Les UTM sont le seul moyen fiable : le
 * collecteur KPI les lit dans les logs et les agrège (dashboard → « Campagnes »).
 *
 *   node scripts/utm.mjs <url> <source> <support> <campagne>
 *   node scripts/utm.mjs https://www.nsy.fr/site-ia-en-un-week-end.html facebook groupe dev-web-france
 *   node scripts/utm.mjs https://www.nsy.fr/site-ia-en-un-week-end.html facebook page journal-article3
 *   node scripts/utm.mjs https://www.nsy.fr/site-ia-en-un-week-end.html linkedin profil journal-article3
 *
 * Conventions NSY : source = facebook|linkedin|instagram ; support =
 * page|groupe|profil|commentaire ; campagne = slug court et STABLE (le même
 * article gardera le même nom de campagne sur tous les canaux).
 */
const [url, source, medium, campaign] = process.argv.slice(2);
if (!url || !source) {
  console.error('usage: node scripts/utm.mjs <url> <source> [support] [campagne]');
  process.exit(1);
}
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const u = new URL(url);
u.searchParams.set('utm_source', slug(source));
if (medium) u.searchParams.set('utm_medium', slug(medium));
if (campaign) u.searchParams.set('utm_campaign', slug(campaign));
console.log(u.toString());
