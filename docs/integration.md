# Integration

How projects (the [Abali showcase](https://github.com/veyra-studio/abali), the [studio website](https://github.com/veyra-studio/veyra-studio.github.io)) consume the engine. Decision record: [ADR-010](architecture.md#adr-010--projects-follow-the-engine-on-github-through-a-ci-built-release-branch).

## The model

```
veyra-core  main ──CI: typecheck · tests · build · examples──▶  release branch (packed package)
                                                                 │
                     "@veyra/core": "github:veyra-studio/veyra-core#release"
                                                                 │
                         ┌───────────────────────────────────────┴──────────────┐
                         ▼                                                      ▼
                       abali                                       veyra-studio.github.io
```

- **Only green builds ship.** CI writes the `release` branch after every check on `main` passed. It contains exactly what `npm publish` would upload, with `devDependencies` and `scripts` removed: installing from GitHub needs no build step and pulls no test toolchain.
- **History is kept.** Each publish is a new commit on `release`, so a commit pinned in a project's lockfile stays installable. A version's first build is also tagged `v<version>`.
- **Projects follow automatically.** Every project build installs the newest `release` commit and records what it deployed in `engine.json`. Projects rebuild when the engine changes: immediately through a `repository_dispatch` (when the engine repository holds `SITES_DISPATCH_TOKEN`), otherwise through an hourly check that compares `release` with the deployed `engine.json`.
- **Failure is safe.** If a new engine breaks a project build, that deploy fails and the previous site stays live.

## Releasing an engine change

Merge to `main`. That's it: CI publishes the `release` branch, and the projects pick it up.

For a new version, bump `"version"` in `package.json` and `VERSION` in `src/index.ts` (`npm run release:pack` checks they match) and add a `CHANGELOG.md` entry; the first build of that version gets the `v<version>` tag.

To publish by hand (normally unnecessary): `npm run build && node scripts/release-branch.mjs --push`.

## In a project

```bash
npm install @veyra/core@github:veyra-studio/veyra-core#release   # add, or move to the newest release
npm run engine:update                                            # the same, as a project script
```

Pin when you need to hold a version (for example before a launch):

```json
"@veyra/core": "github:veyra-studio/veyra-core#v0.2.0"
```

The project's deploy workflow then still rebuilds on schedule, but installs the pinned version.

### Rebuilding the sites right away (optional)

Create a fine-grained personal access token (or a GitHub App token) with **Contents: read and write** on `abali` and `veyra-studio.github.io`, and save it in `veyra-core` → Settings → Secrets and variables → Actions as `SITES_DISPATCH_TOKEN`. CI then sends `engine-updated` to both sites after each publish. Without it, the hourly check picks the change up.

Scheduled workflows in a public repository are paused by GitHub after 60 days without activity in that repository; any push re-enables them.

## Co-developing engine and project

To work on the engine while seeing changes live in a project, point the project's Vite config at the engine source:

```bash
VEYRA_CORE_SRC=../veyra-core npm run dev
```

Both projects alias `@veyra/core` (and `@veyra/core/three`, `@veyra/core/glsl`) to `$VEYRA_CORE_SRC/src/*.ts` when the variable is set, so HMR works across both repositories. Production builds never use the alias.

When the change is ready, merge it in `veyra-core`; the projects follow.

## Project rules

- **Projects never patch engine code.** If a showcase needs a capability, it goes into `veyra-core` (generic) or stays in the project (specific). Brand art direction, copy, shaders and scene choreography live in projects.
- **Generic first.** A feature graduates into the engine when a second project would want it, or when it encodes hard-won correctness (bidi, joining, frame pacing).
- **Pin three.js in projects.** `three` is a peer dependency; each project chooses and locks its version.
- **Engine changes are additive between versions.** A project tracking `release` must keep building; breaking changes need a major version and a pinned transition.
