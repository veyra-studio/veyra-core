# Changelog

## 0.2.0 — 2026-10-10

Interaction, layout motion, Persian typography and procedural tools. Additive: 0.1 code keeps working.

- **Horizontal sections** (`horizontal`): pinned, direction-aware horizontal travel with snapping, `--panel-progress`, panel tracking and focus handling.
- **Dragging** (`draggable`): inertia, rubber-band bounds (`'parent'`, object or function), snap points (list, step or function) seeded with the throw, keyboard stepping, click suppression, reduced-motion landing.
- **Pointer effects**: `magnetic`, `tilt` (with glare variables; no transform at rest), `cursor` (labels from `data-cursor`).
- **Marquee** (`marquee`): seamless, reading-direction aware, scroll-velocity reactive, `inert` copies, idles offscreen.
- **FLIP** (`flip`, `captureLayout`, `flipFrom`): layout transitions with scale, transform-origin aware, interruptible, fade-in for new elements.
- **Stagger patterns** (`stagger`): from start/end/center/edges/index/random, grids with RTL mirroring, `total`, eased distribution. `TweenOptions.stagger` accepts the returned `StaggerFn`.
- **Inertia** (`Decay`, `projectDecay`): analytic exponential decay.
- **Kashida** (`kashida`, `elongate`, `kashidaPoints`): Persian/Arabic tatweel elongation on valid, calligraphically ranked connections; animatable `level`.
- **Scramble** (`scrambleText`): script-aware decode effect as a playable or scrubbable timeline.
- **Noise** (`createNoise`, `noise2`, `noise3`, `fbm2`, `fbm3`): seeded improved Perlin noise.
- **GLSL chunks** (`@veyra/core/glsl`): `glslHash`, `glslNoise`, `glslSdf`, `glslColor`, `glslMath` with include guards.
- **Image sequences** (`imageSequence`): scroll-scrubbed canvas sequences with progressive loading and quality-governed resolution.
- **Stage**: `stage.media(query)`, `stage.onRefresh(fn)`; `whenVisible(el, fn)`.
- **Transforms**: `transformPerspective` key.
- **Distribution**: CI publishes every green `main` build to the `release` branch (packed package without dev dependencies), tagged per version; projects install `github:veyra-studio/veyra-core#release`.
- Tooling: `npm run verify:examples` drives every example in headless Chromium; three new examples (interaction, horizontal sections, procedural).

## 0.1.0 — 2026-10-09

First release.

- Ticker with ordered phases, hidden-tab pause, delta clamping and fault isolation.
- Motion: seekable timelines (positions, labels, stagger, calls, nesting), interpolation of numbers/colors/CSS strings, element transform composition, analytic springs, easing library with `cubicBezier`.
- Smooth native scroll controller with anchor handling, locking and focus management.
- Scroll scenes with anchors, presets, CSS variable output, timeline scrubbing, smoothing and culling.
- Layout rect cache with live tracking.
- Script-aware `splitText`: Arabic-script joining preservation, lam-alef, ZWNJ, bidi run isolation (incl. W7), masks, a11y copy.
- Preloader, adaptive quality governor, sound bus, debug overlay.
- `createStage` composition root with plugin API.
- `drawElementText`: renders an element's text into a 2D canvas with its real font and line breaks (Canvas2D or WebGL use).
- `supportsWebGL2`: renderer-free capability detection (keeps three.js out of entry bundles).
- `@veyra/core/three`: three.js layer with pixel camera (configurable `fov` / `near`), DOM anchors, DOM text mirroring.
- Package ships `src/` so source maps resolve.
