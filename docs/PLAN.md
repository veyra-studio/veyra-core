# Veyra — plan & progress

Master tracker for the three Veyra repositories. Keep it current: it is how work continues across sessions.

| Repository | Role | Deploys to |
| --- | --- | --- |
| [veyra-core](https://github.com/veyra-studio/veyra-core) | The engine (source of truth) | — (packed release, later npm) |
| [abali](https://github.com/veyra-studio/abali) | First showcase: Persian RTL campaign concept for Doogh Abali | https://veyra-studio.github.io/abali/ |
| [veyra-studio.github.io](https://github.com/veyra-studio/veyra-studio.github.io) | Bilingual (EN/FA) studio + engine website | https://veyra-studio.github.io/ |

## Key decisions (details in [architecture.md](architecture.md))

- **Engine**: TypeScript, zero runtime deps, one frame loop, native-first smooth scroll, CSS-sticky pinning, owned motion layer (no GSAP — license), script-aware typography (Persian joining, bidi), adaptive quality, three.js as optional peer (`@veyra/core/three`).
- **Integration**: projects vendor the unpacked release package in `vendor/veyra-core/` (`file:` dependency, `VENDORED.json` records version/checksum/commit). Live co-development via `VEYRA_CORE_SRC=../veyra-core`.
- **Abali**: Vite + TypeScript single page, three.js for the product, base path `/abali/` in every mode.
- **Studio site**: Astro static site, English at `/`, Persian at `/fa/` (each written natively), cross-document View Transitions for the language switch.
- **Deploy**: GitHub Actions → GitHub Pages (`upload-pages-artifact@v5` + `deploy-pages@v4`) in both site repos; PRs build as a check.

## ⚠️ Owner actions required

These are the owner's call (repository settings, merging into `main`):

1. ~~Give Claude write access~~ — done 2026-10-10: Claude GitHub App installed, branches pushed.
2. **abali** → Settings → Pages → *Build and deployment* → Source: **GitHub Actions**.
3. **veyra-studio.github.io** → Settings → Pages → Source: switch from "Deploy from a branch" to **GitHub Actions**. Do this before merging; otherwise the push to `main` publishes the repository's raw files instead of the build.
4. Merge each repository's `claude/happy-gates-7en1kj` branch into `main` (the deploy workflows run on `main`; a pull request runs the build as a check first).

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

### Phase 3 — Next
- **Ship**: owner actions above, then confirm both live URLs (never verified from the session: the sandbox cannot reach `*.github.io`).
- **Abali polish**: real-GPU performance pass (profiling on mid-range Android/iOS), optional audio sprite instead of synthesized pop, a short end-card share flow, Persian copy review by a native copywriter.
- **Engine**: direction-aware horizontal scroll section helper, `stage.media()` breakpoint signals, WebGPU path via `three/webgpu`, GLSL utility chunks (noise, SDFs), a scene timeline scrubber in the debug overlay, audio sprites, published npm package (claim `@veyra` scope).
- **Studio site**: `/docs/` section generated from `veyra-core/docs`, more case studies as showcases ship.

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
