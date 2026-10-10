# Veyra Core — working notes for Claude Code

The engine repository of the Veyra project. Read `docs/PLAN.md` first: it is the master plan and progress tracker for all three repositories (`veyra-core`, `veyra-studio.github.io`, `abali`).

## Commands

```bash
npm install
npm test              # Vitest + jsdom unit tests
npm run typecheck     # tsc (TypeScript 7) over src, test, examples
npm run build         # ESM + .d.ts into dist/
npm run examples      # Vite dev server for examples/ (imports engine from source)
npm run examples:build
npm run verify:examples   # after examples:build — drives every example in headless Chromium
npm run release:pack  # check + pack release/veyra-core-<version>.tgz
```

Projects install the engine from the `release` branch, which CI publishes from every green `main` build (`scripts/release-branch.mjs`). Merging to `main` ships to the sites; keep changes additive within a version.

## Layout

- `src/core` math, ease, signal, ticker, noise, terrain (no DOM) · `src/motion` timeline/spring/decay/values/style/stagger/flip · `src/env` viewport/pointer/visibility · `src/scroll` controller + horizontal sections · `src/layout` rect cache · `src/scene` · `src/text` joining types, splitText, kashida, scramble · `src/interaction` drag/magnetic/tilt/cursor · `src/effects` marquee · `src/media` image sequences · `src/assets` · `src/quality` · `src/sound` · `src/debug` · `src/stage.ts` composition root · `src/three` (`@veyra/core/three`: layer, profile, studio, condensation, floor, shadow, terrain) · `src/glsl` (`@veyra/core/glsl`).
- `examples/` seven live examples; `test/` unit tests; `scripts/verify-examples.mjs` browser checks; `docs/` guide, architecture (ADRs), integration, plan.

## Conventions

- Zero runtime dependencies in the core; `three` is an optional peer used only by `src/three`.
- Imports inside `src` use `.js` extensions (ESM output works in Node and bundlers).
- Everything that moves runs on the ticker; no extra `requestAnimationFrame` loops.
- No per-frame layout reads outside `Phase.measure`; use `RectCache`.
- Keep RTL/Persian correctness: run the split tests when touching `src/text`.
- When the public API changes: update `docs/guide.md`, `CHANGELOG.md`, bump version in both `package.json` and `src/index.ts` (`release:pack` verifies they match).
- Showcase-specific code never goes here (see `docs/integration.md`).
- Capabilities that need the stage are plugins (`StagePlugin`, used via `stage.use(...)`): clean up through `onDestroy`, re-measure through `stage.onRefresh`, honor `stage.reducedMotion`, and keep horizontal behavior reading-direction aware.
- Unit tests can't see layout (jsdom): mock geometry in tests, and prove behavior in a real browser with an example plus a check in `scripts/verify-examples.mjs`.

## Verifying in a browser

Playwright 1.56 drives Chromium (in the cloud sandbox it is preinstalled at `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`; elsewhere run `npx playwright install chromium`). Run `npm run examples` and screenshot pages with a small Playwright script; launch with `--use-angle=swiftshader` for WebGL in headless mode (portable, what the checks use), or `--use-angle=metal` on a Mac to render on the GPU.

WebGL checks: unit tests can't render, so prove rendering features with pixel probes in an example (render, then `gl.readPixels` in the same task) and assert them in `scripts/verify-examples.mjs` — that is how the contact shadow's culling bug was caught.
