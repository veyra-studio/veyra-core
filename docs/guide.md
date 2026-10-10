# Guide

Everything is exported from `@veyra/core`; three.js helpers from `@veyra/core/three`.

- [Stage](#stage)
- [Ticker](#ticker)
- [Motion: timelines and tweens](#motion-timelines-and-tweens)
- [Stagger patterns](#stagger-patterns)
- [Springs, inertia and damping](#springs-inertia-and-damping)
- [FLIP layout transitions](#flip-layout-transitions)
- [Scroll](#scroll)
- [Scenes](#scenes)
- [Horizontal sections](#horizontal-sections)
- [Dragging](#dragging)
- [Pointer effects: magnetic, tilt, cursor](#pointer-effects-magnetic-tilt-cursor)
- [Marquee](#marquee)
- [Text splitting](#text-splitting)
- [Persian typography: kashida and scramble](#persian-typography-kashida-and-scramble)
- [Noise and GLSL](#noise-and-glsl)
- [Terrain](#terrain)
- [Image sequences](#image-sequences)
- [Visibility, media queries and layout refresh](#visibility-media-queries-and-layout-refresh)
- [Preloading](#preloading)
- [Adaptive quality](#adaptive-quality)
- [Sound](#sound)
- [Reduced motion](#reduced-motion)
- [three.js layer](#threejs-layer)
- [Product rendering: turned shapes, labels, studio light](#product-rendering-turned-shapes-labels-studio-light)
- [Clear solids: ray-traced ice and glass](#clear-solids-ray-traced-ice-and-glass)
- [Debugging](#debugging)
- [Recipes](#recipes)

## Stage

The stage wires the loop, viewport, pointer, scroll, layout cache, quality governor and scenes.

```ts
import { createStage } from '@veyra/core'

const stage = createStage({
  scroll: { smooth: true },         // or false for plain native scroll
  quality: { dprRange: [1, 2] },    // or false
  sound: true,                      // optional sound bus (off until the visitor enables it)
  debug: 'auto',                    // overlay when the URL has ?debug
  reducedMotion: 'system',          // or true/false to force
})

stage.onFrame((frame) => { /* every frame */ })
stage.refresh()   // re-measure after you change layout (batched to next frame)
stage.destroy()
```

Layout refreshes happen automatically on width changes, font loading, `load`, and document height changes; `stage.onRefresh(fn)` runs your own re-measuring at the same moments.

Capabilities that need the stage are plugins, so bundles only carry what a page uses:

```ts
import { createStage, horizontal, draggable, marquee, magnetic, tilt, cursor, imageSequence } from '@veyra/core'

const stage = createStage()
const gallery = stage.use(horizontal('.gallery', { snap: true }))
stage.use(cursor())
```

Every plugin returns a controller with `destroy()`, and `stage.destroy()` tears them all down.

## Ticker

```ts
import { Phase, getDefaultTicker } from '@veyra/core'

const ticker = getDefaultTicker()
const off = ticker.add(({ time, delta, rawDelta, frame }) => {}, Phase.render)
ticker.timeScale = 0.5   // slow motion for everything
off()
```

`delta` is clamped (default 1/15 s) so a stall never teleports animations. A callback that throws is logged once and removed; the loop keeps running.

## Motion: timelines and tweens

```ts
const tl = stage.timeline()
tl.fromTo('.line', { y: '110%' }, { y: '0%' }, { duration: 1.1, stagger: 0.08, ease: 'glide' })
  .to(card, { x: 120, rotate: 4, opacity: 0.6 }, { duration: 0.8 }, '<0.2')
  .call((dir) => dir === 1 && sound.play(pop), '+=0.1')
  .label('outro')
  .to(material.uniforms.uReveal, { value: 1 }, { duration: 1.4, ease: 'drift' }, 'outro')
tl.play()            // in time…
tl.progress = 0.5    // …or scrubbed (see scenes)
await tl.finished
```

Targets: elements (transform shorthands `x y z rotate rotateX rotateY scale scaleX scaleY skewX skewY transformPerspective`, `opacity`, CSS custom properties `--name`, any style property), selectors, arrays/NodeLists, and plain objects (including uniforms and signals via `value`).

Values: numbers, colors (`#hex`, `rgb()`; mixed in linear light), and strings containing numbers (`'inset(0% 0% 100% 0%)'`, `'blur(8px)'`, `'12vw'`).

Positions: `2` (absolute), `'<'`/`'>'` (start/end of previous), `'<0.2'`, `'+=0.5'`, `'label+=0.3'`.

Start values are captured the first time the playhead reaches a tween, so sequences chain naturally. `fromTo` applies its start state immediately.

One-shot: `animate(target, vars, options)` or `stage.animate(...)` (which honors reduced motion).

Eases: `linear`, `sine*`, `quad*`, `cubic*`, `quart*`, `quint*`, `expo*`, `circ*`, `back*`, `elasticOut`, `bounceOut`, and Veyra's `glide` (soft landing), `drift` (weighty in-out), `snap` (decisive), `tension` (anticipation). Or `cubicBezier(x1, y1, x2, y2)`.

## Stagger patterns

```ts
import { stagger } from '@veyra/core'

tl.to(cards, { opacity: 1, y: 0 }, { stagger: stagger(0.06, { from: 'center' }) })
tl.to(cells, { scale: 1 }, { stagger: stagger(0.03, { grid: [6, 10], from: 'start', rtl: true }) })
tl.to(dots, { opacity: 1 }, { stagger: stagger(0, { total: 1.2, from: 'random', ease: 'quadIn' }) })
```

`from`: `'start' | 'end' | 'center' | 'edges' | 'random' | index`. With `grid: [rows, columns]` the wave travels by 2D distance (`axis: 'x' | 'y'` for one axis); `rtl: true` mirrors the grid so `'start'` is the top-right cell. `total` spreads all delays over a fixed time; `ease` shapes the distribution.

## Springs, inertia and damping

```ts
import { Spring, springs, damp } from '@veyra/core'

const tilt = new Spring(0, springs.bouncy)
stage.onFrame(({ delta }) => {
  tilt.target = stage.pointer!.nx * 0.3
  mesh.rotation.y = tilt.step(delta)
})

// Lightweight follow, frame-rate independent:
x = damp(x, targetX, 8, delta)
```

Springs are solved analytically — exact for any time step, stable at 30 Hz or 240 Hz.

Inertia is the same idea for a thrown object coasting to rest:

```ts
import { Decay } from '@veyra/core'

const coast = new Decay(0, { timeConstant: 0.325 }).start(x, releaseVelocity)
coast.target               // where it will stop: value + velocity × timeConstant
stage.onFrame(({ delta }) => (x = coast.step(delta)))
```

## FLIP layout transitions

Record where elements are, change the layout any way you like, and they travel from their old boxes to their new ones on transforms:

```ts
import { flip, captureLayout, flipFrom, stagger } from '@veyra/core'

flip('.card', () => grid.classList.toggle('is-list'), { duration: 0.7, stagger: stagger(0.02, { from: 'center' }) })

// Around asynchronous work:
const before = captureLayout('.card')
await renderResults()
flipFrom(before, { immediate: stage.reducedMotion.value }, '.card')   // include new cards
```

Size changes animate with scale (`scale: false` keeps content from stretching). Elements that had no box before fade in. Interrupting a running flip starts the next from where elements are on screen. Elements shouldn't carry other rotate/scale transforms.

## Scroll

```ts
stage.scroll!.scrollTo('#chapter-3', { duration: 1.4, ease: 'drift', offset: -40 })
stage.scroll!.lock()      // e.g. during an intro
stage.scroll!.unlock()
stage.scroll!.y; stage.scroll!.velocity; stage.scroll!.progress
```

- Wheel input is smoothed; keyboard, scrollbar, touch and find-in-page stay native and are followed.
- While quality is at its lowest tier, the wheel is left to the browser too (`nativeWhenSlow`, default `true`): smoothing can't look smooth at a low frame rate, and native scrolling stays responsive.
- Same-page anchor links are intercepted to scroll smoothly; focus moves to the target.
- Add `data-veyra-native-scroll` to nested scrollable areas to leave their wheel events alone.

## Scenes

```ts
import { scenePresets } from '@veyra/core'

stage.scene('#chapter', {
  start: 'top bottom',          // element top meets viewport bottom
  end: 'bottom top',
  cssVar: '--progress',         // mirrored onto the element
  smooth: 8,                    // optional progress smoothing
  timeline: tl,                 // scrubbed by progress
  onEnter, onLeave, onEnterBack, onLeaveBack,
  onProgress: (p, scene) => {},
  onUpdate: (scene, frame) => {},   // every frame while near the range
})
```

Anchors: `"<element edge> <viewport edge>"`, edges `top | center | bottom | 25% | 120px`, with offsets `top+=80`, `bottom-=10%`.

Presets: `inView` (`top bottom → bottom top`), `pinned` (`top top → bottom bottom`), `reveal` (`top bottom → top center`), `through` (`top top → bottom top`).

**Pinning** — give the scene a tall wrapper and a sticky child:

```html
<section id="chapter" style="height: 300vh">
  <div style="position: sticky; top: 0; height: 100vh">…</div>
</section>
```

`scene.local(a, b)` returns sub-progress within `[a, b]` — one scene can drive many beats. `range(p, a, b)` does the same for any progress.

## Horizontal sections

Vertical scrolling moves a row of panels sideways while the section is pinned — in both reading directions:

```html
<section class="gallery">                  <!-- height is set for you -->
  <div class="gallery-pin">                <!-- position: sticky; top: 0; height: 100vh; overflow: hidden -->
    <div class="gallery-track">…panels…</div>   <!-- display: flex; width: max-content -->
  </div>
</section>
```

```ts
const h = stage.use(horizontal('.gallery', {
  snap: true,                      // settle on the nearest panel when scrolling stops
  speed: 1,                        // vertical px per horizontal px
  onPanel: (i) => (counter.textContent = String(i + 1)),
}))
h.progress; h.travel; h.distance; h.active; h.panelProgress(2)
h.scrollToPanel(3)
```

- In a right-to-left section the row travels rightward, so panels still arrive in reading order.
- Each panel gets `--panel-progress` (`0` entering at the line end → `1` leaving at the line start) for CSS effects.
- Keyboard focus inside an offscreen panel scrolls the page to that panel.
- The track defaults to the pin's widest child; in a grid pin, give the column `minmax(0, 1fr)` so the track overflows instead of widening the grid.

## Dragging

```ts
const d = stage.use(draggable('.track', {
  axis: 'x',
  bounds: 'parent',               // or { minX, maxX, minY, maxY }, or a function
  snap: [0, -320, -640],          // or a step size, or (value, axis) => number
  keyboard: 'content',            // arrow keys step between snap points, carousel-style
  onRest: (d) => {},
}))
d.x; d.velocityX; d.dragging; d.moving
d.setPosition(-320, 0)
d.step(1)
```

Releases keep their velocity: inertia (`timeConstant`), rubber-band resistance past the bounds (`resistance`), and snapping on a spring seeded with the throw. A click after a drag is swallowed; `touch-action` is set so the page still scrolls on the other axis. Under reduced motion a release lands directly. With `apply: false` nothing is written — drive anything from `onUpdate`.

## Pointer effects: magnetic, tilt, cursor

```ts
stage.use(magnetic('.cta', { strength: 0.35, radius: 48, inner: '.cta-label' }))
stage.use(tilt('.card', { max: 8, scale: 1.02, glare: true }))
stage.use(cursor({ targets: 'a, button, [data-cursor]' }))
```

- `magnetic` leans an element (and optionally an inner element, further) toward a nearby pointer on springs.
- `tilt` rotates in 3D toward the pointer; with `glare`, `--tilt-x`, `--tilt-y` and `--tilt-active` drive a CSS highlight. Cards at rest carry no transform.
- `cursor` creates `.veyra-cursor` (style it in CSS). Over a target it gets `is-active`; a `data-cursor="View"` (or «ببین») becomes its label and `data-cursor-state`. The native cursor stays unless `hideNative: true`.
- All three are off for touch input and reduced motion.

## Marquee

```ts
stage.use(marquee('.ticker', { speed: 70, scrollFactor: 0.3, followScroll: true, hoverSpeed: 0 }))
```

Content travels toward the start of the line — leftward in English, rightward in Persian (`direction: -1` reverses). Copies fill the band seamlessly and are `inert` and hidden from assistive tech. It idles offscreen and stays still under reduced motion.

## Text splitting

```ts
import { splitText } from '@veyra/core'

const s = splitText('h1', { type: ['lines', 'chars'], mask: 'lines' })
s.lines; s.words; s.chars; s.lineWords
s.refresh()   // after resize / font load
s.revert()
```

- Persian/Arabic letters stay joined when split into chars; lam-alef stays whole; ZWNJ is respected.
- English inside Persian (and vice versa) stays in order; punctuation lands on the correct side.
- Pieces carry `--char-index`, `--word-index`, `--line-index` for CSS-only staggering.
- Screen readers get the original text once.
- Nastaliq (and other vertically cascading styles): split by words, not chars.

Helpers: `shapeClusters(word)`, `joiningType(cp)`, `strongDirection(text)`, `directionOf(el)`, `inlineSign(el)` (`-1` in RTL), `toPersianDigits(n)`, and `drawElementText(el)` — renders an element's text into a canvas with the browser's own line breaks (for Canvas2D or WebGL effects over real, accessible HTML).

## Persian typography: kashida and scramble

**Kashida** stretches the connection between joined letters (tatweel, U+0640) — «کشیده» → «کشـــیده»:

```ts
import { kashida, elongate, kashidaPoints } from '@veyra/core'

const k = kashida('h1')                       // stretchable element
k.level = 6                                   // tatweels per word
stage.timeline().to(k, { level: 8 }, { duration: 1.2, ease: 'drift' }).play()
stage.scene('#intro', { onProgress: (p) => (k.level = p * 10) })

elongate('کشیده بنویس', 2, { mode: 'spread' })   // plain strings, e.g. for canvas text
```

Connections come from Unicode joining types: never inside lam-alef, never across ZWNJ, never after a letter that doesn't join forward. They are ranked the way calligraphers usually stretch: after س ش ص ض, then the word's last connection, then later ones. `mode: 'single'` (default) puts the whole stretch on the best connection. While stretched, the original text is exposed through `aria-label`. Use Naskh-style or display faces (Vazirmatn, Estedad, Lalezar); Nastaliq doesn't stretch with tatweel.

**Scramble** decodes text through random glyphs, settling from the start of the line (the right edge in Persian). Glyphs come from each letter's own script — Persian letters for Persian, Latin case-matched for English — and the text stays one shaped run, so Persian keeps joining while it flickers:

```ts
import { scrambleText } from '@veyra/core'

scrambleText('#title', { duration: 1.4 })                            // plays
const tl = scrambleText('#title', { paused: true, seed: 3 })         // or scrub it
stage.scene('#title', { timeline: tl })
```

## Noise and GLSL

```ts
import { createNoise, noise2, fbm3 } from '@veyra/core'

const { noise2: wobble } = createNoise(7)       // seeded generator
el.style.translate = `${wobble(time * 0.4, 0) * 12}px 0`
const angle = fbm3(x, y, time * 0.1, { octaves: 4 }) * Math.PI * 2
```

Improved Perlin gradient noise: deterministic per seed, smooth, `0` on integer lattice points, within `[-1, 1]`.

Shader building blocks live in `@veyra/core/glsl` (GLSL ES 3.00 for WebGL2 / three.js). Each export is a string with an include guard, so they combine freely:

```ts
import { glslNoise, glslSdf, glslColor, glslMath, glslHash } from '@veyra/core/glsl'

const fragmentShader = `
${glslNoise}
${glslSdf}
${glslColor}
void main() {
  float d = sdCircle(p, 0.3 + 0.03 * gnoise(vec3(p * 4.0, uTime)));
  vec3 color = mixOklab(a, b, fillAA(d, fwidth(d)));
  …
}`
```

- `glslHash` — PCG hashes: `pcg`, `pcg2d`, `pcg3d`, `hash11/12/22/13/33`.
- `glslNoise` — `gnoise(vec2|vec3)`, `fbm(vec2|vec3, octaves)`.
- `glslSdf` — `sdCircle`, `sdBox`, `sdRoundBox`, `sdSegment`, `sdRing`, `opUnion`, `opSubtract`, `opIntersect`, `opSmoothUnion`, `opSmoothSubtract`, `fillAA(d, aa)`.
- `glslColor` — `srgbToLinear`, `linearToSrgb`, `linearToOklab`, `oklabToLinear`, `mixOklab`, `cosinePalette`.
- `glslMath` — `remap`, `remapClamped`, `smootherstep`, `rotate2d`.
- `glslNoiseTexture` — `tfbm` and `tfbmd`: fractal noise read from a noise texture (below).

### Noise from a texture

Per-pixel noise costs dozens of hashes per octave; on a full-screen surface (terrain, water, sky) that is the difference between 15 and 60 frames per second. Bake the noise into a texture once and read it instead:

```ts
import { noiseTexture } from '@veyra/core/three'
import { glslNoiseTexture } from '@veyra/core/glsl'

const noise = noiseTexture({ size: 256, cells: 8, seed: 1 })   // tiling noise + its gradient, half floats, mipmaps
noise.anisotropy = renderer.capabilities.getMaxAnisotropy()      // crisp at grazing angles
const material = new THREE.ShaderMaterial({
  uniforms: { uNoise: { value: noise } },
  fragmentShader: `
  ${glslNoiseTexture}
  uniform sampler2D uNoise;
  void main() {
    float rock = tfbm(uNoise, 8.0, vWorld * 0.02, normal, 4);    // triplanar: no streaks on steep faces
    vec3 g = tfbmd(uNoise, 8.0, vWorld * 0.01, normal, 3).yzw;    // world-space gradient, for bump
    vec3 n = normalize(normal - (g - normal * dot(g, normal)) * 0.6);
    …
  }`,
})
```

- `tfbm(tex, cells, vec2 p, octaves)` reads like `fbm(p, octaves)`: `p` is in noise cells and `cells` is the texture's (`noise.userData.cells`). Each octave reads at twice the frequency, turned, so neither the octaves nor the tiles line up — one texture read per octave.
- `tfbmd(tex, cells, vec2 p, octaves)` returns `vec3(value, d/dx, d/dy)`. The texture stores the noise's analytic gradient, so this costs no extra reads, and a bump from it stays smooth even where one texel covers several pixels (finite differences of filtered noise show the texel grid).
- The `vec3 p, vec3 n` forms are triplanar — three projections blended by the surface normal — and `tfbmd` then returns `vec4(value, world-space gradient)`.
- Channels: R noise in `[-1, 1]`, G and B its derivatives per tile, A a second independent noise.
- Fragment shaders only (mip selection uses screen derivatives). Mipmaps filter distant detail instead of letting it shimmer; a little anisotropic filtering sharpens grazing views but each level costs reads.
- `tilingNoise(options)` returns the same data as plain arrays, for canvases, workers and tests.

## Terrain

Mountains on a regular grid, lit once. Pure functions with no DOM, so the heavy part can run in a worker.

```ts
import { heightfield, erodedNoise, ridgedNoise, bakeSunlight, bakeOcclusion, heightfieldMesh } from '@veyra/core'

const field = heightfield({
  size: [8000, 8000],                                    // world units, centered on the origin
  resolution: 256,
  height: (x, z) => erodedNoise(x / 2600, z / 2600) * 1800 + ridgedNoise(x / 1200, z / 1200) * 300,
})
const sun = bakeSunlight(field, [0.8, 0.4, -0.4])        // 0…1 per sample: shadows from the terrain itself
const ao = bakeOcclusion(field, { radius: 1200 })         // 0…1 per sample: how open the sky is
field.sample(x, z)                                       // bilinear height; field.normal(x, z), field.bilinear(data, x, z)
```

- `erodedNoise` layers value noise with its derivatives, so steep places get less fine detail — ridges, spurs and gullies that read as erosion. `ridgedNoise` gives sharp crests. `valueNoiseD` is the underlying noise with analytic derivatives.
- `heightfieldMesh(field, { segments, layout, attributes })` returns typed arrays (transferable from a worker); `layout(u, v)` places the grid unevenly — dense near the camera, sparse toward the horizon. In three.js, `heightfieldGeometry(field, …)` builds the geometry directly and `meshGeometry(arrays)` wraps arrays made elsewhere. Baked arrays become float attributes for your shader.
- Worker pattern: bake in the worker, post `{ heights, mesh }`, then on the main thread `heightfield({ size, resolution, heights })` restores a sampler (for a camera that walks the ground) and `meshGeometry(mesh)` the geometry.

## Image sequences

```ts
const seq = stage.use(imageSequence('#turn', {
  count: 120,
  src: (i) => `/frames/turn-${String(i + 1).padStart(3, '0')}.webp`,
  scene: { trigger: '#product', start: 'top top', end: 'bottom bottom' },
  fit: 'cover',
}))
seq.progress = 0.5        // when no scene drives it
await seq.ready           // every frame settled
```

Frames load coarse-to-fine (the ends, every 8th or 16th, then the gaps), so scrubbing works almost at once; until a frame arrives, the nearest loaded one stands in. The canvas resolution follows the quality governor. The canvas is an image: give it `role="img"` and an `aria-label`.

## Visibility, media queries and layout refresh

```ts
import { whenVisible } from '@veyra/core'

whenVisible('#demo', () => initHeavyDemo(), { rootMargin: '200px' })        // once
whenVisible(canvas, () => { start(); return () => stop() }, { once: false }) // on every entry/exit

const narrow = stage.media('(max-width: 700px)')   // signal, released with the stage
narrow.subscribe((on) => menu.classList.toggle('compact', on), { immediate: true })

stage.onRefresh(() => measureMyLayout())           // after resizes, font loading, height changes
```

## Preloading

```ts
import { Preloader } from '@veyra/core'

const loader = new Preloader()
const img = loader.image('/images/hero.webp', 2)          // weight 2
loader.font('400 1em "Lalezar"', 'آبعلی')
loader.add(buildScene())                                   // any promise
loader.progress.subscribe((p) => (bar.style.transform = `scaleX(${p})`))
await loader.done({ minDuration: 1.2 })
```

Failed tasks are logged, counted as complete and collected in `loader.errors`.

## Adaptive quality

```ts
stage.quality!.level   // signal 0…1
stage.quality!.tier    // 'low' | 'medium' | 'high'
stage.quality!.dpr     // recommended pixel ratio
stage.quality!.tier.subscribe((t) => (bloom.enabled = t === 'high'), { immediate: true })
```

The governor watches real frame times in windows of 30 frames: two slow windows step the level down, one far too slow window (under 60% of the target) steps it down at once — further the slower it is — and six fast ones step it back up. A single long frame (a tab switch, a GC pause) is ignored; three long frames in a row (over 250 ms each — a software renderer, a far too heavy scene) drop the level to its minimum at once. The refresh rate is measured over the first second but never taken below `minRefreshRate` (60 Hz): a device that only manages 30 fps is struggling, not showing a 30 Hz screen.

The starting level (`initial: 'auto'`) comes from hardware hints: desktops start high (lower with four cores or few gigabytes of memory), phones and tablets (a coarse pointer) start in the middle and climb if they can. Tie expensive features to `tier` — and follow it at runtime, not only when building — so the low tier stays light.

## Sound

```ts
const stage = createStage({ sound: true })
toggle.onclick = () => stage.sound!.toggle()
stage.sound!.enabled.subscribe((on) => toggle.setAttribute('aria-pressed', String(on)), { immediate: true })

const ctx = stage.sound!.context!          // for synthesized sound design
const noise = stage.sound!.noise(1, 'pink')
stage.sound!.play(buffer, { volume: 0.6, rate: 1.2 })

// One-shots, synthesized: a click, a hiss, a ping (silent no-ops while sound is off).
stage.sound!.burst({ from: 3600, to: 2600, q: 7, gain: 0.3, decay: 0.035 })              // a metallic click
stage.sound!.burst({ filter: 'highpass', from: 6000, to: 2400, gain: 0.25, decay: 0.9 })  // gas escaping
stage.sound!.tone({ frequency: 3100, type: 'triangle', gain: 0.04, decay: 0.2, pan: 0.3 }) // a ring
```

Sound never plays unless the visitor turned it on; the choice is remembered.

## Reduced motion

`stage.reducedMotion` follows `prefers-reduced-motion` and is writable for an in-page toggle. It sets `data-reduced-motion` on `<html>`, disables scroll smoothing, and makes `stage.animate` jump to end states. Design reduced variants per scene:

```ts
stage.reducedMotion.subscribe((reduced) => { parallax.enabled = !reduced }, { immediate: true })
```

## three.js layer

```ts
import * as THREE from 'three'
import { threeLayer, supportsWebGL2 } from '@veyra/core/three'

const gl = stage.use(threeLayer({ zIndex: -1, fov: 30 }))
gl.scene.add(mesh)
gl.anchor('#product-slot', mesh, { size: false, live: true })   // follow a DOM box
const title = gl.mirrorText(document.querySelector('h1')!)      // real HTML → texture
```

- At `z = 0`, 1 world unit = 1 CSS pixel; origin at the viewport center.
- Pixel ratio follows the quality governor (capped by `maxDpr`).
- Over a transparent canvas, `seeThroughGlass: true` lets glass, ice and water show the page through themselves (three.js otherwise fills what they refract of the empty background with half-transparent white, which turns clear glass milky over a dark page); opaque objects behind still refract. Also settable as `gl.seeThroughGlass`.
- On a software renderer (no GPU: SwiftShader, llvmpipe…) the layer sets the stage's quality to its lowest level from the start (`gl.software` says so; `softwareQuality` picks another level, `false` opts out). `isSoftwareRenderer(gl)` is exported for your own checks.
- Set `autoRender: false` and render yourself in `onFrame` for custom passes.
- `drawElementText(el)` (exported from `@veyra/core` too) draws any element's text into a 2D canvas with its real font and line breaks — usable as a WebGL texture or in Canvas2D.

## Product rendering: turned shapes, labels, studio light

Everything a product shot needs, without model files or HDR images (`@veyra/core/three`).

```ts
import { Profile, studioEnvironment, condensationMaps, ReflectiveFloor, ContactShadow } from '@veyra/core/three'

// A bottle measured off a photograph: [radius, height] from the bottom up.
const outer = new Profile([[0, 0.01], [0.1, 0], [0.15, 0.1], [0.15, 0.5], [0.07, 0.78], [0.06, 0.97]], { corners: [1] })
const glass = new THREE.Mesh(outer.geometry(128), glassMaterial)
const liquid = outer.offset(0.01).clip(0.03, 0.82)          // the inside, filled to 82%
outer.volume()                                              // capacity check
const label = outer.band({ from: 0.52, to: 0.66, arc: Math.PI * 0.8, lift: 0.002 })
// Draw artwork at label.width × label.height; label.halfWidthAt(v) gives the cut edge (it narrows on a cone).

scene.environment = studioEnvironment(renderer)             // softboxes and strips baked into a PMREM map
const drops = condensationMaps({ size: 1024 })              // cold glass: normal + roughness maps

const floor = new ReflectiveFloor({ width: 8000, depth: 8000, strength: 0.4, layer: 3 })  // glossy acrylic
const shadow = new ContactShadow({ width: 400, depth: 400, far: 200 })
shadow.cast(bottle)
stage.onFrame(() => {
  floor.update(renderer, scene, camera)                     // before rendering
  shadow.update(renderer, scene)
  renderer.render(scene, camera)
}, Phase.render + 1)
```

- `Profile` smooths measured points (centripetal Catmull-Rom, sharp `corners` kept), samples them (`radiusAt`, `slopeAt`, `lengthAt`), offsets with miter joins (glass walls, liquids), clips to closed solids and measures volume.
- `band()` texture coordinates follow arc length around the axis and outline length along it, so artwork keeps its proportions on a cone while the band's edges follow the axis — the cut of a real label on a tapered neck.
- `studioEnvironment(renderer, { lights, walls })`: presets `studioLights.product` (rim strips, front strips, overhead key) and `studioLights.soft` (food, ceramics), or your own panels.
- `ReflectiveFloor` fades and blurs the reflection with the height of what it reflects, reconstructed from depth, so it looks right at grazing camera angles. `setFade(start, end)` and `strength` can change per frame.
- `ContactShadow` renders casters from below as depth and blurs it. Move it with `object.position`, size it with `resize(width, depth, far)`; don't scale `object`.
- Transmissive glass refracts only opaque objects: keep liquids and labels opaque. In three.js, `thickness` is in local units (it is scaled by the model matrix); `attenuationDistance` is in world units.

## Clear solids: ray-traced ice and glass

`refractiveSolid(material, options)` turns a `MeshPhysicalMaterial` into a clear solid traced from the inside. The mesh gives the entry point and normal; a signed distance function in GLSL describes the solid for the rays inside. Each view ray refracts in, runs to the far side, refracts out — or, past the critical angle, reflects back in and tries again — and samples what lies beyond. That is what draws the bright and dark edges of real ice and glass. There is no transmission pass, so nothing depends on what the canvas shows behind the mesh: clear glass works over a transparent canvas on a dark page.

```ts
import { refractiveSolid } from '@veyra/core/three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const material = new THREE.MeshPhysicalMaterial({ color: 0x000000, specularIntensity: 0, transparent: true })
const block = refractiveSolid(material, {
  // Object space, negative inside. A rounded box: half extents 0.06, edge radius 0.015.
  sdf: `float solidSdf(vec3 p) {
    vec3 d = abs(p) - vec3(0.045);
    return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0) - 0.015;
  }`,
  bounds: new THREE.Vector3(0.06, 0.06, 0.06),     // holds the solid
  inner: new THREE.Vector3(0.053, 0.053, 0.053),   // lies inside it (optional, faster)
  ior: 1.5,
  absorption: [9, 3, 6],                           // per object unit: a green tint
  // What a ray sees once it leaves, in world space: the studio and a light behind the set.
  outside: `vec3 solidOutside(vec3 position, vec3 direction) {
    return solidEnvironment(direction, 0.0) + vec3(0.9) * pow(max(-direction.z, 0.0), 4.0);
  }`,
})
scene.add(new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.12, 0.12, 4, 0.015), material))
block.uniforms.solidIor.value = 1.33                // uniforms can change per frame
```

- Keep the material's `color` black and `specularIntensity` 0: the traced light replaces its shading, and the surface reflects `solidOutside` too (Fresnel-weighted; `reflection: false` to leave it out). `transparent: true` keeps the solid out of three.js's transmission pre-pass (which other glass in the scene triggers), so it isn't traced twice; it still writes depth.
- Hooks, each a GLSL function you define: `outside` → `vec3 solidOutside(vec3 position, vec3 direction)` (world space; `solidEnvironment(direction, roughness)` reads the environment map, `vSolidOrigin` and `vSolidBasis` give the object's place and axes) · `inside` → `void solidInside(vec3 p, vec3 d, float len, int bounce, inout vec3 light, inout vec3 through)`, called for each straight run inside (object space; `bounce` 0 is the run from the eye): add mist, bubbles or cracks · `bump` → `vec3 solidBump(vec3 p, vec3 n)` for relief too fine for the mesh · `normal` → `vec3 solidNormal(vec3 p)`, an analytic normal instead of four more SDF evaluations. Declare the uniforms they use and pass them in `uniforms`.
- Cost: every pixel of the solid runs `bounces` exits (default 3), each a bisection of `steps` SDF evaluations (10, or 6 with `inner`) plus the hooks. Keep hooks cheap — a few sines rather than noise — and lower `bounces` on weak devices. The solid should be convex, or nearly: each exit is searched between a point inside and the far side of `bounds`.
- Units: object space for the SDF, `bounds`, `inner`, `absorption` and `inside`; world space for `outside`.

## Debugging

Add `?debug` to the URL (or `createStage({ debug: true })`) for a frame-time graph, FPS, quality, scroll state and a scroll map of all scenes.

## Recipes

**Direction-aware horizontal motion**

```ts
// Enter from "behind" in reading order: from the left in English, from the right in Persian.
const from = -40 * inlineSign(el)
stage.timeline().fromTo(el, { x: from, opacity: 0 }, { x: 0, opacity: 1 }, { duration: 0.9 }).play()
```

**Scroll velocity as an effect input**

```ts
stage.onFrame(({ delta }) => {
  skew = damp(skew, stage.scroll!.velocity / 4000, 6, delta)
})
```
