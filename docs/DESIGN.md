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

## 6. Round 3: every body figure in 3D, one renderer, and a light mode without glare

### What was researched

| Source | What was taken from it |
|---|---|
| three.js example *webgl_multiple_elements*, https://github.com/mrdoob/three.js/blob/master/examples/webgl_multiple_elements.html | The pattern for many scenes on one page: one fixed, transparent canvas behind (here: above, pointer-transparent) the content, one `WebGLRenderer`, and for each view `setViewport` + `setScissor` to the bounding rectangle of its placeholder element, skipping views that are off screen. One context for any number of figures, so the browser's WebGL-context cap (about 16) is never reached and the GPU memory of one renderer is shared. |
| three.js forum, *What to use a renderer's scissor for?*, https://discourse.threejs.org/t/solved-what-to-use-a-renderers-scissor-for/1050, and *Multiple overlapping three.js WebGL elements*, https://grahampullan.github.io/viz/2025/02/02/Overlapping-webgl-elements.html | Scissor clips the clear and the draw to the rectangle; it does not know about DOM overlap, so the placeholders here are plain boxes with no HTML inside them, the legend and the caption sit outside the box, hover readouts are one fixed tooltip appended to `body`, and the scissor is clipped under the fixed nav bar. |
| three.js forum threads on `UnrealBloomPass` and bright backgrounds, https://discourse.threejs.org/t/i-still-dont-get-how-unrealbloompass-works/57843/2 and https://discourse.threejs.org/t/unreal-bloom-pass-effect-on-shader-materials/64465 | Bloom thresholds on the luminance of the linear HDR frame. A pale page background (about 0.93 luminance) sits above the 0.8 to 0.9 thresholds used for the dark theme, so the whole frame bloomed in light mode: that was the glare. The fix is per theme: threshold 1.0 on the half-float target so only emissive HDR pixels bloom, strength scaled to 0.18, exposure 0.82. |
| three.js docs, `WebGLRenderer.toneMapping` and `OutputPass` (ACES filmic) | Tone mapping stays ACES filmic in both themes; only `toneMappingExposure` changes with the theme. The output pass does the colour-space conversion once at the end of the chain. |

### What changed

1. **One shared renderer for the body (`assets/viz.js`).** Every graph, schematic and process diagram on the page is a scene registered on a `.viz` placeholder. A single fixed canvas (`.viz-canvas`, `pointer-events: none`, `z-index` above the sections) is drawn once per frame with `autoClear` off: clear, then for each visible view set the viewport to the element's rectangle, the scissor to the part of it below the nav, and render. The hero keeps its own stage because it runs the post-processing chain (bloom, depth of field); the body views are plain forward-rendered scenes with a shared `RoomEnvironment` map.
2. **Scroll-driven assembly.** Each view's progress goes from 0 when its top enters at 92 % of the viewport to 1 when its centre reaches 58 %, eased per frame. Ribbons draw with `setDrawRange`, bar fields grow with a staggered ease, surfaces rise from flat, tile fields drop into place, and exploded assemblies fly their parts in from an offset in the order a technician would stack them. Progress is computed from the same `getBoundingClientRect` that the scissor needs, so no ScrollTrigger is involved and Lenis, resize and iOS toolbar changes are handled for free.
3. **Render-on-demand, per view.** A view renders only while its rectangle intersects the viewport and only when its progress, hover, drag or an animation changed, or the page scrolled (the fixed canvas must repaint when the rectangles move). Geometries, materials, textures and the renderer are disposed on `pagehide`.
4. **Readable in both themes.** Axes, ticks and labels are canvas-texture sprites redrawn on `themechange` with the theme's ink colour; data colours come from a per-theme palette (`PALETTES` in `three-kit.js`): bright hues on the dark stage, the same hues darkened for the pale stage so every series keeps at least 3:1 contrast against it. Materials tagged with a palette key recolour themselves on theme change.
5. **Hover readouts and orbit.** On desktop a raycaster over the view's pickable meshes shows the data point, bar, tile or part under the pointer in a fixed tooltip; dragging on a placeholder orbits that scene. On phones the scenes are smaller (4:3 placeholders, pixel ratio 1.5), not removed.
6. **Static fallback.** Under `prefers-reduced-motion: reduce` or without WebGL the module never creates a renderer; each placeholder shows `assets/viz_<scene>_<theme>.png`, the same scene captured at full progress in both themes by `docs/build_assets.py` (headless Chromium through `docs/tools/page-qa.mjs`) and quantised to 256 colours.
7. **Light mode in the shared stage (`three-kit.js`).** `createStage` now applies a per-theme block: exposure 1.0 / 0.82, bloom strength × 1.0 / × 0.18 with threshold 1.0 in light mode, environment intensity × 1.0 / × 0.55, scene lights × 1.0 / × 0.8, and the stage colour from the palette (`#0f172a` / `#e3e9f1`). Scenes call `stage.setBloom()` instead of writing the pass strength directly, so the pulse on scroll is scaled too. Hero copy uses the page ink colour in both themes; there is no light text over the pale stage.
8. **QA in both themes.** `docs/build_assets.py --qa --lighthouse` captures the hero, the first two body scenes and the 375 px hero in `docs/qa/dark/` and `docs/qa/light/`, checks the console and failed requests, and runs the desktop Lighthouse preset; the summary is in `docs/qa/README.md`.

- **Software renderers.** `site.js` reads the unmasked WebGL renderer string; SwiftShader, llvmpipe and the Microsoft basic renderer cannot animate a full-screen scene at interactive rates, so on those the page serves its reduced path (hero at the final keyframe, static fallbacks for the body scenes). Lighthouse's headless Chromium is one of them, so the committed report measures that path; the QA screenshots are taken with `window.__forceGL` set so they show the live scenes.

### Budget

Total page under 4.5 MB with every fallback counted, Lighthouse desktop performance 95 or above (the hero heading stays the LCP element in static HTML; the body module loads deferred and builds its scenes after `siteready`), 375 px layout with scenes reduced not removed.

### This repository's body scenes (`assets/body.js`)

| Placeholder | Scene | Data |
|---|---|---|
| `reactor` | the axisymmetric chamber as an exploded cross-section (susceptor, wafer, exhaust slit, wall, plenum, showerhead) that assembles on scroll and then widens the inlet from 10 to 150 mm | `geometry` in `assets/data.js` |
| `profiles` | the three wafer-plane profiles (10 mm inlet, full span at 0.10 and 0.07 m/s) as ribbons normalised by their means | `profiles` |
| `doe` | the fourteen DOE profiles as ribbons stacked by inlet velocity and coloured by temperature; the sticky steps highlight the run in view | `doe` |
| `response` | σ against inlet velocity on a log axis at 900, 1000 and 1100 K as ribbons with the run points and the optimum tagged | `doe` |
| `checks` | the two-zone architectures and the gap, pressure and rotating-disk checks as a bar field | `profiles` |

The 3D wafer face keeps its own stage (orbit controls on the 6,012-node export) and takes the per-theme lighting from the shared runtime.

### This repository's body scenes (`assets/body.js`)

| Placeholder | Scene | Data |
|---|---|---|
| `stack` | the five-layer cell exploded to its (log-compressed) thicknesses, assembling on scroll, with the conduction- and valence-band steps of each layer and the nickel work function drawn beside it | `stack` in `assets/data.js` |
| `etl` | the ten-ETL screen as a two-row bar field: efficiency in front, short-circuit current behind | `ranking` |
| `jv` | the ten J-V curves at the best thickness as ribbons stacked by rank | `etl.*.jv_best` |
| `sweeps` | efficiency against the swept parameter for the CdTe, FTO, ZnSe and ETL thicknesses and for temperature, as ribbons over the normalised range; the sticky steps highlight one | `layers`, `temperature` |
| `temperature` | the six J-V curves from 300 to 400 K as ribbons | `jv_temperature` |
| `contact` | efficiency against back-contact work function as bars at each metal's φ, with the 5.4 eV valence-band line | `back_contact` |
