# Verify in headless Chrome — measure, don't guess

The recurring failure mode: declaring a layout/perf fix "done" from reading CSS,
then being wrong. Always drive the real page and **measure / screenshot** before
claiming success. Puppeteer + system Chrome works well.

```js
import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // system Chrome
  args: ['--no-sandbox','--disable-setuid-sandbox','--use-angle=metal'],           // metal/swiftshader for WebGL
});
const page = await browser.newPage();
await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true });
await page.goto('http://localhost:8080/', { waitUntil: 'networkidle2' });
```

## Horizontal overflow / which element is too wide
```js
await page.evaluateOnNewDocument(() => { // unmask overflow so it's measurable
  const s = document.createElement('style'); s.textContent = 'html,body{overflow-x:visible!important}';
  document.documentElement.appendChild(s);
});
const m = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, view: innerWidth }));
console.log(m.doc > m.view ? `overflow ${m.doc - m.view}px` : 'no overflow');
```
Sweep widths: `[1280,1024,940,932,844,430,393,375,360,320]`. Test landscape
(`844×390`, `932×430`) and every language/content variant.

## Nav rows / items inline
```js
const top = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().top) : -1; };
// links on row 2?  flags inline with social?  CTA within viewport?
const r = await page.evaluate(() => ({
  navH: Math.round(document.querySelector('.nav').getBoundingClientRect().height),
  linksTop: top('.nav-links'), socialTop: top('.nav-social'), langTop: top('.nav-lang'),
  ctaRight: Math.round(document.querySelector('.nav-cta').getBoundingClientRect().right), view: innerWidth,
}));
// flags inline  := langTop <= socialTop + 5 ;  CTA fits := ctaRight <= view
```

## Animation / video / 3D state
```js
await page.evaluate(() => getComputedStyle(document.querySelector('.hero h1 .accent')).animationPlayState); // 'running'|'paused'
await page.evaluate(() => [...document.querySelectorAll('video[loop]')].map(v => ({ paused: v.paused })));
await page.evaluate(() => { let n=0; document.querySelectorAll('*').forEach(e=>{try{n+=e.getAnimations().length}catch{}}); return n; });
// font-boosting check: computed font-size of an element that uses clamp()
await page.evaluate(() => getComputedStyle(document.querySelector('.hero h1')).fontSize);
```
Simulate a hidden tab:
```js
await page.evaluate(() => { Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true}); document.dispatchEvent(new Event('visibilitychange')); });
```

## Screenshots (the final sanity check)
```js
const h = await page.evaluate(() => Math.round(document.querySelector('.nav').getBoundingClientRect().height));
await page.screenshot({ path: 'nav.png', clip: { x:0, y:0, width:393, height:h+4 } }); // clip values must be integers
```
Then actually **look** at the screenshot. Screenshot both languages / both
orientations and compare.

## Driving a widget (e.g. chatbot)
```js
await page.click('#chat-fab');
await page.type('#chat-input', 'How much for a website?'); await page.keyboard.press('Enter');
await new Promise(r => setTimeout(r, 1300));
const answer = await page.evaluate(() => { const a = document.querySelectorAll('.bot-bubble'); return a[a.length-1].innerText; });
```

## 3D GLB appearance
Headless can't time `<model-viewer>` auto-rotate, but you can verify the model
*looks right*: serve a minimal page with `<model-viewer src=...>`, wait for the
`load` event, then screenshot. Render the source too (Blender Cycles) and compare
silhouettes. Never ship a 3D asset without looking at a render of the actual file.

## Gotchas
- `clip` width/height must be **integers** (round the bbox).
- WebGL needs `--use-angle=metal` (macOS) or `--use-angle=swiftshader
  --enable-unsafe-swiftshader` (software).
- Cloudflare Turnstile etc. throw on `localhost` — harmless console noise, ignore.
- `text-size-adjust` works in headless; font-*boosting* (Android) does not
  reproduce on desktop Chrome — reason from the rule, but you can still confirm
  the declared sizes hold.
