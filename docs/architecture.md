# Architecture & decisions

## What Veyra is

Veyra is a **creative web experience engine**: the reusable runtime under art-directed websites. A project brings its concept, its visuals and its custom interactions; Veyra brings the infrastructure every such project re-implements — and usually re-implements with the same bugs: multiple competing animation loops, layout thrashing on scroll, broken smooth scrolling, Persian letters falling apart under text animation, WebGL that melts low-end phones.

It is intentionally **not** a page builder, a component library, a template system or a framework that owns your markup. Veyra never renders your DOM. It runs alongside whatever produces the page (hand-written HTML, Astro, Vite, a framework) and orchestrates motion and rendering on top.

## Principles

1. **One loop.** Everything that moves runs inside a single `requestAnimationFrame`, ordered by phase. One `time`, one place to pause, no rAF duplication.
2. **Native first.** Scrolling stays native (smoothed, not hijacked). Pinning is `position: sticky`. Text stays real HTML. Accessibility, find-in-page, keyboard and restoration keep working by construction.
3. **Read once, write often.** Layout is measured on change, not per frame. Per-frame work is arithmetic and writes.
4. **Every script, every direction.** RTL and Arabic-script typography are first-class, not an afterthought. Direction-aware behavior — horizontal sections, marquees, carousels, `inlineSign` — makes "forward" follow the reading direction, and Persian gets its own typographic tools (joined splitting, kashida).
5. **Quality adapts.** Devices differ by an order of magnitude. The engine measures and adapts rather than guessing.
6. **Motion is optional.** Reduced motion is a stage-level signal; smoothing turns off, `stage.animate` jumps to end states, projects choose their own reduced variants.
7. **Small and owned.** Zero runtime dependencies in the core. Renderers are integrations.

## Frame pipeline

```
requestAnimationFrame
  │
  ├─ input    (-300)  pointer: position, smoothing, velocity
  ├─ scroll   (-200)  scroll controller integrates smoothing, writes scrollTo
  ├─ measure  (-100)  batched layout reads: pending refreshes, live rects
  ├─ update   (0)     scenes (-10) → timelines, springs, project logic
  ├─ render   (100)   DOM writes, three.js layer renders
  └─ post     (200)   quality governor sampling, debug overlay
```

Projects register with `stage.onFrame(fn, Phase.update)` (or any number between phases).

## Module map

```
src/
  core/         math, ease, signal, ticker, noise         — no DOM required
  motion/       spring, decay, values, style, timeline,   — DOM optional
                stagger, flip
  env/          viewport, pointer, capabilities, visibility
  scroll/       scroll controller, horizontal sections (plugin)
  layout/       rect cache
  scene/        scroll scenes
  text/         script (joining types, bidi helpers), split, draw (DOM text → canvas),
                kashida, scramble
  interaction/  drag, magnetic, tilt, cursor (plugins)
  effects/      marquee (plugin)
  media/        image sequences (plugin)
  assets/       preloader
  quality/      adaptive governor
  sound/        sound bus
  debug/        overlay
  stage.ts      composition root
  three/        optional three.js integration (separate entry point)
  glsl/         shader building blocks as strings (separate entry point)
```

Dependencies flow downward: `core` depends on nothing; `stage.ts` wires everything; plugins (`interaction/`, `effects/`, `media/`, `scroll/horizontal`) depend on the stage's types only; `three/` depends on `stage` and `three`; `glsl/` depends on nothing.

## Decision log

### ADR-001 — Own the motion layer, don't build on GSAP

GSAP is excellent, but its license (the "no charge" Standard License after the Webflow acquisition) forbids use in products that compete with Webflow's visual builder — a risk for an engine whose purpose is building websites. Motion One / Framer Motion are tied to WAAPI or React. The motion needs of creative sites are well understood (tweens, timelines, springs, scrubbing), so Veyra owns a compact implementation designed around **seekability** (scroll scrubbing) from the start.

### ADR-002 — Smooth native scroll instead of virtual scroll

Virtual scrolling (translating a wrapper) breaks `position: sticky`, find-in-page, anchor links, scroll restoration and assistive tech, and requires pin-spacer hacks. Veyra smooths wheel input by animating the *real* scroll position (the approach popularized by Lenis) and stays fully native for touch, keyboard and reduced-motion users. Owning it (≈250 lines) keeps it on the single loop with no dependency.

### ADR-003 — Pinning is CSS `position: sticky`

A tall wrapper plus a sticky child is jank-free, compositor-friendly and survives resizes without JavaScript spacers. Scenes provide the progress (`scenePresets.pinned`: `top top` → `bottom bottom`).

### ADR-004 — Script-aware text splitting is a core feature

Splitting text into per-letter boxes breaks Arabic-script joining because each inline-block shapes in isolation. Veyra computes Unicode joining types (`ArabicShaping.txt` classes D/R/C/T/U) and inserts zero-width joiners on connecting sides, keeps lam-alef ligatures whole, respects ZWNJ (nim-fasele), and isolates opposite-direction runs (inline-blocks are bidi-neutral, so "Veyra Core" inside Persian would otherwise render as "Core Veyra"). Digits following an LTR run join it (bidi rule W7). This is the kind of capability a Persian-first studio's engine should own.

### ADR-005 — three.js as an optional peer integration

3D, physical materials, glTF and post-processing are three.js's strength; reimplementing them would be waste. The core stays renderer-agnostic and dependency-free; `@veyra/core/three` integrates three.js with the stage loop, quality governor and DOM layout. Other renderers (OGL, raw WebGL2, WebGPU) can integrate the same way through `stage.use(plugin)`.

### ADR-006 — Adaptive quality instead of device sniffing

The governor detects the refresh rate during warm-up, then evaluates frame-time windows: two bad windows step quality down; six good windows step it up (slowly, to avoid oscillation); a cooldown follows each change. Renderers bind pixel ratio and effect levels to its signals.

### ADR-007 — Explicit signals, no dependency tracking

Reactive state (`viewport.width`, `quality.dpr`, `reducedMotion`) uses tiny explicit signals: subscribe to what you need, computed values list their inputs. No proxies, no hidden graphs, nothing to debug.

### ADR-008 — Distribution as a packed tarball until npm publication *(superseded by ADR-010)*

Showcases depended on `vendor/veyra-core/` — the unpacked contents of the release tarball, i.e. exactly what `npm publish` would upload — instead of a git dependency or a registry. Deploys never depended on another repository's state and needed no credentials. In practice every engine change needed a manual vendoring step in every project, and a vendoring mistake (a gitignored `dist/`) broke both first deploys.

### ADR-009 — Pixel camera for DOM ↔ WebGL

The three.js layer positions a perspective camera so that at `z = 0` one world unit equals one CSS pixel and the origin is the viewport center. DOM rects map to world positions with no conversion code, while depth and perspective remain available.

### ADR-010 — Projects follow the engine on GitHub through a CI-built `release` branch

Owner decision (2026-10-10): sites should pick up engine changes without copying files. Projects depend on `"@veyra/core": "github:veyra-studio/veyra-core#release"`. The `release` branch is written only by CI, after typecheck, tests and the examples build pass on `main`: it holds exactly the packed package (what `npm publish` would upload) with `devDependencies` and `scripts` removed, so installs are fast, need no build step and pull no test toolchain. Its history is kept, so commits pinned in project lockfiles stay fetchable; each new version also gets a `v<version>` tag for pinning.

Projects install the latest `release` commit at build time and record what they deployed in `engine.json`. They rebuild when the engine changes — immediately through a `repository_dispatch` if the engine repository holds a token for it, otherwise through an hourly check. Trade-off: a project build is no longer reproducible from its own commit alone; mitigations are that only green engine builds are published, the deployed engine commit is recorded, a failed build leaves the previous deployment live, and a project can pin a tag or commit at any time. See [integration.md](integration.md).

### ADR-011 — Stage-dependent capabilities are plugins

Horizontal sections, dragging, magnetic, tilt, cursor, marquee and image sequences are `stage.use(plugin(...))` calls, not stage methods. Bundles carry only what a page uses (the package is `sideEffects: false`), every plugin gets the stage's ticker, layout cache, scroll, pointer, reduced-motion signal and `onRefresh` hook, and `stage.destroy()` tears them down. Pure capabilities (`flip`, `stagger`, `kashida`, `scrambleText`, noise) stay plain functions usable without a stage.

## Testing strategy

- **Unit tests** (Vitest + jsdom) for logic: math, easing, springs and decay (analytic exactness, stability), noise, stagger, ticker ordering and fault tolerance, timeline sequencing/scrubbing/positions, scene anchors and transitions, joining types, bidi grouping and kashida points, scramble, FLIP inversion, drag physics, horizontal sections, marquee, pointer effects (with mocked geometry), preloader, quality governor.
- **Examples** are integration tests in a real browser: `npm run verify:examples` drives every example in headless Chromium (dragging in both directions, keyboard stepping, FLIP, pointer effects, marquees, horizontal sections with snapping and focus, kashida, scramble, the GLSL chunks compiling under WebGL2, image sequences, reduced motion) and fails on any console error.
- Projects (Abali, the studio site) carry their own end-to-end verification scripts.
