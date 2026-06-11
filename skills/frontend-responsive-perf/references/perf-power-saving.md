# Performance / power-saving (CPU / GPU / battery)

Principle: **only decode, animate, or render what the user is currently looking
at.** Everything that loops forever is a steady CPU/GPU drain — even off-screen,
even in a background tab (for videos).

## 1. Pause looping videos off-screen and in hidden tabs
A `<video loop>` re-decodes every frame for as long as it plays. There is **no
"cached decoded frames"** — HTTP caching only avoids *re-download*, not
*re-decode*. Off-screen autoplay videos below the fold decode for nothing.

```js
const loopingVideos = Array.from(document.querySelectorAll('video[loop]'));
if (loopingVideos.length && 'IntersectionObserver' in window) {
  const onScreen = new WeakSet();
  const resume = (v) => {
    if (onScreen.has(v) && document.visibilityState === 'visible') v.play().catch(() => {});
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { onScreen.add(e.target); resume(e.target); }
      else { onScreen.delete(e.target); e.target.pause(); }
    });
  }, { rootMargin: '150px' });            // resume just before it scrolls in
  loopingVideos.forEach((v) => io.observe(v));

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') loopingVideos.forEach((v) => v.pause());
    else loopingVideos.forEach(resume);
  });
}
```
The browser throttles CSS animations / rAF in hidden tabs natively, but **not
videos** — so the `visibilitychange` pause is what saves battery there.

## 2. Recompress media to its real display size
Decode cost ≈ **width × height × fps**. A video shown small is decoded at full
resolution regardless. Measure the real rendered size, then re-encode to it.

- A 1920×1080 @ 5 Mbps clip in a ~300px element decodes ~4× more pixels than
  needed. For an `object-fit:cover` / circular element, only the center is
  visible — **crop to that** (removes pixels that were cropped anyway), then
  scale down:
  ```bash
  # center-square crop of a 16:9 source → 720×720, then re-encode:
  ffmpeg -i in.mp4 -vf "crop=1080:1080:(iw-1080)/2:0,scale=720:720:flags=lanczos" \
    -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 25 -preset slow -an \
    -movflags +faststart out.mp4
  ```
- Verify the crop kept the content: extract a frame (`ffmpeg -ss N -i out.mp4
  -frames:v 1 frame.png`) and look at it before replacing the file.
- 24 fps is plenty for background loops; drop fps if higher.

## 3. Freeze off-screen CSS animations
Infinite CSS animations (gradient sweeps, spins, marquees, pulses) repaint
forever even when scrolled away. Pause them per-section.

```css
/* applied when JS marks a section off-screen — covers descendants + pseudos */
.anim-paused,
.anim-paused *,
.anim-paused *::before,
.anim-paused *::after { animation-play-state: paused !important; }
```
```js
const zones = document.querySelectorAll('.hero, .marquee, #about, #creations');
if (zones.length && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.target.classList.toggle('anim-paused', !e.isIntersecting));
  }, { rootMargin: '100px' });
  zones.forEach((z) => { z.classList.add('anim-paused'); io.observe(z); }); // start paused
}
```
**Decide what NOT to pause.** A persistent notification ping (e.g. a chat FAB
dot) you want alive should live *outside* the observed zones so it keeps running.
Be explicit about exclusions so optimization doesn't remove intended motion.

## 4. WebGL / 3D
`<model-viewer>` pauses its WebGL render loop off-screen natively. Additionally
drop/re-add `auto-rotate` with the section's visibility so the turntable angle
stops advancing too:
```js
const mv = document.getElementById('viewer');
new IntersectionObserver((es) => es.forEach((e) =>
  e.isIntersecting ? mv.setAttribute('auto-rotate','') : mv.removeAttribute('auto-rotate')
), { rootMargin: '100px' }).observe(document.getElementById('viewer-section'));
```
Lazy-load heavy 3D engines (Three.js / model-viewer) only near the section if
first-paint cost matters.

## 5. What's usually the biggest win, in order
1. Pause off-screen looping videos (often several decoding below the fold).
2. Recompress the always-visible video to its display size.
3. Pause hidden-tab videos.
4. Freeze off-screen CSS animations.
5. 3D auto-rotate / lazy-load.

Measure before/after with the headless method (count playing videos, sum
`w*h*fps`, check `animationPlayState`). See `verify-headless.md`.
