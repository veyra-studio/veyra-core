# Veyra — plan & progress

Master tracker for the three Veyra repositories. Keep it current: it is how work continues across sessions.

| Repository | Role | Deploys to |
| --- | --- | --- |
| [veyra-core](https://github.com/veyra-studio/veyra-core) | The engine (source of truth) | `release` branch, built by CI (later npm) |
| [abali](https://github.com/veyra-studio/abali) | First showcase: Persian RTL campaign concept for Doogh Abali | https://veyra-studio.github.io/abali/ |
| [veyra-studio.github.io](https://github.com/veyra-studio/veyra-studio.github.io) | Bilingual (EN/FA) studio + engine website | https://veyra-studio.github.io/ |

## Key decisions (details in [architecture.md](architecture.md))

- **Engine**: TypeScript, zero runtime deps, one frame loop, native-first smooth scroll, CSS-sticky pinning, owned motion layer (no GSAP — license), script-aware typography (Persian joining, bidi, kashida), adaptive quality, stage-dependent capabilities as plugins, three.js as optional peer (`@veyra/core/three`), shader chunks (`@veyra/core/glsl`).
- **Integration** (ADR-010, owner decision 2026-10-10): projects depend on `github:veyra-studio/veyra-core#release`. CI publishes every green `main` build to `release` (packed package, no dev dependencies, history kept, `v<version>` tags). Projects install the newest release at build time, record it in `engine.json`, and rebuild on `repository_dispatch` (optional token) or an hourly check. Live co-development via `VEYRA_CORE_SRC=../veyra-core`.
- **Abali**: Vite + TypeScript single page, three.js for the product, base path `/abali/` in every mode.
- **Studio site**: Astro static site, English at `/`, Persian at `/fa/` (each written natively), cross-document View Transitions for the language switch.
- **Deploy**: GitHub Actions → GitHub Pages (`upload-pages-artifact@v5` + `deploy-pages@v4`) in both site repos; PRs build as a check.

## ⚠️ Owner actions

Done: GitHub access, Pages set to GitHub Actions in both site repositories, first merges (both sites deployed from `main` on 2026-10-10), engine 0.2 merged and released, both sites switched to the `release` branch and deployed.

Open:

1. **Studio 0.2 showcase**: review and merge `claude/happy-gates-7en1kj` in `veyra-studio.github.io` (the "New in 0.2" row) once its pull request is open and green.
2. *(Optional)* `SITES_DISPATCH_TOKEN` in `veyra-core` → Settings → Secrets → Actions: a fine-grained token with **Contents: read and write** on `abali` and `veyra-studio.github.io`, so the sites rebuild right after an engine release instead of within the hour.

## Status

### Phase 1 — Engine foundation ✅
- Core modules: ticker, motion (timelines/tweens/springs/easing), scroll, scenes, rect cache, viewport/pointer, script-aware `splitText`, `drawElementText`, preloader, quality governor, sound bus, debug overlay, `createStage` + plugins, capability detection.
- `@veyra/core/three`: ThreeLayer (pixel camera, configurable fov/near, quality-driven DPR), DOM anchors, DOM text mirroring.
- 65 unit tests (Vitest + jsdom). Full core bundle 19.3 KB min+gzip (tree-shaken builds ship less). Examples: scroll scenes, Persian type, three + DOM — verified in headless Chromium.
- Docs: README, guide, architecture/ADRs, integration, this plan. CI workflow. Release packing.

### Phase 2 — Showcase & studio site ✅ (first release)
- **Abali**: complete film — loader (crown cap), hero (procedural bottle in front of Nastaliq headline), label push-in with perspective-correct 3D→2D hand-off, label → Alborz landscape morph, place chapter with snow and wind, fizz chapter with shake-to-pressurize interaction, Lalezar "whites" with per-letter joined animation, sofreh flat-lay, finale pop. Synthesized optional sound. Reduced-motion and no-WebGL fallbacks. Production verification script (`npm run verify`).
- **Studio site**: bilingual design (EN/FA designed separately), woven "veil" hero, live engine demos (frame loop, spring, scroll progress, Persian splitting naive vs Veyra, adaptive quality), Abali case study, studio/engine/showcase relationship, principles, code sample, bilingual 404, language-switch view transitions, hreflang/OG/sitemap. Verification script.
- Deploy workflows in both site repos.

### Phase 3 — Engine 0.2 & GitHub distribution ✅
- **Engine 0.2**: horizontal sections (direction-aware, snapping, focus-safe), `draggable` (inertia, rubber band, snap, keyboard), `magnetic`, `tilt`, `cursor`, `marquee`, `flip`, `stagger`, `Decay`, `kashida`, `scrambleText`, noise, `@veyra/core/glsl`, `imageSequence`, `whenVisible`, `stage.media()`, `stage.onRefresh()`. 107 unit tests; `npm run verify:examples` drives six examples in headless Chromium (all checks pass). Additive — Abali builds and passes its full verification on 0.2 installed from git.
- **Distribution**: `release` branch published by CI (`scripts/release-branch.mjs`, tested against a local bare repository: first publish, no-op re-run, version bump with history kept, install into Abali). Fixes the old follow-up: installs no longer pull the engine's test toolchain (Abali: 89 → 33 packages).
- **Sites**: both depend on `github:veyra-studio/veyra-core#release` (lockfiles pin the 0.2.0 release commit), `vendor/` is gone, and the deploy workflows install the newest release, write `engine.json`, accept `repository_dispatch` and check hourly. Deployed from `main` on 2026-10-10.

### Phase 4 — Next
- **Ship**: confirm both live URLs in a browser (the sandbox cannot reach `*.github.io`).
- **Abali polish**: real-GPU performance pass (profiling on mid-range Android/iOS), optional audio sprite instead of synthesized pop, a short end-card share flow, Persian copy review by a native copywriter.
- **Engine**: WebGPU path via `three/webgpu`, a scene timeline scrubber in the debug overlay, audio sprites, page transitions beyond cross-document View Transitions, a declarative `data-` attribute layer, published npm package (claim `@veyra` scope).
- **Studio site**: the 0.2 showcase is built (in review, see the session log); next, `/docs/` generated from `veyra-core/docs`, more case studies as showcases ship.

## Session log

### 2026-10-09 — session 1
- Discovery: all three repos contained only a stub README; studio repo had legacy branch-based Pages enabled (org `*.github.io` default); abali had no Pages config. Network: npm/Google Fonts/GitHub reachable; `*.github.io`, `abali.ir`, Wikimedia blocked by the session's egress proxy.
- Research: Abali facts limited to well-corroborated ones (place in Alborz / Damavand County, mineral springs, ski area; carbonated doogh in a 260 ml glass bottle with crown cap). Brand-history claims conflict across sources and were deliberately left out of the copy. Product photos supplied by the owner were used as reference only (not committed).
- Built engine v0.1.0, Abali, studio site, workflows, docs.
- Verification run: `npm run check` (core), `npm run build` + `npm run verify` (abali, studio). See each repo's README for commands.
- Push blocked (GitHub App not installed for the org) — see owner actions.

### 2026-10-10 — session 1 (continued)
- Owner installed the Claude GitHub App; `claude/happy-gates-7en1kj` pushed to all three repositories.
- No workflow has run on GitHub yet: they trigger on `main`, pull requests, or manual dispatch, and manual dispatch only works once the workflow file is on the default branch.
- Owner merged PR #1 in each repository. Core CI passed (PR and `main`). Both site deploys failed in the build job: "Cannot find module '@veyra/core'". Cause: the sites' bare `dist/` ignore rule also matched `vendor/veyra-core/dist/`, so the engine's JS and type declarations were never committed (local builds used the files on disk). Fix: anchor the rule (`/dist/`), commit the vendored `dist/` (byte-identical to the release tarball), and `engine:update` now refuses to finish when a vendored file is ignored. Verified from fresh clones exactly as CI runs: `npm ci`, build, the workflow's guard steps, `npm run verify`.

### 2026-10-10 — session 1, round 2 (owner request: "strengthen the engine; reference it from GitHub in the sites")
- Owner merged PR #2 in all three repositories; both site deploys and core CI green.
- Built engine 0.2 (see Phase 3). Real-browser checks caught five bugs the unit tests could not: overlapping scrambles captured scrambled text; keyboard stepping skipped a card from an off-grid position; magnetic measurements went stale after layout changes (→ `stage.onRefresh`); the horizontal plugin defaulted to the pin's first child instead of the track (→ widest child); FLIP read `transform-origin` percentages as pixels. All fixed with regression tests.
- Replaced vendoring with the CI-published `release` branch (ADR-010 supersedes ADR-008); removed `scripts/engine-update.mjs`.

### 2026-10-10 — session 1, round 3 (owner requests: open the pull requests; add the new demos to the studio site)
- Engine PR #3 merged; CI published `release` (`e3ba55c`, tag `v0.2.0`, built from `8461252`). Both sites moved to the `release` branch and deployed green from `main`. One detour: the sites' work-in-progress pull requests (#3) were merged while their checks were red (lockfiles out of step with `package.json`), so the next deploys failed until follow-up pull requests (#4) restored the lockfiles.
- Studio site, "New in 0.2" / «تازه‌های نسخهٔ ۰٫۲»: a `horizontal()` row of seven panels between Engine and Work (leftward in English, rightward in Persian), each a live demo — `kashida`, `draggable`, `flip` + `stagger`, `magnetic` + `tilt`, `scrambleText`, and a WebGL2 shader built from `@veyra/core/glsl` — followed by a `marquee` band. `npm run verify` drives every demo in both languages on desktop and mobile, plus reduced motion (68 checks, all passing).
- Browser review caught three layout bugs: Chrome computes `text-align: match-parent` as `start`, so alignment is now set per language; a promoted FLIP tile placed late in the order squashed into an implicit grid row (it now gets an explicit 2×2 area, and the check asserts square tiles); the code sample overflowed its block at 1440 px.

### 2026-10-10 — session 1, round 4 (owner request: fix release commits that only change `gitHead`)
- Merging the docs-only plan update (#4) wrote `release` commit `dc67af2`, whose only change was `gitHead`; the sites' hourly check would count it as a new engine and rebuild with the same one. `scripts/release-branch.mjs` now compares the package with the previous `gitHead` in place and commits, recording the new source commit, only when the packed files change.
- Tested against a local bare remote: first publish (commit + `v0.2.0`), re-run on the same commit (nothing), a docs-only commit (the old script commits, the new one doesn't), a source change (commit with the new `gitHead`), a version bump (commit + `v0.2.1`, history kept); a no-op run reports `changed=false`, so no `engine-updated` dispatch goes out.
