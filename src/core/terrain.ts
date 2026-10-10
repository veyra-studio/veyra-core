/**
 * Procedural terrain on a regular grid: eroded-looking mountains from noise
 * with derivatives, sunlight and shadows baked by marching the height field
 * toward the sun, and ambient occlusion from the surrounding horizon. Pure
 * math (no DOM, no WebGL): bake once, then light a mesh with the results.
 *
 * ```ts
 * const field = heightfield({ size: [8000, 8000], resolution: 256, height: (x, z) => 900 * erodedNoise(x / 2200, z / 2200) })
 * const sun = bakeSunlight(field, [0.6, 0.35, -0.7])   // 0…1 per sample
 * const ao = bakeOcclusion(field)                       // 0…1 per sample
 * ```
 */
import { seededRandom } from './math.js'

export interface HeightfieldOptions {
  /** World size `[width (x), depth (z)]`, centered on the origin. */
  size: readonly [number, number]
  /** Samples per side (or `[x, z]`). */
  resolution: number | readonly [number, number]
  /** Height at a world position. */
  height?: (x: number, z: number) => number
  /** Precomputed heights (row-major), e.g. from a worker, instead of `height`. */
  heights?: Float32Array
}

export interface Heightfield {
  readonly size: readonly [number, number]
  readonly nx: number
  readonly nz: number
  /** Heights, row-major (z rows of x samples). */
  readonly heights: Float32Array
  readonly min: number
  readonly max: number
  /** Bilinear height at a world position (clamped at the edges). */
  sample(x: number, z: number): number
  /** Bilinear lookup of any per-sample data (baked light, masks) at a world position. */
  bilinear(data: ArrayLike<number>, x: number, z: number): number
  /** Surface normal at a world position (central differences). */
  normal(x: number, z: number, out?: [number, number, number]): [number, number, number]
  /** World position of grid sample `(i, j)`. */
  position(i: number, j: number): [x: number, z: number]
}

/** Samples a height function on a regular grid. */
export function heightfield(options: HeightfieldOptions): Heightfield {
  const [w, d] = options.size
  const [nx, nz] = typeof options.resolution === 'number' ? [options.resolution, options.resolution] : options.resolution
  if (!options.height && !options.heights) throw new Error('[veyra] heightfield needs `height` or `heights`')
  if (options.heights && options.heights.length !== nx * nz) throw new Error('[veyra] heightfield: `heights` does not match the resolution')
  const heights = options.heights ?? new Float32Array(nx * nz)
  let min = Infinity
  let max = -Infinity
  const dx = w / (nx - 1)
  const dz = d / (nz - 1)
  for (let j = 0; j < nz; j++) {
    const z = -d / 2 + j * dz
    for (let i = 0; i < nx; i++) {
      const h = options.heights ? heights[j * nx + i]! : options.height!(-w / 2 + i * dx, z)
      heights[j * nx + i] = h
      if (h < min) min = h
      if (h > max) max = h
    }
  }
  const bilinear = (data: ArrayLike<number>, x: number, z: number) => {
    const fx = Math.min(nx - 1, Math.max(0, (x + w / 2) / dx))
    const fz = Math.min(nz - 1, Math.max(0, (z + d / 2) / dz))
    const i = Math.min(nx - 2, Math.floor(fx))
    const j = Math.min(nz - 2, Math.floor(fz))
    const tx = fx - i
    const tz = fz - j
    const k = j * nx + i
    const a = data[k]! + (data[k + 1]! - data[k]!) * tx
    const b = data[k + nx]! + (data[k + nx + 1]! - data[k + nx]!) * tx
    return a + (b - a) * tz
  }
  const sample = (x: number, z: number) => bilinear(heights, x, z)
  return {
    size: [w, d],
    nx,
    nz,
    heights,
    min,
    max,
    sample,
    bilinear,
    normal(x, z, out = [0, 1, 0]) {
      const e = Math.min(dx, dz)
      const hx = sample(x + e, z) - sample(x - e, z)
      const hz = sample(x, z + e) - sample(x, z - e)
      const len = Math.hypot(hx, 2 * e, hz)
      out[0] = -hx / len
      out[1] = (2 * e) / len
      out[2] = -hz / len
      return out
    },
    position: (i, j) => [-w / 2 + i * dx, -d / 2 + j * dz],
  }
}

/**
 * Value noise with analytic derivatives, layered so that steep places get
 * less fine detail — the look of erosion (after Iñigo Quilez's terrain).
 * Returns roughly `[0, 1]`.
 */
export function erodedNoise(x: number, z: number, options: { octaves?: number; seed?: number; sharpness?: number } = {}): number {
  const octaves = options.octaves ?? 8
  const seed = options.seed ?? 0
  const sharp = options.sharpness ?? 1
  let a = 0
  let b = 0.5
  let dxs = 0
  let dzs = 0
  let px = x
  let pz = z
  for (let o = 0; o < octaves; o++) {
    const [n, nx, nz] = valueNoiseD(px, pz, seed + o * 31)
    dxs += nx
    dzs += nz
    a += (b * n) / (1 + sharp * (dxs * dxs + dzs * dzs))
    b *= 0.5
    // Rotate and scale the domain between octaves (breaks grid alignment).
    const rx = 1.6 * px - 1.2 * pz
    const rz = 1.2 * px + 1.6 * pz
    px = rx
    pz = rz
  }
  return a
}

/** Ridged multifractal noise in `[0, 1]`: sharp crests, soft valleys. */
export function ridgedNoise(x: number, z: number, options: { octaves?: number; seed?: number } = {}): number {
  const octaves = options.octaves ?? 6
  const seed = options.seed ?? 0
  let sum = 0
  let amp = 0.5
  let weight = 1
  let px = x
  let pz = z
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    const [n] = valueNoiseD(px, pz, seed + o * 17)
    let r = 1 - Math.abs(n * 2 - 1)
    r *= r
    r *= weight
    weight = Math.min(1, r * 2)
    sum += r * amp
    norm += amp
    amp *= 0.5
    const rx = 1.7 * px - 1.1 * pz
    const rz = 1.1 * px + 1.7 * pz
    px = rx
    pz = rz
  }
  return sum / norm
}

const hash = (i: number, j: number, seed: number) => {
  let h = (i * 374761393 + j * 668265263 + seed * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** 2D value noise in `[0, 1]` with its derivatives `[n, dn/dx, dn/dz]`. */
export function valueNoiseD(x: number, z: number, seed = 0): [number, number, number] {
  const i = Math.floor(x)
  const j = Math.floor(z)
  const fx = x - i
  const fz = z - j
  // Quintic fade and its derivative.
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10)
  const dux = 30 * fx * fx * (fx * (fx - 2) + 1)
  const duz = 30 * fz * fz * (fz * (fz - 2) + 1)
  const a = hash(i, j, seed)
  const b = hash(i + 1, j, seed)
  const c = hash(i, j + 1, seed)
  const d = hash(i + 1, j + 1, seed)
  const k1 = b - a
  const k2 = c - a
  const k4 = a - b - c + d
  return [a + k1 * ux + k2 * uz + k4 * ux * uz, dux * (k1 + k4 * uz), duz * (k2 + k4 * ux)]
}

/**
 * Sunlight per sample `0…1`: 0 where the sun is below the horizon seen from
 * that point (a mountain is in the way), softened near shadow edges.
 * `sun` is a direction toward the sun (any length); y is up.
 */
export function bakeSunlight(field: Heightfield, sun: readonly [number, number, number], options: { steps?: number; softness?: number } = {}): Float32Array {
  const [sx, sy, sz] = sun
  const len = Math.hypot(sx, sy, sz)
  const ux = sx / len
  const uy = sy / len
  const uz = sz / len
  const horizontal = Math.hypot(ux, uz) || 1e-6
  const slope = uy / horizontal // rise per unit of horizontal travel toward the sun
  const steps = options.steps ?? 96
  const [w, d] = field.size
  const step = Math.max(w / (field.nx - 1), d / (field.nz - 1)) * 1.5
  const softness = options.softness ?? 0.04
  const dirX = ux / horizontal
  const dirZ = uz / horizontal
  const out = new Float32Array(field.nx * field.nz)
  for (let j = 0; j < field.nz; j++) {
    for (let i = 0; i < field.nx; i++) {
      const [x, z] = field.position(i, j)
      const h0 = field.heights[j * field.nx + i]!
      // The steepest angle to the terrain toward the sun, vs. the sun's angle.
      let worst = -Infinity
      for (let s = 1; s <= steps; s++) {
        const t = step * s * (1 + s * 0.04)
        const px = x + dirX * t
        const pz = z + dirZ * t
        if (Math.abs(px) > w / 2 || Math.abs(pz) > d / 2) break
        const rise = (field.sample(px, pz) - h0) / t
        if (rise > worst) worst = rise
      }
      const margin = slope - worst
      out[j * field.nx + i] = Math.min(1, Math.max(0, 0.5 + margin / (softness * 2)))
    }
  }
  return out
}

/**
 * Ambient occlusion per sample `0…1`: how open the sky is, from the
 * horizon angle in several directions.
 */
export function bakeOcclusion(field: Heightfield, options: { directions?: number; steps?: number; radius?: number } = {}): Float32Array {
  const directions = options.directions ?? 8
  const steps = options.steps ?? 10
  const [w, d] = field.size
  const radius = options.radius ?? Math.max(w, d) / 16
  const out = new Float32Array(field.nx * field.nz)
  const rand = seededRandom(5)
  const offsets = Array.from({ length: directions }, (_, k) => (k + rand() * 0.5) * ((Math.PI * 2) / directions))
  for (let j = 0; j < field.nz; j++) {
    for (let i = 0; i < field.nx; i++) {
      const [x, z] = field.position(i, j)
      const h0 = field.heights[j * field.nx + i]!
      let open = 0
      for (const a of offsets) {
        const cx = Math.cos(a)
        const cz = Math.sin(a)
        let maxSin = 0
        for (let s = 1; s <= steps; s++) {
          const t = (radius * s) / steps
          const dh = field.sample(x + cx * t, z + cz * t) - h0
          const sin = dh / Math.hypot(dh, t)
          if (sin > maxSin) maxSin = sin
        }
        open += 1 - maxSin
      }
      out[j * field.nx + i] = open / directions
    }
  }
  return out
}

export interface HeightfieldMeshOptions {
  /** Grid segments `[x, z]` (or one number for both). Default: one per field sample. */
  segments?: number | readonly [number, number]
  /** Maps the unit grid (`u`, `v` in `0…1`) to world `[x, z]`. Default: the field's full extent. */
  layout?: (u: number, v: number) => readonly [x: number, z: number]
  /** Per-sample arrays (same length as the field) to resample at the mesh's vertices. */
  attributes?: Readonly<Record<string, ArrayLike<number>>>
}

export interface HeightfieldMesh {
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
  indices: Uint32Array
  /** The resampled `attributes`, one value per vertex. */
  attributes: Record<string, Float32Array>
}

/**
 * Vertex data for a grid that samples a height field — plain typed arrays,
 * so it can be built in a worker and transferred. `@veyra/core/three` wraps
 * it as `heightfieldGeometry`.
 */
export function heightfieldMesh(field: Heightfield, options: HeightfieldMeshOptions = {}): HeightfieldMesh {
  const [sx, sz] = typeof options.segments === 'number' ? [options.segments, options.segments] : (options.segments ?? [field.nx - 1, field.nz - 1])
  const [w, d] = field.size
  const layout = options.layout ?? ((u: number, v: number) => [(u - 0.5) * w, (v - 0.5) * d] as const)
  const count = (sx + 1) * (sz + 1)
  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const uvs = new Float32Array(count * 2)
  const extra = Object.entries(options.attributes ?? {}).map(([name, data]) => ({ name, data, out: new Float32Array(count) }))
  const n: [number, number, number] = [0, 1, 0]
  let k = 0
  for (let j = 0; j <= sz; j++) {
    for (let i = 0; i <= sx; i++) {
      const u = i / sx
      const v = j / sz
      const [x, z] = layout(u, v)
      positions[k * 3] = x
      positions[k * 3 + 1] = field.sample(x, z)
      positions[k * 3 + 2] = z
      field.normal(x, z, n)
      normals[k * 3] = n[0]
      normals[k * 3 + 1] = n[1]
      normals[k * 3 + 2] = n[2]
      uvs[k * 2] = u
      uvs[k * 2 + 1] = v
      for (const e of extra) e.out[k] = field.bilinear(e.data, x, z)
      k++
    }
  }
  const indices = new Uint32Array(sx * sz * 6)
  const stride = sx + 1
  let t = 0
  for (let j = 0; j < sz; j++) {
    for (let i = 0; i < sx; i++) {
      const a = j * stride + i
      const b = a + 1
      const c = a + stride
      const e = c + 1
      indices[t++] = a
      indices[t++] = c
      indices[t++] = b
      indices[t++] = b
      indices[t++] = c
      indices[t++] = e
    }
  }
  const attributes: Record<string, Float32Array> = {}
  for (const e of extra) attributes[e.name] = e.out
  return { positions, normals, uvs, indices, attributes }
}
