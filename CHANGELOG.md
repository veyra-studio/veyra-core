# Changelog

## 0.8.0 — 2026-10-13

Every device: strong ones keep their quality, phones keep their canvas, silent iPhones play sound that was asked for, and the toolchain runs on Windows. No API removed; the quality governor's defaults change.

- **Quality governor — hitches aren't slowness**: a window is judged by its typical frame (the mean without its slowest tenth), so a few one-off long frames — a texture upload, a shader compiling, a GC pause — no longer lower the quality of a device that is fine. Two such windows used to cost a tier, and the tier fence then kept it for the session (seen once on a desktop GPU while Abali built its later scenes).
- **`quality.hold(work?)`**: no judging while heavy one-off work runs (preloading, building a scene, `warmUp`): pass a promise, a duration in seconds of frames, or call the returned function. Stalls and the warm-up wait too.
- **Steady tiers that can recover once**: a tier left for slow frames may be re-entered once, after `reentryWindows` (default 20, about 10 s) fast windows in a row; leaving it a second time keeps it out for the session. Before, the first drop locked it for good.
- **`maxTargetFps`** (default `60`): the governor no longer trades quality for frame rates above 60 fps on 120/144 Hz screens (the target used to be 86% of up to 120 Hz).
- **Pixel ratio follows the screen**: `quality.syncDpr()`, called by the stage on resize, re-reads `devicePixelRatio` (a window moved to another screen, a zoom).
- **No layout reads in per-frame paths**: `RectCache.view()` no longer reads `window.scrollX` (it forced a layout after the frame's style writes); the offset is read in the measure phase. The scroll controller no longer measures the page on every wheel event; a push past the end is checked against a fresh measurement on the next frame.
- **Steady canvas on phones** (`threeLayer({ stableHeight: true })`, `viewport.stableHeight`): the canvas takes the large viewport's height (`100lvh`), so the address bar sliding in and out no longer resizes it (stretched frames, a new drawing buffer, a camera jump). Opt-in: place things with `layer.height`.
- **One resize at a time**: the three.js layer resizes once per frame at most — a rotation used to resize it twice.
- **Lost WebGL contexts** (`layer.lost`, `layer.onRestore(fn)`): rebuild what lived only on the GPU (an environment from `studioEnvironment`) when the context comes back; the layer pauses rendering while it is lost without overwriting `autoRender`.
- **`layer.warmUp(scene?, camera?)`**: `warmUp` on the layer's renderer, with the quality governor on hold.
- **Sound on silent iPhones**: when the visitor turns sound on (`enable()`, or a choice stored from an earlier visit), the bus asks Safari's Audio Session API for `'playback'`, so it plays with the ring/silent switch on silent; sound that is only on by default still follows the switch. `disable()` hands it back.
- **Fix**: destroying a sound bus while its context resumed threw an unhandled rejection.
- **Windows**: `npm run build`, `release:pack` and `verify:examples` work in PowerShell and cmd (no `rm -rf`, npm spawned through `npm_execpath`, file paths through `fileURLToPath`).
- Example 07 uses `stableHeight`, `onRestore` and `layer.warmUp`; new browser checks: a toolbar sliding in leaves the canvas alone, a rotation resizes it once, and the environment light comes back after a lost context only with `onRestore`.

## 0.7.0 — 2026-10-11

- **Fix — sound "on" but silent**: the bus started audio on `pointerdown` and `keydown`, but a touch's `pointerdown` isn't a user activation, so on phones a stored "on" stayed silent until the visitor toggled sound off and on; a context the system suspended or interrupted (iOS, another app, a call) stayed silent too. It now listens for every activation (`keydown`, `mousedown`, `pointerup`, `touchend`, `click`), in the capture phase, and resumes the context from any state; while a gesture's resume is under way (up to 250 ms) the bus counts as audible, so the sounds of that very gesture play.
- **`defaultOn`** (`SoundOptions`): sound on for visitors who haven't chosen yet; audio starts at their first activation.

## 0.6.1 — 2026-10-10

- **Steady tiers** (`steadyTier`, default `true`): once sustained slow frames push the quality level into a lower tier, it no longer climbs back into the tier it left in the same session (it still rises within its tier, and the pixel ratio with it). A device near a boundary used to step down, recover, climb back and step down again, so whatever a page swaps by tier (Abali's bottle glass) flickered between versions. Stalls and the warm-up don't fence a tier off; `quality.set()` lifts the limit.

## 0.6.0 — 2026-10-10

Lighter on weak devices. No API removed; the governor's and the scroll's defaults change.

- **Quality governor**: windows of 30 frames instead of 45; a window far below target (under 60%) steps down at once, by 0.4 below 40% of target; the measured refresh rate is never taken below `minRefreshRate` (new option, default 60 Hz) — a device rendering at 30 fps used to pass for a 30 Hz screen and was never relieved — and a slow warm-up steps down right away. `estimateQuality()` starts phones and tablets (coarse pointer) at 0.55 instead of counting their eight cores as a desktop's, and lowers further with 2 GB of memory or less.
- **Scroll**: while quality is at its lowest tier, wheel input is left to the browser (`nativeWhenSlow`, default `true`); smoothing comes back when the device catches up.
- **`warmUp(renderer, scene, camera)`** (`@veyra/core/three`): compiles a scene's programs in parallel, then draws it once into a single pixel so textures upload and shadow maps and transmission targets are built — reaching a world built ahead of time no longer stalls a frame. Example 07 warms its product scene, with a browser check.
- **`refractiveSolid`**: its program cache key is a hash of the source instead of the source itself — three.js rebuilds the key whenever a material may need another program, e.g. every frame it draws to the screen and to a render target.

## 0.5.0 — 2026-10-10

Clear solids. Additive: 0.4 code keeps working.

- **Ray-traced clear solids** (`refractiveSolid` in `@veyra/core/three`): patches a `MeshPhysicalMaterial` so light is traced through a solid given as a signed distance function — refraction in and out, internal reflection past the critical angle (the bright and dark edges of real glass and ice), Beer–Lambert tint, and a surface that reflects the same world. Hooks for what the rays see once they leave (`outside`, world space: the environment map by default), what lies inside (`inside`: mist, bubbles, cracks), fine surface relief (`bump`) and an analytic `normal`; an `inner` box narrows the search for each exit. No transmission pass, and nothing depends on what the canvas shows behind the mesh — clear ice and glass over a transparent canvas on a dark page.
- Example 07 sets a block of tinted glass beside the bottle; a browser check confirms the light is traced through it (its tint deepens what lies behind).

## 0.4.3 — 2026-10-10

- **See-through glass** (`ThreeLayer` option and property `seeThroughGlass`): over a transparent canvas, transmissive materials show the page behind the canvas instead of three.js's half-transparent white fill, which turned clear glass and ice milky over a dark page. Example 07 checks the empty neck's alpha with and without it.
- **Fix**: `Profile` reads `{x, y}` points by shape instead of `instanceof THREE.Vector2`, so points made by another copy of three.js (a project aliasing the engine's source) no longer collapse.

## 0.4.2 — 2026-10-10

- **Software rendering** (`isSoftwareRenderer`; `ThreeLayer.software`, `softwareQuality`): WebGL rendered without a GPU (SwiftShader, llvmpipe, the Basic Render Driver) is detected, and the three.js layer starts the stage's quality at its lowest level instead of waiting for slow frames to say so.
- Example checks: the kashida check waits for the page's opening animation to finish, and the horizontal-section checks poll until the snap has landed — both were timing-dependent on a loaded machine. A new check confirms software rendering is detected under SwiftShader.

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
