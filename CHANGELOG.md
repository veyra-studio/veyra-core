# Changelog

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
