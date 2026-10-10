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
npm run release:pack  # check + pack release/veyra-core-<version>.tgz (vendored by projects)
```

## Layout

- `src/core` math, ease, signal, ticker (no DOM) · `src/motion` timeline/spring/values/style · `src/env` viewport/pointer · `src/scroll` · `src/layout` rect cache · `src/scene` · `src/text` joining types + splitText · `src/assets` · `src/quality` · `src/sound` · `src/debug` · `src/stage.ts` composition root · `src/three` optional three.js entry (`@veyra/core/three`).
- `examples/` three live examples; `test/` unit tests; `docs/` guide, architecture (ADRs), integration, plan.

## Conventions

- Zero runtime dependencies in the core; `three` is an optional peer used only by `src/three`.
- Imports inside `src` use `.js` extensions (ESM output works in Node and bundlers).
- Everything that moves runs on the ticker; no extra `requestAnimationFrame` loops.
- No per-frame layout reads outside `Phase.measure`; use `RectCache`.
- Keep RTL/Persian correctness: run the split tests when touching `src/text`.
- When the public API changes: update `docs/guide.md`, `CHANGELOG.md`, bump version in both `package.json` and `src/index.ts` (`release:pack` verifies they match).
- Showcase-specific code never goes here (see `docs/integration.md`).

## Verifying in a browser

Chromium is preinstalled for Playwright (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, Playwright 1.56). Run `npm run examples` and screenshot pages with a small Playwright script; launch with `--use-angle=swiftshader` for WebGL in headless mode.
