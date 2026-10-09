# Guide

Everything is exported from `@veyra/core`; three.js helpers from `@veyra/core/three`.

- [Stage](#stage)
- [Ticker](#ticker)
- [Motion: timelines and tweens](#motion-timelines-and-tweens)
- [Springs and damping](#springs-and-damping)
- [Scroll](#scroll)
- [Scenes](#scenes)
- [Text splitting](#text-splitting)
- [Preloading](#preloading)
- [Adaptive quality](#adaptive-quality)
- [Sound](#sound)
- [Reduced motion](#reduced-motion)
- [three.js layer](#threejs-layer)
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

Layout refreshes happen automatically on width changes, font loading, `load`, and document height changes.

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

Targets: elements (transform shorthands `x y z rotate rotateX rotateY scale scaleX scaleY skewX skewY`, `opacity`, CSS custom properties `--name`, any style property), selectors, arrays/NodeLists, and plain objects (including uniforms and signals via `value`).

Values: numbers, colors (`#hex`, `rgb()`; mixed in linear light), and strings containing numbers (`'inset(0% 0% 100% 0%)'`, `'blur(8px)'`, `'12vw'`).

Positions: `2` (absolute), `'<'`/`'>'` (start/end of previous), `'<0.2'`, `'+=0.5'`, `'label+=0.3'`.

Start values are captured the first time the playhead reaches a tween, so sequences chain naturally. `fromTo` applies its start state immediately.

One-shot: `animate(target, vars, options)` or `stage.animate(...)` (which honors reduced motion).

Eases: `linear`, `sine*`, `quad*`, `cubic*`, `quart*`, `quint*`, `expo*`, `circ*`, `back*`, `elasticOut`, `bounceOut`, and Veyra's `glide` (soft landing), `drift` (weighty in-out), `snap` (decisive), `tension` (anticipation). Or `cubicBezier(x1, y1, x2, y2)`.

## Springs and damping

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

## Scroll

```ts
stage.scroll!.scrollTo('#chapter-3', { duration: 1.4, ease: 'drift', offset: -40 })
stage.scroll!.lock()      // e.g. during an intro
stage.scroll!.unlock()
stage.scroll!.y; stage.scroll!.velocity; stage.scroll!.progress
```

- Wheel input is smoothed; keyboard, scrollbar, touch and find-in-page stay native and are followed.
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

Helpers: `shapeClusters(word)`, `joiningType(cp)`, `strongDirection(text)`, `directionOf(el)`, `inlineSign(el)` (`-1` in RTL), `toPersianDigits(n)`.

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

## Sound

```ts
const stage = createStage({ sound: true })
toggle.onclick = () => stage.sound!.toggle()
stage.sound!.enabled.subscribe((on) => toggle.setAttribute('aria-pressed', String(on)), { immediate: true })

const ctx = stage.sound!.context!          // for synthesized sound design
const noise = stage.sound!.noise(1, 'pink')
stage.sound!.play(buffer, { volume: 0.6, rate: 1.2 })
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
- Set `autoRender: false` and render yourself in `onFrame` for custom passes.
- `drawElementText(el)` draws any element's text into a canvas with its real line breaks.

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
