/**
 * Turned shapes from measured silhouettes: bottles, glasses, plates, bowls,
 * caps. A profile is a list of `[radius, height]` points from the bottom up,
 * the way you read them off a photograph. `Profile` smooths the outline,
 * samples it, offsets it (glass walls, liquids), measures volume, builds the
 * lathe geometry and builds bands for labels whose artwork keeps its
 * proportions on cones.
 *
 * ```ts
 * const outer = new Profile([[0, 0], [0.15, 0.01], [0.15, 0.5], [0.07, 0.9], [0.07, 1]], { corners: [1] })
 * const glass = new THREE.Mesh(outer.geometry(96), glassMaterial)
 * const liquid = outer.offset(0.01).clip(0.02, 0.85)
 * const label = outer.band({ from: 0.55, to: 0.72, arc: Math.PI * 0.8, lift: 0.001 })
 * ```
 */
import * as THREE from 'three'

export type ProfilePoint = readonly [radius: number, height: number]

export interface ProfileOptions {
  /** Interpolated points per input segment (centripetal Catmull-Rom). Default `6`; `1` keeps the polyline. */
  samples?: number
  /** Indices of input points kept as sharp corners: a rim, a base edge. The first and last points always are. */
  corners?: readonly number[]
}

export interface BandOptions {
  /** Bottom of the band (height). */
  from: number
  /** Top of the band (height). */
  to: number
  /** Angle covered around the axis, in radians. Default `2π`. */
  arc?: number
  /** Angle of the band's center line, in radians; `0` faces +z. Default `0`. */
  center?: number
  /** Outward offset along the surface normal (a label's thickness). Default `0`. */
  lift?: number
  /** Segments `[around, along]`. Default `[64, 24]`. */
  segments?: readonly [number, number]
}

export interface Band {
  /** The band's surface. `u` runs around the axis and is proportional to arc length; `v` runs up the outline. */
  geometry: THREE.BufferGeometry
  /** Artwork width in profile units: the arc length of the band's widest row. */
  width: number
  /** Artwork height in profile units: the outline length between `from` and `to`. */
  height: number
  /**
   * Half the band's width at `v` (0 bottom … 1 top), in `u` units (`0…0.5`).
   * On a cone the band narrows where the radius shrinks; draw edge rules
   * along this line so they follow the cut edge of a real label.
   */
  halfWidthAt(v: number): number
}

const sub = (a: THREE.Vector2, b: THREE.Vector2) => new THREE.Vector2(a.x - b.x, a.y - b.y)

/** Smooths a polyline with centripetal Catmull-Rom between corners (no overshoot, no cusps). */
function smooth(input: readonly THREE.Vector2[], samples: number, corners: ReadonlySet<number>): THREE.Vector2[] {
  if (samples <= 1 || input.length < 3) return input.map((p) => p.clone())
  const out: THREE.Vector2[] = []
  let start = 0
  for (let i = 1; i < input.length; i++) {
    if (i < input.length - 1 && !corners.has(i)) continue
    const run = input.slice(start, i + 1)
    if (run.length < 3) {
      // A straight span between two corners.
      for (let k = out.length ? 1 : 0; k < run.length; k++) out.push(run[k]!.clone())
    } else {
      const curve = new THREE.CatmullRomCurve3(
        run.map((p) => new THREE.Vector3(p.x, p.y, 0)),
        false,
        'centripetal',
      )
      const pts = curve.getPoints(samples * (run.length - 1))
      for (let k = out.length ? 1 : 0; k < pts.length; k++) out.push(new THREE.Vector2(Math.max(0, pts[k]!.x), pts[k]!.y))
    }
    start = i
  }
  return out
}

export class Profile {
  /** Smoothed outline, bottom up (`x` = radius, `y` = height). */
  readonly points: THREE.Vector2[]
  /** Outline length from the first point to each point. */
  private readonly lengths: number[]

  constructor(points: readonly ProfilePoint[] | readonly THREE.Vector2[], options: ProfileOptions = {}) {
    const input = points.map((p) => (p instanceof THREE.Vector2 ? p.clone() : new THREE.Vector2(p[0], p[1])))
    if (input.length < 2) throw new Error('[veyra] Profile needs at least two points')
    this.points = smooth(input, options.samples ?? 6, new Set(options.corners ?? []))
    this.lengths = [0]
    for (let i = 1; i < this.points.length; i++) {
      this.lengths.push(this.lengths[i - 1]! + this.points[i]!.distanceTo(this.points[i - 1]!))
    }
  }

  /** Lowest and highest point of the outline. */
  get bounds(): { min: number; max: number; radius: number } {
    let min = Infinity
    let max = -Infinity
    let radius = 0
    for (const p of this.points) {
      min = Math.min(min, p.y)
      max = Math.max(max, p.y)
      radius = Math.max(radius, p.x)
    }
    return { min, max, radius }
  }

  /** Total outline length. */
  get length(): number {
    return this.lengths[this.lengths.length - 1]!
  }

  /**
   * Index of the first segment, from the bottom, that spans height `h` going
   * up, and the interpolation factor within it. `null` when no rising
   * segment reaches `h`.
   */
  private locate(h: number): { i: number; t: number } | null {
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1]!
      const b = this.points[i]!
      if (b.y > a.y && h >= a.y && h <= b.y) return { i, t: (h - a.y) / (b.y - a.y) }
    }
    return null
  }

  /** Radius at height `h` on the first rising span from the bottom. `0` outside the outline. */
  radiusAt(h: number): number {
    const at = this.locate(h)
    if (!at) return 0
    const a = this.points[at.i - 1]!
    const b = this.points[at.i]!
    return a.x + (b.x - a.x) * at.t
  }

  /** `dr/dh` at height `h` (negative where the outline narrows going up). */
  slopeAt(h: number): number {
    const at = this.locate(h)
    if (!at) return 0
    const a = this.points[at.i - 1]!
    const b = this.points[at.i]!
    return (b.x - a.x) / (b.y - a.y)
  }

  /** Outline length from the bottom to height `h` (on the first rising span). */
  lengthAt(h: number): number {
    const at = this.locate(h)
    if (!at) return h <= this.bounds.min ? 0 : this.length
    const segment = this.lengths[at.i]! - this.lengths[at.i - 1]!
    return this.lengths[at.i - 1]! + segment * at.t
  }

  /**
   * The outline moved along its normal: positive `distance` moves inward
   * (a glass wall's inside, a liquid inside the glass). Radii are clamped
   * at the axis.
   */
  offset(distance: number): Profile {
    const pts = this.points
    // Outward normal of a bottom-up segment: its direction turned clockwise.
    const normals = pts.slice(1).map((p, i) => {
      const t = sub(p, pts[i]!)
      return t.lengthSq() === 0 ? null : t.normalize().set(t.y, -t.x)
    })
    const out = pts.map((p, i) => {
      const a = normals[i - 1] ?? null
      const b = normals[i] ?? null
      let m: THREE.Vector2
      let len = distance
      if (a && b) {
        // Miter join: corners keep the wall's thickness.
        m = a.clone().add(b)
        if (m.lengthSq() < 1e-12) m = b.clone()
        m.normalize()
        len = distance / Math.max(0.25, m.dot(b))
      } else {
        m = (a ?? b ?? new THREE.Vector2(1, 0)).clone()
      }
      return new THREE.Vector2(Math.max(0, p.x - m.x * len), p.y - m.y * len)
    })
    return new Profile(out, { samples: 1 })
  }

  /**
   * The part of the outline between two heights, closed to the axis at both
   * ends — the solid a liquid fills, for instance. Follows the first rising
   * spans from the bottom.
   */
  clip(from: number, to: number, options: { closeBottom?: boolean; closeTop?: boolean } = {}): Profile {
    const out: THREE.Vector2[] = []
    const r0 = this.radiusAt(from)
    const r1 = this.radiusAt(to)
    if (options.closeBottom !== false) out.push(new THREE.Vector2(0, from))
    out.push(new THREE.Vector2(r0, from))
    for (const p of this.points) {
      if (p.y > from && p.y < to && Math.abs(this.radiusAt(p.y) - p.x) < 1e-9) out.push(p.clone())
    }
    out.push(new THREE.Vector2(r1, to))
    if (options.closeTop !== false) out.push(new THREE.Vector2(0, to))
    return new Profile(out, { samples: 1 })
  }

  /**
   * Volume of the solid of revolution between two heights, in cubed profile
   * units, using the first rising spans (an inner profile gives capacity).
   */
  volume(from = this.bounds.min, to = this.bounds.max): number {
    let v = 0
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1]!
      const b = this.points[i]!
      if (!(b.y > a.y)) continue
      const h0 = Math.max(a.y, from)
      const h1 = Math.min(b.y, to)
      if (h1 <= h0) continue
      const r0 = this.radiusAt(h0)
      const r1 = this.radiusAt(h1)
      // Only count spans that are the outline's first crossing of those heights.
      const mid = (h0 + h1) / 2
      const rm = a.x + ((b.x - a.x) * (mid - a.y)) / (b.y - a.y)
      if (Math.abs(this.radiusAt(mid) - rm) > 1e-9) continue
      v += (Math.PI * (h1 - h0) * (r0 * r0 + r0 * r1 + r1 * r1)) / 3
    }
    return v
  }

  /** The lathe geometry of the outline. */
  geometry(segments = 64, phiStart = 0, phiLength = Math.PI * 2): THREE.LatheGeometry {
    return new THREE.LatheGeometry(this.points, segments, phiStart, phiLength)
  }

  /**
   * A band of the surface between two heights, for labels and sleeves.
   * Texture coordinates are proportional to arc length around the axis and
   * to outline length along it, so artwork drawn at `width × height` keeps
   * its proportions even on a cone, while the band's edges follow the axis
   * (the cut of a real label on a tapered bottle).
   */
  band(options: BandOptions): Band {
    const { from, to } = options
    const arc = options.arc ?? Math.PI * 2
    const center = options.center ?? 0
    const lift = options.lift ?? 0
    const [around, along] = options.segments ?? [64, 24]
    const l0 = this.lengthAt(from)
    const l1 = this.lengthAt(to)
    const height = Math.max(1e-9, l1 - l0)
    // Rows evenly spaced along the outline.
    const rows: Array<{ h: number; r: number; n: THREE.Vector2 }> = []
    for (let j = 0; j <= along; j++) {
      const target = l0 + (height * j) / along
      // Find the height whose outline length is `target` (bisection).
      let lo = from
      let hi = to
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2
        if (this.lengthAt(mid) < target) lo = mid
        else hi = mid
      }
      const h = (lo + hi) / 2
      const slope = this.slopeAt(h)
      const n = new THREE.Vector2(1, -slope).normalize()
      rows.push({ h, r: this.radiusAt(h), n })
    }
    let rMax = 0
    for (const row of rows) rMax = Math.max(rMax, row.r + row.n.x * lift)
    const width = Math.max(1e-9, arc * rMax)

    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    for (let j = 0; j <= along; j++) {
      const row = rows[j]!
      const r = row.r + row.n.x * lift
      const y = row.h + row.n.y * lift
      for (let i = 0; i <= around; i++) {
        const phi = center - arc / 2 + (arc * i) / around
        positions.push(r * Math.sin(phi), y, r * Math.cos(phi))
        uvs.push(0.5 + ((phi - center) * r) / width, j / along)
      }
    }
    const stride = around + 1
    for (let j = 0; j < along; j++) {
      for (let i = 0; i < around; i++) {
        const a = j * stride + i
        const b = a + 1
        const c = a + stride
        const d = c + 1
        indices.push(a, b, d, a, d, c)
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    const halfWidthAt = (v: number) => {
      const t = Math.min(1, Math.max(0, v)) * along
      const j = Math.min(along - 1, Math.floor(t))
      const a = rows[j]!
      const b = rows[j + 1]!
      const r = a.r + a.n.x * lift + (b.r + b.n.x * lift - (a.r + a.n.x * lift)) * (t - j)
      return (arc / 2) * r / width
    }
    return { geometry, width, height, halfWidthAt }
  }
}
