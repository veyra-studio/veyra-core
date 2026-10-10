# Changelog

## 0.4.1 — 2026-10-10

- **Fix — adaptive quality on very slow devices**: the governor ignored every frame longer than 250 ms as a stall, so a device that could only manage a few frames per second (a software renderer, a far too heavy scene) never had its quality lowered. An isolated long frame is still ignored; three in a row now drop the level to its minimum at once (it climbs back as usual when frames speed up).

## 0.4.0 — 2026-10-10

Noise from a texture. Additive: 0.3 code keeps working.

- **Noise textures** (`noiseTexture`, `tilingNoise` in `@veyra/core/three`): seamlessly tiling gradient noise stored with its analytic gradient, plus a second independent layer; half floats with a box-filtered mip chain.
- **`glslNoiseTexture`** (`@veyra/core/glsl`): `tfbm` and `tfbmd` (value and gradient), 2D and triplanar, read fractal noise from that texture — one texture read per octave instead of dozens of hashes per pixel, filtered in the distance, with bumps that stay smooth up close.
- Example 07's terrain reads its rock detail from a noise texture, with a browser check that the detail shows; the examples index check counts seven examples.

## 0.3.0 — 2026-10-10

Product rendering, terrain and synthesized sound. Additive: 0.2 code keeps working.

- **Turned shapes** (`Profile`, `@veyra/core/three`): smooth measured silhouettes with sharp corners, sample radius and slope, offset with miter joins, clip to closed solids, measure volume, build lathe geometry, and build label bands whose artwork keeps its proportions on cones (`band()`, `halfWidthAt`).
- **Studio light** (`studioEnvironment`, `studioLights`): softbox, strip and reflector setups baked into a PMREM environment — presets `product` and `soft`.
- **Condensation** (`condensationMaps`, `condensationField`): droplets, mist and run tracks as tileable normal and roughness maps.
- **Glossy floors** (`ReflectiveFloor`): mirrored-camera reflections that fade and blur with the reflected object's height (from depth), layer filtering, oblique clipping.
- **Contact shadows** (`ContactShadow`): depth from below, blurred, with `resize()`.
- **Terrain** (`heightfield`, `erodedNoise`, `ridgedNoise`, `valueNoiseD`, `bakeSunlight`, `bakeOcclusion`, `heightfieldMesh`; `heightfieldGeometry` and `meshGeometry` in three): eroded mountains, baked sun shadows and ambient occlusion, worker-friendly mesh arrays, uneven grid layouts.
- **Sound one-shots** (`SoundBus.tone`, `SoundBus.burst`): synthesized tones and filtered noise bursts for clicks, hisses and pings; silent no-ops while sound is off.
- Example 07 *Product & terrain*, with browser checks for the floor reflection, the contact shadow and the terrain bake.

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
