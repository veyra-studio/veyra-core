# Veyra — plan & progress

Master tracker for the three Veyra repositories. Keep it current: it is how work continues across sessions.

| Repository | Role | Deploys to |
| --- | --- | --- |
| [veyra-core](https://github.com/veyra-studio/veyra-core) | The engine (source of truth) | — (packed tarball, later npm) |
| [abali](https://github.com/veyra-studio/abali) | First showcase: Persian RTL campaign concept for Doogh Abali | https://veyra-studio.github.io/abali/ |
| [veyra-studio.github.io](https://github.com/veyra-studio/veyra-studio.github.io) | Bilingual (EN/FA) studio + engine website | https://veyra-studio.github.io/ |

## Key decisions (summary — details in [architecture.md](architecture.md))

- Engine: TypeScript, zero runtime deps, one frame loop, native-first scroll, CSS-sticky pinning, owned motion layer (no GSAP), script-aware typography, adaptive quality, three.js as optional peer (`@veyra/core/three`).
- Integration: projects vendor `veyra-core-<version>.tgz` (`file:` dependency). Local co-dev via `VEYRA_CORE_SRC=../veyra-core`.
- Abali: Vite + TypeScript single page, three.js for the product, base path `/abali/`.
- Studio site: Astro static site, English at `/`, Persian at `/fa/`, cross-document view transitions for the language switch.
- Deploy: GitHub Actions → GitHub Pages (`actions/upload-pages-artifact` + `actions/deploy-pages`) in both site repos.

## Required one-time GitHub settings (owner action)

These cannot be done from a session (they need repository admin rights):

1. **abali** → Settings → Pages → *Build and deployment* → Source: **GitHub Actions**.
2. **veyra-studio.github.io** → Settings → Pages → Source: switch from "Deploy from a branch" to **GitHub Actions**.
3. Merge each repository's working branch into `main` (the deploy workflows run on `main`).

Until (2) is done, the studio repo keeps serving the old branch build (the README).

## Roadmap

### Phase 1 — Foundation ✅ (this session)
- [x] Engine core modules + 60+ unit tests
- [x] three.js integration
- [x] Examples (scroll scenes, Persian type, three + DOM)
- [x] Docs: README, guide, architecture/ADRs, integration
- [x] CI workflow, release packing

### Phase 2 — Showcase & studio site (this session — see status below)
- [ ] Abali: concept, art direction, 3D product, chapters, sound, reduced motion, fallback
- [ ] Studio site: bilingual design, live engine demos, Abali feature, language switching
- [ ] Deploy workflows + verification

### Phase 3 — Next
- Engine: horizontal scroll sections helper (direction-aware), `stage.media()` breakpoint signals, WebGPU path via `three/webgpu`, a tiny GLSL utility library (noise, SDFs), scene authoring devtool (scrubber timeline in the debug overlay), audio sprites.
- Docs site section on the studio website (`/docs/`) generated from `docs/`.
- Publish `@veyra/core` to npm (claim the scope), switch projects to a semver range.
- More showcases to stress different capabilities (e.g. a typographic piece, a WebGL-heavy product launch).

## Status log

### 2026-10-09 — session 1
- Discovery: all three repos contained only a stub README; the studio repo had legacy branch-based Pages enabled; abali had no Pages config.
- Built engine v0.1.0 (see CHANGELOG). Verified examples in headless Chromium (no console errors), Persian joining preserved, bidi runs ordered.
- `npm test`: 61 passing. `npm run typecheck`, `npm run build`, `npm run examples:build` clean. Core bundle ≈ 13 KB min+gzip.
