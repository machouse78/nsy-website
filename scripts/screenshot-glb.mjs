// NSY — Screenshot a GLB rendered by model-viewer in headless Chrome.
// Spins up a local HTTP server, loads the GLB via model-viewer, waits for
// the "load" event, then takes a PNG screenshot. This is exactly what the
// user sees in their browser.
//
// Run: node scripts/screenshot-glb.mjs <input.glb> <output.png>

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node screenshot-glb.mjs <input.glb> <output.png>');
  process.exit(1);
}
const INPUT = path.resolve(args[0]);
const OUTPUT = path.resolve(args[1]);

if (!fs.existsSync(INPUT)) {
  console.error(`Input not found: ${INPUT}`);
  process.exit(1);
}

const PORT = 38421;
const GLB_NAME = path.basename(INPUT);

// Tiny HTTP server that serves the GLB + a model-viewer HTML page
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body { margin:0; padding:0; background:#0A0F1C; }
  model-viewer { width:1200px; height:700px; background:#0A0F1C; }
</style>
<script type="module" src="https://unpkg.com/@google/model-viewer@4.2.0/dist/model-viewer.min.js"></script>
</head>
<body>
<model-viewer
  id="mv"
  src="/${GLB_NAME}"
  alt="renault"
  camera-orbit="-30deg 75deg auto"
  field-of-view="auto"
  bounds="tight"
  exposure="1.0"
  tone-mapping="neutral"
  environment-image="neutral"
  shadow-intensity="0"
  loading="eager"
  reveal="auto"
  interaction-prompt="none">
</model-viewer>
</body>
</html>`);
    return;
  }
  if (url.pathname === '/' + GLB_NAME) {
    res.writeHead(200, { 'Content-Type': 'model/gltf-binary' });
    fs.createReadStream(INPUT).pipe(res);
    return;
  }
  res.writeHead(404); res.end();
});

await new Promise((r) => server.listen(PORT, r));
console.log(`[shot] Server on http://localhost:${PORT}, serving ${GLB_NAME}`);

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-angle=metal'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 700, deviceScaleFactor: 1 });
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      console.log(`[shot] page-${type}:`, msg.text());
    }
  });
  page.on('pageerror', (err) => console.log('[shot] page-pageerror:', err.message));

  console.log('[shot] Loading page…');
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for model-viewer's 'load' event (the model has finished decoding)
  console.log('[shot] Waiting for model-viewer load event…');
  await page.evaluate(() => {
    return new Promise((resolve, reject) => {
      const mv = document.getElementById('mv');
      const timer = setTimeout(() => reject(new Error('model-viewer load timeout (10s)')), 10000);
      if (mv.loaded) { clearTimeout(timer); return resolve(true); }
      mv.addEventListener('load', () => { clearTimeout(timer); resolve(true); }, { once: true });
      mv.addEventListener('error', (e) => { clearTimeout(timer); reject(new Error('model-viewer error: ' + (e?.detail?.message || ''))); });
    });
  }).catch((e) => {
    console.error('[shot] WARN:', e.message, '— screenshotting anyway');
  });

  // Give Three.js one more frame to actually render
  await new Promise((r) => setTimeout(r, 1500));

  console.log('[shot] Screenshotting…');
  await page.screenshot({ path: OUTPUT, type: 'png' });
  console.log(`[shot] ✅ Saved: ${OUTPUT}`);
} finally {
  await browser.close();
  server.close();
}
