---
name: frontend-responsive-perf
description: Framework-agnostic techniques for pixel-perfect responsive layouts (mobile/tablet/desktop/landscape), correct nav/menu/widget alignment, and cutting a web page's CPU/GPU/battery use (looping videos, CSS animations, WebGL/3D). Also covers an in-page PDF.js viewer for scanned documents (blank/missing images = CCITTFaxDecode masks; transcode CCITT→Flate with PyMuPDF), building a lightweight no-LLM client-side chatbot, and the headless-Chrome method to VERIFY all of it. Use when building or fixing responsive UI, debugging horizontal overflow, aligning navbars/flex/grid items, optimizing page performance/power, embedding or debugging a PDF viewer, or adding a rule-based chat widget. Vanilla CSS/JS, no framework required.
---

# Frontend responsive & performance toolkit

Reusable, framework-agnostic patterns distilled from shipping a polished
vanilla site. Each rule below earned its place by fixing a real bug. Open the
`references/` files for full code and the "why".

## Golden rule: measure, don't guess
Never claim a layout/perf fix works from reading CSS. Drive the page in headless
Chrome (Puppeteer) and **measure**: horizontal overflow, element rects, computed
`animationPlayState`, `video.paused`, nav row positions; take screenshots at
several widths. For 3D, render the asset. See `references/verify-headless.md`.
Most "fixed" claims that get rejected were never actually checked.

## Responsive & alignment (see references/responsive-and-alignment.md)
- **Kill Android Chrome "font boosting"** first: `html,body { -webkit-text-size-adjust:100%; text-size-adjust:100% }`. It silently overrides `clamp()` font sizes and overflows layouts (typically only on some Android phones / landscape). Add `overflow-x:hidden` as a *safety net* and `h1,h2,h3,h4,p { overflow-wrap:anywhere }` — but always fix the real overflow source too.
- **Find the actual overflow culprit**, don't mask it: temporarily force `html,body{overflow-x:visible!important}` in headless, then list every element whose `right > viewportWidth`. Common cause: a `grid-template-columns: repeat(N, auto)` / `white-space:nowrap` row that won't shrink → make it wrap/fewer columns at a breakpoint.
- **Flex-wrap nav layouts depend on label length** — that's a trap. Short labels (or another language) ride up onto row 1; long ones wrap. To force a deterministic multi-row nav, insert a zero-height **full-width break element** (`flex:0 0 100%; height:0`) ordered right after the row-1 items. Layout then no longer depends on text width or language.
- **Pick the nav breakpoint by what fits, not by device class.** Landscape phones report wide viewports (iPhone 14 = 844px, Pro Max = 932px); a desktop 1-row nav that needs ~914px will overflow there. Measure the nav's intrinsic right edge and switch to the compact layout *above* that (e.g. ≤940px), so landscape phones get it too.
- **Keep menus uniform across content lengths / languages.** Verify the same layout at the same widths in every language before shipping.
- For side-by-side media of different aspect ratios, align them at the **top** (single-line label above each) and let captions hang below; collapse to one column on mobile at the project's standard breakpoint.

## Performance / power-saving (see references/perf-power-saving.md)
- **Only decode/animate/render what the user is looking at.**
- **Looping `<video>` re-decodes every frame forever** — there is no "cached
  decoded frames"; HTTP cache only avoids *re-download*. Pause each
  `video[loop]` when off-screen (IntersectionObserver) and when the tab is
  hidden (`visibilitychange`). Off-screen autoplay videos below the fold are
  pure waste.
- **Decode cost ≈ width × height × fps.** Recompress media to its *real display
  size*: a 1080p video shown in a ~300px element is ~4× wasted. Crop to what's
  actually visible (e.g. a circular/`object-fit:cover` element only shows the
  center) before scaling down.
- **Freeze off-screen CSS animations**: toggle a `.anim-paused` class on a
  section via IntersectionObserver; CSS sets `animation-play-state:paused` on it
  + all descendants + pseudo-elements. Infinite animations repaint forever
  otherwise.
- **WebGL/3D**: `<model-viewer>` pauses rendering off-screen natively; also
  toggle `auto-rotate` so the turntable stops advancing.
- The browser already throttles CSS animations / rAF in **hidden tabs** — but
  NOT videos, so the video pause is the lever that matters there.
- Decide explicitly what to *exclude* (e.g. a persistent notification ping you
  want to keep alive) so optimization doesn't kill intended UX.
- **Swapping between two renderers by breakpoint? Gate the swap on a JS class,
  never on the width media query alone.** Classic case: desktop uses an alpha
  **WebM** `<video>`; mobile/iOS (no alpha-video support) decodes an MP4 into a
  `<canvas>`. If CSS hides the video and shows the canvas purely at
  `≤Wpx`, but the JS *chose* the renderer once at load from `matchMedia`, then a
  desktop page **loaded wide, then resized below W**, hides the working video
  and reveals a **canvas the JS never initialized** → only the background/halo
  remains (silent, no error). Fix: JS adds a class (e.g. `.use-canvas`) **only
  when it actually inits the alternate renderer**; CSS keys the whole swap off
  that class, not the width. The width media query keeps *layout* rules only.
  Then a resize across the breakpoint leaves the already-running renderer in
  place. Verify BOTH directions: load wide→shrink, and load narrow→grow.
- Beware verifying video visibility in a headless/preview browser: **autoplay is
  blocked without a user gesture**, and a paused video driven by an
  opacity-on-`timeupdate` fade sits at `opacity:0` → looks identical to the
  bug ("halo only"). Confirm the element is present + `display:block` +
  in-viewport via the DOM, then force `opacity:1` (and a `currentTime`) to prove
  the frame renders; don't conclude from the paused-blank paint.

## Lightweight chatbot, no LLM (see references/chatbot-rule-engine.md)
- A rule-based **intent engine** can feel smart with zero API/cost/key:
  normalize input (lowercase + strip accents + strip punctuation) →
  **specificity-weighted keyword scoring** (longer/multi-word cues outrank short
  generic ones) → pick best intent → rotate 2-3 response variants. Add
  smalltalk + follow-up + fallback.
- **Detect the language per message** and answer in it (cheap stopword + accent
  heuristic), independent of the page language.
- Render assistant copy you author with `innerHTML` (for `<b>`/links); render
  **user input with `textContent`** — never as HTML.

## PDF.js viewer for scanned documents (see references/pdfjs-scanned-docs.md)
- **PDF.js silently drops images it can't decode** — no console error, no
  exception, the page just renders without them. Blank areas where diagrams
  should be = suspect the image codec, not the viewer code. Diagnose with
  `page.getOperatorList()`: if `paintImageMaskXObject`/`paintImageXObject` ops
  are absent while the PDF's objects contain `/Subtype /Image`, the parser
  dropped them.
- **Old scanned PDFs use CCITTFaxDecode image masks** (`/ImageMask true`,
  fax G4 compression) — the format PDF.js chokes on (still true in v6.x).
  macOS Preview/Acrobat/MuPDF decode them fine, so the file *looks* healthy.
- **Fix at the file level, not the viewer**: transcode CCITT→Flate with PyMuPDF
  keeping ImageMask semantics — `fitz.Pixmap(doc, xref)` decodes the mask
  (alpha: 255 = painted), repack 1-bit rows (`alpha<128 → bit 1`), then
  `update_object()` WITHOUT `/Filter`+`/Length` and `update_stream(raw,
  new=True)` so PyMuPDF deflates and sets the filter itself (setting them
  manually + `compress=False` corrupts the stream). ~+10% file size.
- **Verify by pixel-diffing every page** (original vs transcoded, MuPDF render
  at low dpi) — must be 0 bytes different — then confirm in the real viewer by
  sampling canvas pixels on an image-heavy page (center `getImageData`
  non-white %), not just "no error".
- **Regenerate any cover/thumbnail from the fixed PDF** with a tolerant
  renderer (PyMuPDF), never from a screenshot of the broken viewer — covers
  made earlier may be missing the same images without anyone noticing.

## 3D wireframe / model-viewer (see references/responsive-and-alignment.md §3D)
- For a clean "wireframe" look use real **`GL_LINES`** primitives (convert
  triangles → deduped edges), NOT Blender's Wireframe modifier (its tubes
  overlap into a solid blob). Center the geometry so the orbit pivot is the
  object center; normalize the bbox. `rotation-per-second` sign sets spin
  direction (negative = clockwise). Headless Chrome can't advance model-viewer
  auto-rotate — verify direction from the attribute + docs, render stills for
  appearance.
