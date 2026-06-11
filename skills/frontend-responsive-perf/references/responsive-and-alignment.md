# Responsive layout & alignment

## 1. Disable Android Chrome "font boosting" (do this first)
Chrome on Android (and sometimes iOS Safari in landscape) auto-inflates "important"
text, **overriding your `clamp()`/px font sizes** and overflowing the layout. It
often reproduces only on specific phones or in landscape — easy to miss on a Mac.

```css
html, body {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  overflow-x: hidden;            /* safety net — also fix the real source */
}
h1, h2, h3, h4, p { overflow-wrap: anywhere; } /* long words break, not the layout */
```
`100%` (not `none`) keeps user pinch-zoom working.

## 2. Find the real horizontal-overflow culprit (don't just hide it)
`overflow-x:hidden` masks overflow; it doesn't fix cut-off text. Diagnose:

```js
// In Puppeteer, force overflow visible so the offender contributes to scrollWidth:
await page.evaluateOnNewDocument(() => {
  const s = document.createElement('style');
  s.textContent = 'html,body{overflow-x:visible!important}';
  document.documentElement.appendChild(s);
});
// Then list elements wider than the viewport:
const offenders = await page.evaluate(() => {
  const W = innerWidth, out = [];
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.right > W + 1 && r.width > 0) out.push({ tag: el.tagName, cls: el.className, right: Math.round(r.right) });
  });
  return out.slice(0, 25);
});
```
Typical culprit: a `grid-template-columns: repeat(N, auto)` row whose items
(often one with `white-space:nowrap`) demand more than the viewport. Fix the
element, e.g. at a breakpoint:
```css
@media (max-width: 420px) {
  .stat-row { grid-template-columns: 1fr 1fr; }   /* was repeat(3, auto) */
  .stat-row .wide { white-space: normal; }
}
```

## 3. Deterministic multi-row nav (independent of label length / language)
**Problem:** with `flex-wrap`, whether the links sit on row 1 or row 2 depends on
how wide the labels are. Short labels (or a different language) ride up next to
the brand/CTA; longer ones wrap. The layout silently changes per language.

**Fix:** a zero-height, full-width break element forces a clean wrap.
```html
<nav class="nav"><div class="nav-inner">
  <a class="brand">…</a>
  <div class="nav-links">…</div>
  <div class="nav-social">…</div>
  <div class="nav-lang">…</div>
  <a class="nav-cta">…</a>
  <span class="nav-break" aria-hidden="true"></span>  <!-- last in DOM -->
</div></nav>
```
```css
.nav-break { display: none; }
@media (max-width: 940px) {
  .nav-inner { flex-wrap: wrap; }
  .brand   { order: 0; }
  .nav-cta { order: 1; margin-left: auto; }   /* row 1: brand + CTA */
  .nav-break { display: block; order: 1; flex: 0 0 100%; height: 0; } /* after CTA */
  .nav-links  { order: 2; }   /* row 2: links + ... */
  .nav-social { order: 3; }
  .nav-lang   { order: 4; }   /* stays inline on row 2, every language */
}
```
The break (`flex:0 0 100%`, ordered right after the CTA) pushes everything after
it to row 2, so links/social/lang sit together regardless of text width.

## 4. Choose the nav breakpoint by what fits, not by "phone vs desktop"
Landscape phones report wide viewports (iPhone 14 = 844, Pro Max = 932). A 1-row
desktop nav that intrinsically needs ~914px will overflow there (CTA cut off).
Measure the nav's natural right edge, then switch to the compact layout *above*
it (e.g. `max-width: 940px`) so landscape phones get the compact nav too:
```js
// measure where the rightmost nav item ends, sweeping widths:
const r = await page.evaluate(() => Math.round(document.querySelector('.nav-cta').getBoundingClientRect().right));
// if r > viewportWidth at some width W, the compact nav must cover ≥ W.
```
Verify FR and EN (or all content variants) give identical nav heights and
"flags/items inline" at the same widths.

## 5. Align side-by-side media of different aspect ratios
Put a single-line label above each item and the media right below, with
`align-items: start` on the grid → the media **tops align** even if captions
below differ in length. Collapse to 1 column at the project's standard mobile
breakpoint (mobile = "one after another", no special handling needed).
```css
.media-grid { display:grid; grid-template-columns: 3fr 2fr; gap:36px; align-items:start; }
.media-grid > * { min-width: 0; }                 /* prevent grid blowout */
@media (max-width: 920px){ .media-grid{ grid-template-columns:1fr; } }
```

## 6. 3D / `<model-viewer>` wireframe notes
- A convincing wireframe needs real **`GL_LINES`** primitives. Blender's
  Wireframe *modifier* makes 3D tubes that overlap into a solid blob at any
  useful density — reject it. Instead export TRIANGLES and convert to lines:
  for each triangle add its 3 edges to a `Set` keyed `min,max` (dedupe), then set
  the glTF primitive `mode = 1` (LINES). Draco doesn't support lines — ship plain
  GLB; gzip handles it.
- **Center the geometry** (orbit pivot = visual center) and normalize the bbox to
  ~2 units; an off-center or oversized source makes the model look "uncentered"
  or "too far/too small" in model-viewer even with `bounds="tight"`.
- `rotation-per-second` sign = spin direction (negative ⇒ clockwise).
- Headless Chrome won't advance auto-rotate (no real compositor); verify the
  attribute value + render stills for appearance, don't try to time the spin.
