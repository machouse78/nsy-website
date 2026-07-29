#!/usr/bin/env node
/**
 * record-realisation.mjs — génère l'APERÇU ANIMÉ d'une carte de réalisation.
 *
 * Enregistre les ~5 premières secondes d'un site (une fois CHARGÉ), en boucle,
 * pour la carte `.realisation-card` de realisations.html / portfolio.html.
 *
 *   node scripts/record-realisation.mjs <url> <nom> [settleMs] [captureMs]
 *   ex : node scripts/record-realisation.mjs https://www.prv-concept.com prv-concept
 *
 * Produit  public/<nom>.mp4  (768×480 = taille d'affichage, capturé en 1280×800, ~5 s, boucle, ~0,4 Mo)
 *      et  public/<nom>.jpg  (poster, extrait ~3,6 s).
 *
 * Pourquoi « après chargement » : on attend window.load + un délai de
 * stabilisation (settle) AVANT de capturer, sinon on filme le hero en train de
 * se construire (images/moteur pas encore affichés). Régler `settleMs` plus haut
 * si l'intro du site est longue.
 *
 * Dépendances : Google Chrome (piloté via CDP) + ffmpeg dans le PATH. Aucun
 * paquet npm (WebSocket global de Node ≥ 22). Override du binaire : env CHROME.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [url, name, settleArg, capArg] = process.argv.slice(2);
if (!url || !name) {
  console.error('usage: node scripts/record-realisation.mjs <url> <nom> [settleMs] [captureMs]');
  process.exit(1);
}
const SETTLE = parseInt(settleArg || '1600', 10);   // attente après window.load
const CAPTURE = parseInt(capArg || '5000', 10);      // durée capturée (≈ durée finale)
const PORT = 9315;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd, args) => new Promise((res, rej) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  p.on('error', rej);
  p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} exited ${c}`))));
});

const tmp = mkdtempSync(join(tmpdir(), 'rec-'));
const framesDir = join(tmp, 'frames');
mkdirSync(framesDir, { recursive: true });

// ── 1. Chrome headless + port CDP ─────────────────────────────────────────
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
  '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1280,800',
  '--mute-audio', '--no-first-run', '--disable-gpu', `--user-data-dir=${join(tmp, 'prof')}`,
  'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      return (await r.json()).webSocketDebuggerUrl;
    } catch { await sleep(500); }
  }
  throw new Error('Chrome CDP indisponible');
}

// ── 2. Capture via CDP Page.startScreencast (après load + settle) ──────────
async function record(WSURL) {
  const ws = new WebSocket(WSURL);
  let id = 0, session = null, capturing = false;
  const pending = new Map();
  const cmd = (method, params = {}, sid) => {
    const _id = ++id; const m = { id: _id, method, params }; if (sid) m.sessionId = sid;
    ws.send(JSON.stringify(m));
    return new Promise((res, rej) => pending.set(_id, { res, rej }));
  };
  const frames = [];
  let loadedResolve; const loaded = new Promise((r) => (loadedResolve = r));
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result); return;
    }
    if (msg.method === 'Page.loadEventFired') loadedResolve();
    if (msg.method === 'Page.screencastFrame') {
      const { data, metadata, sessionId } = msg.params;
      if (capturing) frames.push({ data, ts: metadata.timestamp });
      cmd('Page.screencastFrameAck', { sessionId }, session).catch(() => {});
    }
  });
  await new Promise((r) => ws.addEventListener('open', r));
  const { targetId } = await cmd('Target.createTarget', { url: 'about:blank' });
  session = (await cmd('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  await cmd('Page.enable', {}, session);
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, session);
  await cmd('Page.navigate', { url }, session);
  await Promise.race([loaded, sleep(20000)]);   // window.load (moteur/images chargés)
  await sleep(SETTLE);                           // fin de l'intro
  await cmd('Page.startScreencast', { format: 'jpeg', quality: 82, maxWidth: 1280, maxHeight: 800, everyNthFrame: 1 }, session);
  capturing = true; await sleep(CAPTURE); capturing = false;
  await cmd('Page.stopScreencast', {}, session).catch(() => {});
  ws.close();

  // Manifeste concat ffmpeg avec la vraie durée de chaque frame.
  let concat = '';
  frames.forEach((f, i) => {
    const file = join(framesDir, `f_${String(i).padStart(4, '0')}.jpg`);
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    const next = frames[i + 1];
    concat += `file '${file}'\nduration ${(next ? Math.max(0.001, next.ts - f.ts) : 0.2).toFixed(4)}\n`;
  });
  if (frames.length) concat += `file '${join(framesDir, `f_${String(frames.length - 1).padStart(4, '0')}.jpg`)}'\n`;
  const manifest = join(framesDir, 'frames.txt');
  writeFileSync(manifest, concat);
  console.log(`  ${frames.length} frames capturées`);
  return manifest;
}

// ── 3. Encodage mp4 + poster ───────────────────────────────────────────────
try {
  const manifest = await record(await wsUrl());
  const mp4 = join(PUBLIC, `${name}.mp4`);
  const jpg = join(PUBLIC, `${name}.jpg`);
  // Capture en 1280×800 (net) mais on ENCODE en 768×480 = la taille d'affichage
  // réelle de la carte (≈600 px desktop / 375 px mobile) : le décodage d'une
  // vidéo en boucle ≈ largeur×hauteur×fps → 1280×800 saccadait un peu. Downscale
  // supersamplé (lanczos) = net, décodage ~2,7× moins lourd.
  await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', manifest,
    '-vf', 'fps=24,scale=768:480:flags=lanczos,format=yuv420p', '-t', '5',
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-crf', '28', '-maxrate', '1100k', '-bufsize', '2200k', '-preset', 'slower',
    '-movflags', '+faststart', '-an', mp4]);
  await run('ffmpeg', ['-y', '-ss', '3.6', '-i', mp4, '-frames:v', '1', '-q:v', '3', jpg]);
  console.log(`✅ public/${name}.mp4 + public/${name}.jpg`);
  console.log(`   → carte : <video autoplay loop muted playsinline preload="none" poster="public/${name}.jpg"> + <source src="public/${name}.mp4">`);
  console.log(`   → penser à ajouter la ligne cp public/${name}.mp4 dans prepare-deploy.sh`);
} finally {
  try { chrome.kill(); } catch {}
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
}
