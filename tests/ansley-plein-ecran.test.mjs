#!/usr/bin/env node
/**
 * Agrandir / réduire le panneau d'Ansley (owner, 28/08/2026).
 *
 * Même geste que sur prv-concept.com. Quatre choses à tenir : le plein écran
 * occupe vraiment l'écran, le retour rend au panneau sa taille d'origine, le
 * choix est MÉMORISÉ, et sous 481 px le bouton disparaît — le panneau y occupe
 * déjà l'écran, la commande n'y ferait rien.
 *
 * Le bouton est INJECTÉ par app.js, pas écrit dans le HTML : le test vérifie
 * donc aussi qu'il apparaît, et sur une page ANGLAISE que son intitulé suit la
 * langue de la page.
 *
 * Usage : node tests/ansley-plein-ecran.test.mjs [http://127.0.0.1:4181]
 */
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const base = process.argv[2] || 'http://127.0.0.1:4181';

/* Le test sert le site LUI-MÊME si rien n'écoute : il doit pouvoir tourner dans
   run-tests.sh sans qu'on ait pensé à lancer un serveur à côté. */
const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let serveur = null;
const joignable = async () => {
  try { await fetch(base + '/index.html', { method: 'HEAD' }); return true; } catch { return false; }
};
if (!(await joignable())) {
  serveur = spawn(process.execPath, [path.join(racine, '.dev-server.js')], { stdio: 'ignore' });
  for (let i = 0; i < 40 && !(await joignable()); i++) await new Promise((r) => setTimeout(r, 150));
}
const fin = (code) => { if (serveur) serveur.kill(); process.exit(code); };
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let ko = 0;
const dit = (label, ok, detail) => { if (!ok) ko++; console.log((ok ? '  ✓ ' : '  ✗ ') + label + (detail ? ' → ' + detail : '')); };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(base + '/index.html', { waitUntil: 'networkidle2' });
await page.evaluate(() => document.getElementById('cbot-fab').click());
await pause(600);

const mesure = () => page.evaluate(() => {
  const r = document.getElementById('cbot').getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight };
});
/* On attend que la taille se STABILISE au lieu de deviner un délai : le panneau
   s'ouvre en scale(.98) puis s'agrandit, et une mesure prise au hasard tombe en
   pleine animation (vu : 945×759 entre 380 et 1248). */
const boite = async () => {
  let a = await mesure();
  for (let i = 0; i < 30; i++) {
    await pause(80);
    const b = await mesure();
    if (b.w === a.w && b.h === a.h) return b;
    a = b;
  }
  return a;
};
const clic = async () => { await page.evaluate(() => document.getElementById('cbot-zoom').click()); await pause(60); };

dit('le bouton est injecté dans l’en-tête',
    await page.evaluate(() => !!document.querySelector('.cbot-head #cbot-zoom')));

const normal = await boite();
dit('ouvert, le panneau garde sa taille de fenêtre', normal.w < normal.vw * 0.5, normal.w + '×' + normal.h);

await clic();
const plein = await boite();
dit('agrandi, il occupe l’écran', plein.w > plein.vw - 40 && plein.h > plein.vh - 40, plein.w + '×' + plein.h);
dit('l’intitulé bascule',
    (await page.evaluate(() => document.getElementById('cbot-zoom').getAttribute('aria-label'))) === 'Revenir à la taille normale');

await clic();
const revenu = await boite();
dit('réduit, il retrouve sa taille', Math.abs(revenu.w - normal.w) < 2 && Math.abs(revenu.h - normal.h) < 2,
    revenu.w + '×' + revenu.h);

await clic();
await page.reload({ waitUntil: 'networkidle2' });
await page.evaluate(() => document.getElementById('cbot-fab').click());
await pause(600);
const apres = await boite();
dit('le choix survit au rechargement', apres.w > apres.vw - 40, apres.w + '×' + apres.h);

await page.setViewport({ width: 390, height: 844 });
await pause(250);
dit('sur mobile, le bouton est masqué',
    await page.evaluate(() => getComputedStyle(document.getElementById('cbot-zoom')).display === 'none'));

// page anglaise : l'intitulé doit suivre la langue du document
await page.setViewport({ width: 1280, height: 900 });
await page.goto(base + '/index-en.html', { waitUntil: 'networkidle2' });
await page.evaluate(() => { try { localStorage.removeItem('nsy-cbot-plein'); } catch (e) {} });
await page.reload({ waitUntil: 'networkidle2' });
await page.evaluate(() => document.getElementById('cbot-fab').click());
await pause(600);
dit('sur la version anglaise, l’intitulé est en anglais',
    (await page.evaluate(() => document.getElementById('cbot-zoom').getAttribute('aria-label'))) === 'Expand to full screen');

await browser.close();
console.log(ko ? '\n❌ ' + ko + ' écart(s)' : '\n✅ plein écran Ansley OK');
fin(ko ? 1 : 0);
