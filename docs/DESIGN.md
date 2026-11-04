# Design notes for the live page

This file records what was researched before the page was rebuilt, which techniques were chosen and why, and how the
page is checked. It is the engineering rationale behind `docs/index.html`, `docs/assets/site.css`, `docs/assets/site.js`
and `docs/assets/scene.js`. The same design system is used across all of Soham Kavathekar's project pages; the hero
scene and the sticky figure are specific to each repository.

## 1. What was researched

Scroll-driven 3D pages, in the order they were read:

| Source | What was taken from it |
|---|---|
| Codrops, *How to Build Cinematic 3D Scroll Experiences with GSAP* (Nov 2025), https://tympanus.net/codrops/2025/11/19/how-to-build-cinematic-3d-scroll-experiences-with-gsap/ and the companion repo https://github.com/JosephASG/codrops-cinematic-scroll-animations | One tall scroll container (several hundred vh) spaces the "shots"; a single scrubbed GSAP timeline is the director for camera position, mesh transforms and material uniforms; `scrub` values around 0.8–1 smooth the scrub without lagging. The article uses ScrollSmoother (Club GSAP); this page uses Lenis for the same job because it is MIT and on a public CDN. |
| Lenis README, https://github.com/darkroomengineering/lenis/blob/main/README.md | The canonical GSAP sync: `lenis.on('scroll', ScrollTrigger.update)`, drive `lenis.raf` from `gsap.ticker` (seconds × 1000), `gsap.ticker.lagSmoothing(0)`. One loop drives smooth scroll, ScrollTrigger and the WebGL scene. |
| GSAP docs, `gsap.matchMedia()` and `prefers-reduced-motion`, https://www.gsap.com/docs/v3/GSAP/gsap.matchMedia()/ | Put every scrubbed tween and pin inside `mm.add("(prefers-reduced-motion: no-preference)", …)`, and set final states directly in the `reduce` branch. |
| three.js forum threads on post-processing resolution, https://discourse.threejs.org/t/solved-why-the-image-looks-so-low-res-after-applied-unrealbloompass/17361 and https://discourse.threejs.org/t/postprocessing-adds-a-lot-of-pixelation/55813 | Set the renderer's pixel ratio and size before constructing `EffectComposer`; resize through `composer.setSize`, never the passes by hand; clamp `devicePixelRatio` because every pass costs 4× at 2× ratio. |
| GPU particle gallery on three.js r160, https://github.com/danlex/particles, and a DOF + selective-bloom portfolio, https://discourse.threejs.org/t/futamura-dev-personal-portfolio-where-every-page-is-a-different-webgl-experiment/93642 | Bloom at half resolution is enough for a glow; depth of field only where the scene has real depth layering, otherwise it reads as blur. Detect the device tier before building the heavy scene and serve a lighter version. |
| Apple-style pinned stage write-ups, https://ddingpy.github.io/mynote/posts/building-an-apple-style-scroll-experience-like-the-macbook-neo-page and https://theplusaddons.com/blog/scrollytelling/ | A 200–500 vh track with a sticky stage; a static fallback frame; a reduced-motion variant; do not stack more than a few pinned sections on one page; decide mobile behaviour deliberately. |
| A practitioner guide to scroll-driven 3D, https://svilenkovic.com/3d/how-to-make-scroll-driven-3d | Master timeline wrapped in one ScrollTrigger with `scrub`; camera on a spline; scroll-driven builds feel sluggish on mobile unless the scene is reduced. |
| Animated SVG in GitHub READMEs, https://blog.scalar.com/p/how-we-created-an-animated-responsive and https://dev.to/sieis/animate-svgs-for-github-readmes-420d | GitHub's image proxy strips scripts but keeps CSS `@keyframes` and `animation` when the `<style>` block is inside the SVG file itself and the file is loaded through `<img>`. SMIL is not relied on. |
| Lighthouse guidance on deferring scripts, https://www.debugbear.com/docs/how-to-defer-javascript-on-your-website | Keep the LCP element (the hero heading) in plain HTML, load the 3D as a module (deferred by definition) so first paint does not wait for three.js. |

What was rejected and why:

- **GSAP ScrollSmoother**: Club plugin, not on a public CDN under a permissive licence. Lenis does the job.
- **pmndrs/postprocessing**: faster single-pass merging, but mixing it with three's `EffectComposer` is a known footgun and the page only needs bloom plus one optional pass. three's own composer from the same pinned release keeps every import at one version.
- **WebGPU renderer**: not yet universal on the laptops and phones a recruiter opens this on; WebGL 2 is.
- **SMIL in the README hero**: unreliable through GitHub's proxy. CSS keyframes only.
- **A video-scrubbed hero** (the current apple.com technique): the data here is real geometry, and a video would hide that it is.

## 2. The chosen stack, pinned

| Piece | Version | Why this one |
|---|---|---|
| three.js (ES modules via import map from jsDelivr) | 0.186.1 (2026-09-24) | latest release older than two weeks at build time; `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `BokehPass`, `OutputPass`, `OrbitControls`, `RoomEnvironment` from the same release |
| GSAP + ScrollTrigger | 3.15.0 | master timeline, pin, scrub, count-ups, `matchMedia` for reduced motion |
| Lenis | 1.3.27 | smooth scroll with the documented ScrollTrigger sync |

Everything else is hand-written in the three files under `docs/assets/`.

## 3. Page architecture

1. **Pinned hero.** `.hero-track` is 320 vh tall on desktop (240 vh on phones). Inside it `.hero` is `position: sticky` so the WebGL stage stays in view while the stats band and the first section scroll over it with a translucent backdrop. The sticky element, not a ScrollTrigger pin, holds the stage: it survives Lenis, resize and iOS toolbar collapse without re-measuring.
2. **Master timeline.** One `gsap.timeline()` with a `ScrollTrigger` on the track, `scrub: 0.8`, animates a plain object `{t, fade, glow, …}`. The scene reads that object every frame: `t` moves the camera along a `CatmullRomCurve3` of keyframed positions and lerps the look-at target; `glow` and material parameters follow it. The copy block fades and lifts in the same timeline so text and camera are one gesture.
3. **Count-ups.** Every `[data-count]` tweens a proxy value with `ScrollTrigger` at `top 85%`, `once: true`, with the final value written as text for reduced motion and for crawlers.
4. **Sticky method figure.** The method section is a two-column grid: a sticky figure (canvas or figure) and a column of steps. Each step has its own `ScrollTrigger` with `onEnter`/`onEnterBack` at the viewport centre that sets the figure state; the figure animates toward that state in its own render loop.
5. **Theme.** Light and dark follow the OS and a toggle; `themechange` events let the scenes swap background and material tints and the figures swap their `_light`/`_dark` SVGs.
6. **Rendering discipline.** `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` (1.5 on phones); `ResizeObserver` → `renderer.setSize(w, h, false)` + `composer.setSize(w, h)`; the hero renders only while it is on screen (`IntersectionObserver`) and only when something changed (scroll progress, controls damping, autorotate); `pagehide` disposes geometries, materials, render targets and the renderer. If `WebGLRenderer` throws, the static `hero.png` fallback is shown and the page is complete without it.
7. **Reduced motion.** Under `prefers-reduced-motion: reduce` the timeline is not scrubbed, the camera sits at its final keyframe, autorotate and bloom pulsing are off, count-ups print their final value, and Lenis is not started.
8. **Mobile (375 px).** Same scene, reduced: a coarser height-map grid and fewer gas streamlines, pixel ratio 1.5, bloom kept, depth of field off, legend hidden, hero track shorter.

## 4. Performance budget and QA

- Budget: first contentful paint under 2 s on a mid laptop, total transfer under 4 MB, 60 fps on an M1 MacBook Air.
- How it is met: the LCP element is the hero heading in static HTML; three.js and the scene load as a deferred module; the data file is a classic script so it parses in parallel; figures are SVG; PNGs are quantised to 256 colours; no web fonts (system stack).
- Checks committed under `docs/qa/`: full-page screenshots at 1440 px and 375 px from a headless Chromium with every image and canvas confirmed loaded and the console clean, and a Lighthouse report (`lighthouse.report.html` + `.json`, desktop preset) run against the page served from `docs/` exactly as GitHub Pages serves it. The headless browser renders WebGL in software, so its frame times are not representative; frame budget is verified by the renders-only-when-needed rule and the instance counts in `scene.js`.

## 5. This repository's hero

The hero is the axisymmetric reactor: a showerhead inlet 20 mm above a 300 mm wafer inside the chamber, with gas
streamlines falling from the inlet and the precursor concentration at the wafer plane drawn as a height map over the wafer.
The height map is the actual exported radial profile from `docs/assets/data.js`, revolved about the axis. Scrolling
scrubs the inlet from 10 mm to 150 mm and morphs the height map through the three states the study measured: the 10 mm
inlet (σ = 179.6 %, a spike over the centre), the full-span inlet at 0.10 m/s (6.1 %) and the full-span inlet at 0.07 m/s
(3.3 %), with the readout counting the same way. The streamlines slow with the inlet velocity. The sticky figure in the
designed-experiment section is the wafer-plane profile of the run under discussion, and the 3D section keeps the real
6,012-node wafer face from the three-port model as a rotating height map. The README hero (`docs/assets/hero.svg`) is the
radial profile morphing between the three states with CSS keyframes on an SVG path, generated by `docs/build_assets.py`.
