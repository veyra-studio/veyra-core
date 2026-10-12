// Packs the engine into release/veyra-core-<version>.tgz — the artifact
// projects vendor (see docs/integration.md).
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const src = readFileSync(join(root, 'src/index.ts'), 'utf8')
const match = /VERSION = '([^']+)'/.exec(src)
if (!match || match[1] !== pkg.version) {
  console.error(`VERSION in src/index.ts (${match?.[1]}) must match package.json (${pkg.version})`)
  process.exit(1)
}

const outDir = join(root, 'release')
mkdirSync(outDir, { recursive: true })
// npm as this script was started (npm_execpath): spawning `npm` itself fails on Windows.
const npm = (args, options) => (process.env.npm_execpath ? execFileSync(process.execPath, [process.env.npm_execpath, ...args], options) : execFileSync('npm', args, { ...options, shell: process.platform === 'win32' }))
const out = npm(['pack', '--json', '--pack-destination', outDir], { cwd: root, encoding: 'utf8' })
const [info] = JSON.parse(out)
const produced = join(outDir, info.filename)
const target = join(outDir, `veyra-core-${pkg.version}.tgz`)
if (produced !== target) {
  if (existsSync(target)) rmSync(target)
  renameSync(produced, target)
}
const sha = createHash('sha256').update(readFileSync(target)).digest('hex')
console.log(`packed ${target}`)
console.log(`  files: ${info.files.length}  size: ${(info.size / 1024).toFixed(1)} KB  unpacked: ${(info.unpackedSize / 1024).toFixed(1)} KB`)
console.log(`  sha256: ${sha}`)
