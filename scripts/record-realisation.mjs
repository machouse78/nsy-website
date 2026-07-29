#!/usr/bin/env node
/**
 * record-realisation.mjs — génère l'APERÇU ANIMÉ d'une carte de réalisation.
 *
 * Enregistre les premières secondes d'un site (une fois CHARGÉ), en boucle, pour
 * la carte `.realisation-card` de realisations.html / portfolio.html.
 *
 *   node scripts/record-realisation.mjs <url> <nom> [warmupMs] [captureMs] [fps]
 *   ex : node scripts/record-realisation.mjs https://www.prv-concept.com prv-concept 5000
 *
 * Produit  public/<nom>.mp4  et  public/<nom>.jpg (poster).
 *
 * DEUX décisions qui rendent l'aperçu FLUIDE et LÉGER :
 *  1. CAPTURE DÉTERMINISTE (fluide) — on ne « filme » PAS en temps réel (le
 *     screencast CDP livre des frames irrégulières ~20 fps → judder). On pilote
 *     l'HORLOGE VIRTUELLE de Chrome (Emulation.setVirtualTimePolicy) et on prend
 *     UNE capture par pas EXACT de 1/fps → cadence parfaitement régulière, CSS
 *     (bandeau, compteurs) fluide. ⚠️ Toujours avancer par PETITS pas (jamais un
 *     gros budget d'un coup : rAF recevrait un delta géant et les animations JS
 *     dérailleraient — compteur qui saute, reveal qui se réinitialise).
 *  2. ENCODAGE À LA TAILLE D'AFFICHAGE (léger) — on capture net en 1280×800 mais
 *     on encode en 768×480 (≈ la largeur réelle de la carte : ~600 px desktop /
 *     ~375 px mobile). Décoder une vidéo en boucle ≈ largeur×hauteur×fps ; downscale
 *     supersamplé (lanczos) = net + décodage ~2,8× plus léger.
 *
 * `warmupMs` = ms d'animation jouées (en petits pas) APRÈS chargement, AVANT de
 * capturer → l'intro (compteurs, apparition du moteur) est finie d'abord. Tuner
 * par site : PRV Concept ~5000 (long reveal du moteur) ; défaut 3500.
 *
 * Dépendances : Google Chrome (piloté via CDP) + ffmpeg dans le PATH. Aucun
 * paquet npm (WebSocket global de Node ≥ 22). Override du binaire : env CHROME.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [url, name, warmArg, capArg, fpsArg] = process.argv.slice(2);
if (!url || !name) {
  console.error('usage: node scripts/record-realisation.mjs <url> <nom> [warmupMs] [captureMs] [fps]');
  process.exit(1);
}
const WARMUP = parseInt(warmArg || '3500', 10);   // ms d'animation (petits pas) après chargement, avant capture
const CAPTURE = parseInt(capArg || '5000', 10);    // durée capturée (= durée finale)
const FPS = parseInt(fpsArg || '30', 10);
const FRAME_MS = 1000 / FPS;
const N = Math.round((CAPTURE / 1000) * FPS);
const OUT_W = 768, OUT_H = 480;                     // taille d'affichage de la carte
const PORT = 9315;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd, args) => new Promise((res, rej) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  p.on('error', rej); p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} exited ${c}`))));
});

const tmp = mkdtempSync(join(tmpdir(), 'rec-'));
const framesDir = join(tmp, 'frames');
mkdirSync(framesDir, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
  '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1280,800',
  '--mute-audio', '--no-first-run', '--disable-gpu', `--user-data-dir=${join(tmp, 'prof')}`,
  'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 40; i++) {
    try { return (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; }
    catch { await sleep(500); }
  }
  throw new Error('Chrome CDP indisponible');
}

async function capture(WSURL) {
  const ws = new WebSocket(WSURL);
  let id = 0, session = null;
  const pending = new Map();
  let budgetResolve = null;
  const cmd = (method, params = {}, sid) => {
    const _id = ++id; const m = { id: _id, method, params }; if (sid) m.sessionId = sid;
    ws.send(JSON.stringify(m));
    return new Promise((res, rej) => pending.set(_id, { res, rej }));
  };
  const nextBudget = () => new Promise((r) => (budgetResolve = r));

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id); pending.delete(msg.id);
      return msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
    }
    if (msg.method === 'Emulation.virtualTimeBudgetExpired' && budgetResolve) { const r = budgetResolve; budgetResolve = null; r(); }
  });
  await new Promise((r) => ws.addEventListener('open', r));

  const { targetId } = await cmd('Target.createTarget', { url: 'about:blank' });
  session = (await cmd('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  await cmd('Page.enable', {}, session);
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, session);

  // 1) CHARGEMENT : temps virtuel figé, puis on avance en se mettant en pause
  //    tant que le réseau charge → page + images prêtes.
  await cmd('Emulation.setVirtualTimePolicy', { policy: 'pause' }, session);
  await cmd('Page.navigate', { url }, session);
  let p = nextBudget();
  await cmd('Emulation.setVirtualTimePolicy', { policy: 'pauseIfNetworkFetchesPending', budget: 10000, waitForNavigation: true }, session);
  await p;

  // 2) STABILISATION + CAPTURE, en pas RÉGULIERS de 1/fps (petits pas obligatoires,
  //    voir en-tête). On ne SAUVEGARDE qu'après WARMUP ms (intro finie).
  const clip = { x: 0, y: 0, width: 1280, height: 800, scale: 1 };
  const warmSteps = Math.round(WARMUP / FRAME_MS);
  let saved = 0;
  for (let step = 0; step < warmSteps + N; step++) {
    p = nextBudget();
    await cmd('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: FRAME_MS }, session);
    await p;
    if (step < warmSteps) continue;
    const shot = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 90, clip, fromSurface: true, captureBeyondViewport: false }, session);
    writeFileSync(join(framesDir, `f_${String(saved++).padStart(4, '0')}.jpg`), Buffer.from(shot.data, 'base64'));
  }
  ws.close();
  console.log(`  ${N} frames déterministes @ ${FPS} fps`);
}

try {
  await capture(await wsUrl());
  const mp4 = join(PUBLIC, `${name}.mp4`);
  const jpg = join(PUBLIC, `${name}.jpg`);
  // Frames déjà régulières → pas de resampling (-framerate FPS). Downscale
  // supersamplé vers la taille d'affichage de la carte (net + décodage léger).
  await run('ffmpeg', ['-y', '-framerate', String(FPS), '-i', join(framesDir, 'f_%04d.jpg'),
    '-vf', `scale=${OUT_W}:${OUT_H}:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-crf', '27', '-maxrate', '900k', '-bufsize', '1800k', '-preset', 'slower',
    '-movflags', '+faststart', '-an', mp4]);
  await run('ffmpeg', ['-y', '-i', mp4, '-vf', `select=eq(n\\,${Math.round(N * 0.7)})`, '-frames:v', '1', '-q:v', '3', jpg]);
  console.log(`✅ public/${name}.mp4 (${OUT_W}×${OUT_H}, ${FPS} fps, ${(CAPTURE / 1000).toFixed(1)} s) + public/${name}.jpg`);
  console.log(`   → carte : <video autoplay loop muted playsinline preload="none" poster="public/${name}.jpg"> + <source src="public/${name}.mp4">`);
  console.log(`   → prepare-deploy.sh : cp public/${name}.mp4`);
} finally {
  try { chrome.kill(); } catch {}
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
}
