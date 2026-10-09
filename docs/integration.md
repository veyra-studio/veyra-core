# Integration

How projects (the [Abali showcase](https://github.com/veyra-studio/abali), the [studio website](https://github.com/veyra-studio/veyra-studio.github.io)) consume the engine.

## The model

```
veyra-core  ──npm pack──▶  release/veyra-core-0.1.0.tgz
                                  │  copied into
                                  ▼
abali/vendor/veyra-core-0.1.0.tgz        package.json: "@veyra/core": "file:vendor/veyra-core-0.1.0.tgz"
veyra-studio.github.io/vendor/…tgz       package.json: same
```

Projects depend on the **packed release artifact** — byte-for-byte what `npm publish` would upload. Consequences:

- **Reproducible deploys.** A project's GitHub Actions build installs only from its own repository. It never depends on another repository's branch state, on a git dependency being reachable, or on credentials.
- **Explicit upgrades.** Moving a project to a new engine version is a visible commit (new tarball + lockfile).
- **Painless migration to npm.** When `@veyra/core` is published, replace the `file:` spec with a version range. Nothing else changes.

## Releasing a new engine version

In `veyra-core`:

```bash
# bump "version" in package.json and VERSION in src/index.ts, update CHANGELOG.md
npm run release:pack
# → runs typecheck + tests + build, then writes release/veyra-core-<version>.tgz
```

In each project (sibling checkouts assumed):

```bash
npm run engine:update          # copies ../veyra-core/release/*.tgz into vendor/ and reinstalls
git add vendor package.json package-lock.json && git commit -m "Update Veyra Core to <version>"
```

## Co-developing engine and project

To work on the engine while seeing changes live in a project, point the project's Vite config at the engine source:

```bash
VEYRA_CORE_SRC=../veyra-core npm run dev
```

Both projects alias `@veyra/core` (and `@veyra/core/three`) to `$VEYRA_CORE_SRC/src/*.ts` when the variable is set, so HMR works across both repositories. Production builds never use the alias.

When the change is ready: release a version, update the tarball in the project, commit both.

## Project rules

- **Projects never patch engine code.** If a showcase needs a capability, it goes into `veyra-core` (generic) or stays in the project (specific). Brand art direction, copy, shaders and scene choreography live in projects.
- **Generic first.** A feature graduates into the engine when a second project would want it, or when it encodes hard-won correctness (bidi, joining, frame pacing).
- **Pin three.js in projects.** `three` is a peer dependency; each project chooses and locks its version.
