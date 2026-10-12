# Veyra — plan & progress

Master tracker for the Veyra repositories. Keep it current: it is how work continues across sessions.

| Repository | Role | Deploys to |
| --- | --- | --- |
| [veyra-core](https://github.com/veyra-studio/veyra-core) | The engine (source of truth) | `release` branch, built by CI (later npm) |
| [abali](https://github.com/veyra-studio/abali) | First showcase: Persian RTL campaign concept for Doogh Abali | https://veyra-studio.github.io/abali/ |
| [veyra-studio.github.io](https://github.com/veyra-studio/veyra-studio.github.io) | Multilingual (EN/FA/AR/TR) studio + engine website; takes commissions (itsmetti@proton.me) | https://veyra-studio.github.io/ |
| [durex](https://github.com/veyra-studio/durex) | Second showcase (planned): English campaign concept for Durex, «Zero gravity.» | https://veyra-studio.github.io/durex/ (once built) |

## Key decisions (details in [architecture.md](architecture.md))

- **Engine**: TypeScript, zero runtime deps, one frame loop, native-first smooth scroll, CSS-sticky pinning, owned motion layer (no GSAP — license), script-aware typography (Persian joining, bidi, kashida), adaptive quality, stage-dependent capabilities as plugins, three.js as optional peer (`@veyra/core/three`), shader chunks (`@veyra/core/glsl`).
- **Integration** (ADR-010, owner decision 2026-10-10): projects depend on `github:veyra-studio/veyra-core#release`. CI publishes every green `main` build to `release` (packed package, no dev dependencies, history kept, `v<version>` tags). Projects install the newest release at build time, record it in `engine.json`, and rebuild on `repository_dispatch` (optional token) or an hourly check. Live co-development via `VEYRA_CORE_SRC=../veyra-core`.
- **Abali**: Vite + TypeScript single page, three.js for the product, base path `/abali/` in every mode.
- **Studio site**: Astro static site, English at `/`, Persian at `/fa/` (each written natively), cross-document View Transitions for the language switch.
- **Deploy**: GitHub Actions → GitHub Pages (`upload-pages-artifact@v5` + `deploy-pages@v4`) in both site repos; PRs build as a check.

## ⚠️ Owner actions

Done: GitHub access, Pages set to GitHub Actions in both site repositories, both sites deployed from `main`, the engine released from the `release` branch (0.2 → 0.4.2), the studio's 0.2 showcase and the Abali redesign merged. Every work branch is merged and deleted: each repository has only `main` (plus veyra-core's `release`, the build branch the sites install from — CI writes it, keep it).

Open:

1. *(Optional)* `SITES_DISPATCH_TOKEN` in `veyra-core` → Settings → Secrets → Actions: a fine-grained token with **Contents: read and write** on `abali` and `veyra-studio.github.io`, so the sites rebuild right after an engine release instead of within the hour.
2. *(Optional)* A native Persian copywriter's read of Abali's copy («خنکی صدا دارد.» and the chapters), and a check on real mid-range phones.
3. Review the 2026-10-13 branches (`claude/engine-0.8`, `claude/every-device`, `claude/contact`, `claude/plan`) and merge the engine first: Abali needs 0.8 on `release` before its branch builds in CI.
4. Durex: photographs of the packaging to sample from (reference only), and a decision on the headline (see `durex/README.md`).

## Status

### Phase 1 — Engine foundation ✅
- Core modules: ticker, motion (timelines/tweens/springs/easing), scroll, scenes, rect cache, viewport/pointer, script-aware `splitText`, `drawElementText`, preloader, quality governor, sound bus, debug overlay, `createStage` + plugins, capability detection.
- `@veyra/core/three`: ThreeLayer (pixel camera, configurable fov/near, quality-driven DPR), DOM anchors, DOM text mirroring.
- 65 unit tests (Vitest + jsdom). Full core bundle 19.3 KB min+gzip (tree-shaken builds ship less). Examples: scroll scenes, Persian type, three + DOM — verified in headless Chromium.
- Docs: README, guide, architecture/ADRs, integration, this plan. CI workflow. Release packing.

### Phase 2 — Showcase & studio site ✅ (first release)
- **Abali** (first concept, replaced in Phase 4): loader, procedural bottle, label push-in, landscape morph, fizz chapter, sofreh flat-lay, finale pop; optional synthesized sound; reduced-motion and no-WebGL fallbacks; `npm run verify`.
- **Studio site**: bilingual design (EN/FA designed separately), woven "veil" hero, live engine demos (frame loop, spring, scroll progress, Persian splitting naive vs Veyra, adaptive quality), Abali case study, studio/engine/showcase relationship, principles, code sample, bilingual 404, language-switch view transitions, hreflang/OG/sitemap. Verification script.
- Deploy workflows in both site repos.

### Phase 3 — Engine 0.2 & GitHub distribution ✅
- **Engine 0.2**: horizontal sections (direction-aware, snapping, focus-safe), `draggable` (inertia, rubber band, snap, keyboard), `magnetic`, `tilt`, `cursor`, `marquee`, `flip`, `stagger`, `Decay`, `kashida`, `scrambleText`, noise, `@veyra/core/glsl`, `imageSequence`, `whenVisible`, `stage.media()`, `stage.onRefresh()`. 107 unit tests; `npm run verify:examples` drives six examples in headless Chromium (all checks pass). Additive — Abali builds and passes its full verification on 0.2 installed from git.
- **Distribution**: `release` branch published by CI (`scripts/release-branch.mjs`, tested against a local bare repository: first publish, no-op re-run, version bump with history kept, install into Abali). Fixes the old follow-up: installs no longer pull the engine's test toolchain (Abali: 89 → 33 packages).
- **Sites**: both depend on `github:veyra-studio/veyra-core#release` (lockfiles pin the 0.2.0 release commit), `vendor/` is gone, and the deploy workflows install the newest release, write `engine.json`, accept `repository_dispatch` and check hourly. Deployed from `main` on 2026-10-10.

### Phase 4 — Engine 0.3–0.4 & the Abali redesign ✅
- **Engine 0.3**: turned shapes (`Profile`: measured silhouettes, offsets, volumes, label bands), studio light (`studioEnvironment`), condensation maps, `ReflectiveFloor`, `ContactShadow`, terrain (`heightfield`, `erodedNoise`, `ridgedNoise`, `bakeSunlight`, `bakeOcclusion`, `heightfieldMesh`, worker-friendly), sound one-shots (`SoundBus.tone`/`burst`); example 07 *Product & terrain* with pixel-probe checks.
- **Engine 0.4**: noise baked into a texture with its analytic gradient (`noiseTexture`, `tilingNoise`; GLSL `tfbm`/`tfbmd`, 2D and triplanar) — one read per octave instead of dozens of hashes. **0.4.1**: the quality governor drops to its minimum when frames stay over 250 ms (it used to ignore them as stalls). **0.4.2**: software rendering is detected (`isSoftwareRenderer`; `ThreeLayer.software`, `softwareQuality`) and starts at the lowest quality. **0.4.3**: `seeThroughGlass` (glass over a transparent canvas shows the page instead of three.js's half-white fill); `Profile` reads points by shape. 135 unit tests; seven examples verified in headless Chromium (three timing-dependent checks made robust).
- **Abali, «خنکی صدا دارد.»**: the sounds of opening a cold one — «تق»، «پیس»، «قلپ، قلپ»، «آخیش». A bottle measured from photographs (profile, glass with condensation, doogh, label, 21-flute crown cap) on black acrylic with ice; a steel opener that lies on the cap, hooks the skirt and pries; a cap with real gravity that bounces and settles; a breath of cold fog; foam you build by shaking; a winter valley in the Central Alborz (terrain baked in a worker, detail from a noise texture, 60 fps on an M1); a block-printed sofreh set dish by dish in real time (koobideh, grilled tomatoes, rice, sabzi khordan, red onion, sumac, lavash, spoon and fork, a glass of doogh with ice, mint and a straw); a finale where you open it. Events are triggered by the scroll and play in real time, reversibly; camera moves follow the scroll. No invented brand facts; sources in the footer; the unofficial-concept disclaimer stays. `npm run verify` passes on SwiftShader and on the GPU.
- **Studio site**: the Abali case follows the new headline (tagline, bodies, hero image), engine 0.4.2.
- **Repositories**: descriptions, homepages and topics set on all three.

### Phase 4b — Engine 0.5–0.6: clear solids, weak devices ✅
- **Engine 0.5**: `refractiveSolid` — clear solids (ice, glass blocks) ray-traced through an SDF in the fragment shader: refraction in and out, internal reflection past the critical angle, Beer–Lambert tint, hooks for what rays see outside, inside, relief and normals (ADR-012).
- **Engine 0.6.1–0.7**: steady quality tiers (a tier left for slow frames stays out of reach, so what a page swaps by tier doesn't flicker); sound that starts on every user activation and after the system suspends it, and `defaultOn`. 152 unit tests.
- **Engine 0.6**: the quality governor never takes the refresh rate below 60 Hz (a device at 30 fps used to pass for a 30 Hz screen), steps down after one far-too-slow window, and starts phones in the middle; wheel scrolling goes native at the lowest tier; `warmUp` compiles and draws a scene into one pixel before it shows; the solid's program key is a hash. 146 unit tests.
- **Abali**: ray-traced ice in the studio and in the glass; every world follows the quality tier as it changes; the low tier drops the floor reflection, the bottle's transmission, the grain and the blurs; the sofreh's glass lost its transmission pass; responsive layouts for phones on their side and very wide screens.

### Phase 4c — Engine 0.8: every device ✅ (2026-10-13, awaiting merge)
- **Quality**: windows judged by their typical frame (hitches don't count), `quality.hold()` during one-off work, a fenced tier may be re-entered once after ~10 s of headroom, the target stops at 60 fps (`maxTargetFps`), the pixel ratio follows the screen (`syncDpr`). Seen once on the owner's desktop (RX 580, in the desktop app's browser pane): Abali settled at medium with high fenced off. Headless runs on the same GPU don't reproduce it (both engines stay high there, frames ~150 fps unsynced); unit tests cover the mechanism — hitches counted as load, then a permanent fence.
- **Phones**: `threeLayer({ stableHeight })` / `viewport.stableHeight` — the canvas holds still while the address bar slides in and out; one resize per layout change; `layer.lost` and `layer.onRestore` rebuild what lived only on the GPU after a lost context (example 07 shows the environment light at 268 before, 268 after with `onRestore`, 0 without); sound the visitor turns on plays on an iPhone set to silent (Audio Session `'playback'`).
- **Per frame**: no `window.scrollX` reads in `RectCache.view()`, no layout reads on wheel events.
- **Windows**: `build`, `release:pack`, `verify:examples` and the sites' verify scripts run in PowerShell.
- **Abali**: holds the governor while loading and building worlds; `stableHeight`; restores its three environments after a lost context (drawn fallback after 3 s without one); the sofreh's bottle built small (droplets and label at its size); no strings built per frame; Noto Nastaliq subset to «دوغ آبعلی» (22 KB instead of 234, pixel-identical); a commission line in the footer.
- **Studio site**: a «Commissions» section with the address (mailto with a subject per language, copy button), a nav link and the footer, in all four languages; the Abali facts brought up to date.

### Phase 5 — Next
- **Abali**: profile on real mid-range Android/iOS phones (the emulated weak-phone profile is in `lab/weak.mjs`, not a substitute); a native copywriter's review; perhaps recorded sounds as an audio sprite beside the synthesized ones; a short share card at the end.
- **Engine**: WebGPU path via `three/webgpu`, a scene timeline scrubber in the debug overlay, audio sprites, page transitions beyond cross-document View Transitions, a declarative `data-` attribute layer, published npm package (claim `@veyra` scope).
- **Studio site**: `/docs/` generated from `veyra-core/docs`, more case studies as showcases ship.

### Phase 6 — Durex, «Zero gravity.» (planned)
English, witty and luxurious, everything floating: foil packets in zero gravity, tear one open, unroll it, blow it up — 18 litres, the standard; about 40, what Durex says a typical one holds — and let it go: it flies around the page like an untied balloon, bouncing off the real headlines. Then the water test, and «Play safe». Concept, facts with sources, chapters and the build plan: [durex/README.md](https://github.com/veyra-studio/durex/blob/main/README.md). Engine work first: light rigid-body physics with DOM colliders, `SoundBus.voice()`, a press-and-hold input.

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

### 2026-10-10 — session 2 (owner brief: redesign Abali — real 3D, new copy, verifiable facts only)
- veyra-core: the pending `claude/happy-gates-7en1kj` fix opened and merged (#5). Engine 0.3 (#6): product rendering, terrain and sound (see Phase 4); real-browser pixel probes caught a frustum-culled contact shadow and a floor reflection invisible at grazing angles.
- Abali redesigned (#5) around three sounds, then refined on review (#6): events that froze mid-air when scrubbed now play in real time and reverse; one continuous camera without dead zones; foam → mist → mountains and mist → cloth transitions without white gaps; dishes set down by hand; koobideh and grilled tomatoes rebuilt; tall screens frame the table below the menu card.
- Performance: the mountain chapter ran at 15–20 fps on an M1 (dozens of noise hashes per pixel). Engine 0.4 (#7) bakes the noise into a texture with its gradient → sharper rock and 60 fps. Under SwiftShader frames took ~6 s and the governor never reacted (it ignored frames over 250 ms) → 0.4.1 (#8); software rendering now starts low → 0.4.2 (#9); Abali draws a lean terrain on the low tier.
- Studio site: the Abali case rewritten for the new concept (#6), with a recaptured hero image.

### 2026-10-10 — session 2, round 2 (owner review of the live site)
- Owner: tidy the branches so `main` is the latest everywhere; add repository descriptions. Done: every merged work branch deleted (pull requests are now merged with `--delete-branch`); descriptions, homepages and topics set.
- Abali (#7): the hero says «خنکی صدا دارد.» over «از درِ بطری تا قلپِ اول.» (no more «تق، پیس، آخیش!» at the top or in the footer, which now says «نوش جان!»); the loader says «یک لحظه…». The opener was rolled on its side, came in diagonally and was no wider than the cap → a 12 cm opener that lies on the cap, hooks under the skirt and pries, seen from a little above. The cap fell at 1/26 of real gravity → a free body that hops, tumbles, bounces and settles like a coin; the finale shows the opener too. The "steam like tea" → a breath of cold fog, gone in a second. Gulps («قلپ، قلپ») after the opening sounds. The glass of doogh read as yogurt → clear refracting glass, fizz, ice, mint and a straw.
- Abali (#8), the sofreh: storage creases and hand-printing irregularities on the cloth, pressed flat under the dishes; sabzi khordan with radishes and spring onions; a red onion with violet-edged rings; coarse dark sumac; real lavash; a spoon and a fork; a deeper window light.
- Studio site (#7): the new headline in the Abali case, hero image recaptured, engine 0.4.2.
- Verified each step: engine `npm run check` and examples; `npm run build` + `npm run verify` (CPU and GPU) in Abali, `npm run build` + `npm run verify` in the studio site; frame-by-frame slow-motion captures of the opener and the cap; live sites checked after every deploy.

### 2026-10-10 — session 2, round 3 (owner review: straw, ice, section 3, finale shadows)
- Finale → footer: the shadows and reflections jumped because the bottle rose through the camera's eye level and the floor flipped to being seen from below. The finale's picture now scrolls like a photograph (a lens shift); perspective doesn't change (abali #9).
- Ice and glass: the ice looked like white wax. Root cause found in three.js — over a transparent canvas, transmission refracts a half-white fill — and fixed generally in the engine (0.4.3, `seeThroughGlass`, #11). Clear glass then made the bottle look like ice, which the owner didn't want: Abali keeps three.js's milky fill (the cold bottle's frosted look) and its ice no longer uses transmission (bright Fresnel-edged ice with a misty heart, #10). The straw now sits in the glass (#9).
- Section 3 (#10): low morning sun (alpenglow, blue shadows, glinting snow), a deeper sky; «آخیش!» in white; a frosted card with «آبعلی» in Nastaliq, the two factual lines and the coordinates (fa/en Wikipedia); the camera looks around with the pointer and the hand blows the snow aside; a breath out after the gulps.
- Debugging note: an engine-source alias build pulled a second copy of three.js and broke `instanceof` checks (the doogh's profile collapsed in that build only). Abali's Vite config dedupes three; `Profile` no longer relies on `instanceof`.
- Studio site: Abali hero image recaptured; engine 0.4.3 (#7, #8). All checks pass (engine, both sites, CPU and GPU); live sites checked.

### 2026-10-10 — session 2, round 4 (owner: the ice still isn't pretty; then: lag on weaker devices, responsive review)
- Ice, rethought: a translucent shell with a sprite inside read as grey plastic. Now each cube is ray-traced (engine 0.5, `refractiveSolid`, #13): what the rays see is modelled — the bottle (a cylinder), the black floor (Fresnel-bright toward the horizon), the studio's strips and a backlight hidden behind the set, as drinks photographers light ice — with a cloudy heart and tiny bubbles. The glass on the sofreh shows its doogh through the same ice (abali #11).
- Weak devices (owner: Abali and the engine lag on them). Profiled with CPU throttling and per-render GPU timings per tier:
  - Engine 0.6 (#14): the governor's 30 Hz blind spot and slow reaction (above); phones start in the middle; native wheel at the lowest tier; `warmUp`.
  - Abali (#12): the studio and table were built at the first tier and kept it — now every world follows the tier as it changes; the sofreh's glass transmission (60% of that world) and the floor's mirrored transmission are gone; the ice's dense mesh ran its trace several times per pixel (2×2 shading blocks) — large flat faces fixed it; compile stalls when scrolling into later worlds (`warmUp`); a computed-style read for every letter of «پیسسس» every frame; per-frame CSS writes; a fixed background repainted on scroll; a 2×-viewport grain layer.
  - Results (headless Metal, phone viewport): studio 11.7 → 6.7 ms at high, 0.5 ms at low; sofreh 11.9 → 4.1 ms at high, 1.2 ms at low; on the throttled profile the hero's p90 frame 33 → 17 ms.
- Responsive sweep at 11 sizes (320×568 to 3440×1440, automatic overflow and clipped-text checks, screenshots reviewed): a phone on its side had overlapping lines in «پیس» and the place card running off screen in «آخیش»; the footer slid under the HUD; on a 320 px phone the finale's button sat on the ice; on very wide screens the bottle and the copy drifted apart. All fixed (abali #12).
- The user merged abali #12 after its checks passed. Studio site: engine 0.6.0 and the Abali image recaptured (#9); Abali's share image recaptured (#13). The studio site itself was already light on the weak profile (60 fps, ≤ 2 ms JS per frame).

### 2026-10-11 — session 2, round 5 (owner review on a phone: cutlery, sofreh, quality flicker, taps, shaking, sound)
- Sofreh (abali #14): the spoon and fork were flat grey shapes → polished steel (lofted, crowned handles, a spoon bowl with a rolled rim, a cupped fork head) reflecting a room of their own. On phones the glass and the cutlery fell off the frame → the narrow frame spans the spread. Dishes "popped in": lowered from above, a dish seen from overhead only grew → now brought in from the nearest side (food on the plate with the plate). A dark haze with a broken edge: a CSS multiply layer sized to `100svh` ended short when a phone's toolbar hid → the window light is drawn in the render.
- The bottle flickered between its high- and low-tier glass: the governor stepped down, recovered and climbed back near a boundary → engine 0.6.1 steady tiers (#16); the low tier also keeps the floor's reflection and all six cubes.
- Taps: the bottle rings and rocks; an ice cube clinks and jiggles, cracks on the third and fourth tap (a milky fracture runs through it) and breaks on the fifth into six chips with real gravity and a puff of ice dust. Picking uses a column and boxes, never the dense meshes; links and buttons keep their clicks.
- Shaking: one flick filled the gauge → only swings that reverse count; vigorous shaking boils it over in about five seconds, and then the foam fills the screen and carries the reader on to «آخیش».
- Sound (owner: "on" but silent until toggled; on by default): the engine unlocked audio on `pointerdown`, which a touch's start isn't — fixed in 0.7.0 (#17) for every activation and after system suspension; Abali turns sound on by default (abali #15).
- All checks pass (engine 152 tests and examples; Abali CPU and GPU, with new checks for taps, boiling over and the sound default); live site checked after each deploy.


### 2026-10-13 — session 3 (owner brief: what's wrong and the plan; every device for the engine and Abali; a commission address on the studio site; plan Durex)
- Review: four repositories cloned to a Windows desktop (PowerShell). Found: the governor counting load hitches as slowness and then fencing the tier for good; a 103 fps target on 120/144 Hz screens; the three.js canvas resized (stretched, reallocated, camera jumping) whenever a phone's address bar moved, and twice per rotation; `window.scrollX` read in `RectCache.view()` every frame and a layout read on every wheel event; environments black after a lost WebGL context; silent iPhones muting sound the visitor turned on; `quality.dpr` blind to a new screen; `build`, `release:pack` and the verify scripts broken on Windows (`rm -rf`, spawning `npm`, URL pathnames as paths); Abali building a full-size second bottle for the sofreh and downloading 234 KB of Nastaliq for two words; no way to order a project on the studio site, and the studio site overflowing 320 px phones by 50 px (a 12-column grid's fixed gaps).
- Engine 0.8.0 (`claude/engine-0.8`): see Phase 4c and the changelog. 159 unit tests; every example check passes in headless Chromium, with new ones for the phone address bar (no resize), a rotation (one resize) and a lost context (environment light 268 → 268 with `onRestore`, 0 without). Debugging note: Chrome allows `restoreContext()` only after the lost event has finished dispatching — a check that restores from the event's promise continuation never gets its context back.
- Abali (`claude/every-device`, built against the packed 0.8.0): all 37 checks pass on SwiftShader, including the new ones (commission address, address bar, lost context with the drawn fallback). On the owner's GPU (D3D11, headless), engine 0.7 and 0.8 both stay high; 0.8 holds its judgement until the later worlds are built, then climbs to 1.0. The Nastaliq subset renders pixel-identically (canvas comparison at 400 and 700). Its lockfile still pins 0.7: run `npm run engine:update` once 0.8 is on `release`.
- Studio site (`claude/contact`): the «Commissions» section, nav link and footer address in four languages; the 320 px overflow fixed; 186 checks pass.
- Durex (`claude/plan`): concept and build plan written (owner's choices: English, witty and luxurious, all four extra scenes besides «Pump» and «Let go»). Nothing built yet.
- Nothing committed or pushed: the owner reviews the branches first (see Owner actions).
