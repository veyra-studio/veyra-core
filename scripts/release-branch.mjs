// Publishes the packed package to the `release` branch, which projects
// install from GitHub: "@veyra/core": "github:veyra-studio/veyra-core#release".
// CI runs it on `main` after every check passed.
//
//   node scripts/release-branch.mjs [--push] [--remote origin] [--branch release]
//
// 1. `npm pack` — exactly the files `npm publish` would upload (build first).
// 2. Unpack into a worktree of the release branch (an orphan the first time).
// 3. Drop `devDependencies` and `scripts` from package.json, so installing
//    from git neither builds nor pulls the test toolchain; record the source
//    commit as `gitHead`.
// 4. Commit only when the package itself changed (history is kept, so
//    commits pinned in project lockfiles stay fetchable). A source commit
//    that leaves the packed files alone (docs, tests, CI) publishes nothing,
//    so projects don't rebuild for it, and `gitHead` keeps naming the commit
//    the current package was built from. Tag `v<version>` the first time a
//    version ships.
// 5. With --push, push the branch and the new tag.
//
// In GitHub Actions it writes `changed`, `commit` and `version` outputs.
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const root = resolve(dirname(new URL(import.meta.url).pathname), '..')
const args = process.argv.slice(2)
const option = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const push = args.includes('--push')
const remote = option('--remote', 'origin')
const branch = option('--branch', 'release')
const identity = ['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com']

const git = (cwd, ...cmd) => execFileSync('git', cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const tryGit = (cwd, ...cmd) => {
  try {
    return git(cwd, ...cmd)
  } catch {
    return null
  }
}
/** The source commit a release worktree was built from, if it records one. */
const readGitHead = (dir) => {
  try {
    const { gitHead } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    return typeof gitHead === 'string' ? gitHead : undefined
  } catch {
    return undefined
  }
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const source = git(root, 'rev-parse', 'HEAD')
const tag = `v${pkg.version}`
const packDir = mkdtempSync(join(tmpdir(), 'veyra-pack-'))
const work = mkdtempSync(join(tmpdir(), 'veyra-release-'))
rmSync(work, { recursive: true, force: true })
const tempBranch = `veyra-release-build-${process.pid}`
let createdTempBranch = false

try {
  // 1. Pack.
  const packed = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', packDir], { cwd: root, encoding: 'utf8' }))
  const tarball = join(packDir, packed[0].filename)

  // 2. Worktree on the current release branch, or a fresh orphan.
  const exists = (tryGit(root, 'ls-remote', '--heads', remote, branch) ?? '').length > 0
  if (exists) {
    git(root, 'fetch', '--no-tags', remote, `+refs/heads/${branch}:refs/remotes/${remote}/${branch}`)
    git(root, 'worktree', 'add', '--detach', work, `${remote}/${branch}`)
  } else {
    git(root, 'worktree', 'add', '--detach', work, 'HEAD')
    git(work, 'checkout', '--orphan', tempBranch)
    createdTempBranch = true
  }
  const previous = exists ? readGitHead(work) : undefined
  // Start from an empty tree: unstage everything, then remove the files.
  git(work, 'rm', '-r', '-q', '--cached', '--ignore-unmatch', '.')
  git(work, 'clean', '-fdxq')

  // 3. Unpack and trim the manifest.
  execFileSync('tar', ['-xzf', tarball, '-C', work, '--strip-components=1'])
  const manifest = JSON.parse(readFileSync(join(work, 'package.json'), 'utf8'))
  delete manifest.devDependencies
  delete manifest.scripts
  const stage = (gitHead) => {
    manifest.gitHead = gitHead
    writeFileSync(join(work, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    git(work, 'add', '-A')
  }

  // 4. Commit only when the package changed: compare with the previous
  //    gitHead in place, then record this source commit. Tag a new version.
  stage(previous ?? source)
  const changed = tryGit(work, 'diff', '--cached', '--quiet') === null
  if (changed) {
    stage(source)
    git(work, ...identity, 'commit', '-q', '-m', `Release ${pkg.version} from ${source.slice(0, 7)}`, '-m', `Built from veyra-core@${source}.`)
  }
  const commit = git(work, 'rev-parse', 'HEAD')
  const tagExists = (tryGit(root, 'ls-remote', '--tags', remote, `refs/tags/${tag}`) ?? '').length > 0 || tryGit(root, 'rev-parse', '-q', '--verify', `refs/tags/${tag}`) !== null
  if (!tagExists) git(work, ...identity, 'tag', '-a', tag, '-m', `@veyra/core ${pkg.version}`, commit)

  // 5. Push.
  if (push) {
    if (changed) git(work, 'push', remote, `HEAD:refs/heads/${branch}`)
    if (!tagExists) git(work, 'push', remote, `refs/tags/${tag}`)
  }
  const state = changed ? `Committed ${branch}` : `No package changes for ${branch} (built from ${(previous ?? source).slice(0, 7)})`
  console.log(`${state} @ ${commit.slice(0, 7)} — @veyra/core ${pkg.version}${tagExists ? '' : `, tagged ${tag}`}${push ? '' : ' (not pushed)'}`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\ncommit=${commit}\nversion=${pkg.version}\n`)
} finally {
  tryGit(root, 'worktree', 'remove', '--force', work)
  rmSync(work, { recursive: true, force: true })
  if (createdTempBranch) tryGit(root, 'branch', '-D', tempBranch)
  tryGit(root, 'worktree', 'prune')
  rmSync(packDir, { recursive: true, force: true })
}
