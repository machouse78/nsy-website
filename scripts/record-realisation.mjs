#!/usr/bin/env node
/**
 * record-realisation.mjs — génère l'APERÇU ANIMÉ d'une carte de réalisation.
 *
 * Enregistre les premières secondes d'un site (une fois CHARGÉ), en boucle, pour
 * la carte `.realisation-card` de realisations.html / portfolio.html.
 *
 *   node scripts/record-realisation.mjs <url> <nom> [settleMs] [captureMs] [fps]
 *   ex : node scripts/record-realisation.mjs https://www.prv-concept.com prv-concept
 *
 * Produit  public/<nom>.mp4  et  public/<nom>.jpg (poster).
 *
 * MÉTHODE — screencast TEMPS RÉEL (bonne vitesse) + timings réels (fluide) :
 *  - On capture via CDP `Page.startScreencast` (flux poussé) : TEMPS RÉEL → les
 *    animations (bandeau piloté par requestAnimationFrame) tournent à leur VRAIE
 *    vitesse. On ENCODE en respectant le timestamp réel de chaque frame (manifeste
 *    concat) → la vitesse du clip = la réalité.
 *  - Le judder de la 1re version venait de `quality: 82` : la livraison des frames
 *    était LENTE et IRRÉGULIÈRE (trous jusqu'à 280 ms) → le resampling CFR saccadait.
 *    En `quality: 60`, le flux est régulier (~28 fps, trou max ~72 ms) → resampler
 *    vers 24 fps est doux ⇒ fluide. Le downscale 768×480 (taille d'affichage) masque
 *    la baisse de qualité JPEG et allège le décodage.
 *  - ⚠️ NE PAS utiliser le temps virtuel (`Emulation.setVirtualTimePolicy`) : les
 *    animations rAF n'avancent qu'au PAINT, pas avec le budget virtuel → vitesse
 *    fausse (mesuré : 3 px/2 s virtuels vs 102 px/2 s réels). NE PAS non plus boucler
 *    sur `Page.captureScreenshot` (~155 ms/frame → trop lent pour du temps réel).
 *
 * `settleMs` = attente RÉELLE après `window.load` avant de capturer → l'intro
 * (compteurs, apparition du moteur) est finie d'abord. Tuner par site : PRV ~2500.
 *
 * Dépendances : Google Chrome (piloté via CDP) + ffmpeg dans le PATH. Aucun paquet
 * npm (WebSocket global de Node ≥ 22). Override du binaire : env CHROME.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [url, name, setArg, capArg, fpsArg, scrollArg] = process.argv.slice(2);
if (!url || !name) {
  console.error('usage: node scripts/record-realisation.mjs <url> <nom> [settleMs] [captureMs] [fps] [scrollPx]');
  process.exit(1);
}
const SETTLE = parseInt(setArg || '2500', 10);     // attente réelle après window.load, avant capture
const CAPTURE = parseInt(capArg || '5000', 10);    // durée finale (s. après trim)
const FPS = parseInt(fpsArg || '24', 10);
// scrollPx : pixels défilés (en douceur) PENDANT la capture. INDISPENSABLE pour un
// site au hero statique : le screencast n'émet des frames QUE quand la page repeint
// — sans animation ni scroll, on ne reçoit qu'UNE frame. Un défilement lent force
// les repaints ET fait une jolie « visite » du site (ex. 2200 pour un one-page).
const SCROLL = parseInt(scrollArg || '0', 10);
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
  '--mute-audio', '--no-first-run', `--user-data-dir=${join(tmp, 'prof')}`,
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
  let id = 0, session = null, loadedResolve = null, recording = false;
  const pending = new Map();
  const frames = [];
  const cmd = (method, params = {}, sid) => {
    const _id = ++id; const m = { id: _id, method, params }; if (sid) m.sessionId = sid;
    ws.send(JSON.stringify(m));
    return new Promise((res, rej) => pending.set(_id, { res, rej }));
  };
  const loaded = new Promise((r) => (loadedResolve = r));
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id); pending.delete(msg.id);
      return msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
    }
    if (msg.method === 'Page.loadEventFired' && loadedResolve) loadedResolve();
    if (msg.method === 'Page.screencastFrame') {
      if (recording) frames.push({ data: msg.params.data, ts: msg.params.metadata.timestamp });
      cmd('Page.screencastFrameAck', { sessionId: msg.params.sessionId }, session).catch(() => {});
    }
  });
  await new Promise((r) => ws.addEventListener('open', r));

  const { targetId } = await cmd('Target.createTarget', { url: 'about:blank' });
  session = (await cmd('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  await cmd('Page.enable', {}, session);
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, session);
  await cmd('Page.navigate', { url }, session);
  await Promise.race([loaded, sleep(15000)]);   // window.load
  await sleep(SETTLE);                            // intro finie
  // quality 60 = livraison RÉGULIÈRE du flux (cf. en-tête). Capture un peu plus que
  // la cible pour pouvoir trimmer proprement à CAPTURE.
  recording = true;
  await cmd('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: 1280, maxHeight: 800, everyNthFrame: 1 }, session);
  if (SCROLL > 0) {
    // Défilement doux par paliers pendant la capture (repaints réguliers).
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      cmd('Runtime.evaluate', { expression: `window.scrollTo({top: ${Math.round((SCROLL / steps) * i)}, behavior: 'smooth'})` }, session).catch(() => {});
      await sleep(CAPTURE / steps);
    }
    await sleep(600);
  } else {
    await sleep(CAPTURE + 600);
  }
  recording = false;
  await cmd('Page.stopScreencast', {}, session).catch(() => {});
  ws.close();

  // Manifeste concat avec la VRAIE durée de chaque frame (temps réel → bonne vitesse).
  let concat = '';
  frames.forEach((f, i) => {
    const file = join(framesDir, `f_${String(i).padStart(4, '0')}.jpg`);
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    const next = frames[i + 1];
    concat += `file '${file}'\nduration ${(next ? Math.max(0.001, next.ts - f.ts) : 1 / FPS).toFixed(4)}\n`;
  });
  if (frames.length) concat += `file '${join(framesDir, `f_${String(frames.length - 1).padStart(4, '0')}.jpg`)}'\n`;
  const manifest = join(framesDir, 'frames.txt');
  writeFileSync(manifest, concat);
  const span = frames.length ? (frames[frames.length - 1].ts - frames[0].ts) : 0;
  console.log(`  ${frames.length} frames, ${span.toFixed(2)}s réels @ ${(frames.length / span).toFixed(1)} fps`);
  return manifest;
}

try {
  const manifest = await capture(await wsUrl());
  const mp4 = join(PUBLIC, `${name}.mp4`);
  const jpg = join(PUBLIC, `${name}.jpg`);
  // fps=FPS resample par TIMESTAMP (vitesse réelle préservée) → CFR fluide. Downscale
  // lanczos vers la taille d'affichage de la carte (net + décodage léger). Trim à CAPTURE.
  await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', manifest,
    '-vf', `fps=${FPS},scale=${OUT_W}:${OUT_H}:flags=lanczos,format=yuv420p`, '-t', String(CAPTURE / 1000),
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-crf', '27', '-maxrate', '900k', '-bufsize', '1800k', '-preset', 'slower',
    '-movflags', '+faststart', '-an', mp4]);
  await run('ffmpeg', ['-y', '-i', mp4, '-vf', `select=eq(n\\,${Math.round(CAPTURE / 1000 * FPS * 0.7)})`, '-frames:v', '1', '-q:v', '3', jpg]);
  console.log(`✅ public/${name}.mp4 (${OUT_W}×${OUT_H}, ${FPS} fps, ${(CAPTURE / 1000).toFixed(1)} s) + public/${name}.jpg`);
} finally {
  try { chrome.kill(); } catch {}
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
}
