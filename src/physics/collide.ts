/**
 * Narrow phase: contact points between boxes, spheres and planes. Every
 * function reports contacts through `emit(point, normal, depth)` with the
 * normal pointing from the first shape to the second and a positive
 * penetration depth; the receiver copies the values (they are scratch).
 *
 * Box–box contacts come from the separating axis test (15 axes) and, for a
 * face, from clipping the other box's most opposed face against it — so a
 * packet landing flat gets four contacts and rests, one hitting with a
 * corner gets one and spins.
 */
import { add, addScaled, copy, cross, dot, normalize, scale, sub, vec3, type Vec3 } from './math.js'

/** A box in world space: center, unit axes and half extents. */
export interface WorldBox {
  c: Vec3
  u: [Vec3, Vec3, Vec3]
  e: [number, number, number]
}

export interface WorldSphere {
  c: Vec3
  r: number
}

export type Emit = (point: Vec3, normal: Vec3, depth: number) => void

const P = vec3()
const N = vec3()
const D = vec3()
const Q = vec3()

export function sphereSphere(a: WorldSphere, b: WorldSphere, emit: Emit): void {
  sub(D, b.c, a.c)
  const dist = Math.hypot(D.x, D.y, D.z)
  const depth = a.r + b.r - dist
  if (depth <= 0) return
  normalize(N, D)
  emit(addScaled(P, a.c, N, a.r - depth / 2), N, depth)
}

/** Box against sphere; the normal points from the box to the sphere (or the other way with `flip`). */
export function boxSphere(box: WorldBox, s: WorldSphere, emit: Emit, flip = false): void {
  sub(D, s.c, box.c)
  const l0 = dot(D, box.u[0])
  const l1 = dot(D, box.u[1])
  const l2 = dot(D, box.u[2])
  const [e0, e1, e2] = box.e
  const q0 = Math.max(-e0, Math.min(e0, l0))
  const q1 = Math.max(-e1, Math.min(e1, l1))
  const q2 = Math.max(-e2, Math.min(e2, l2))
  let depth: number
  if (q0 === l0 && q1 === l1 && q2 === l2) {
    // The center is inside: out through the nearest face.
    const g0 = e0 - Math.abs(l0)
    const g1 = e1 - Math.abs(l1)
    const g2 = e2 - Math.abs(l2)
    const i = g0 <= g1 && g0 <= g2 ? 0 : g1 <= g2 ? 1 : 2
    const g = i === 0 ? g0 : i === 1 ? g1 : g2
    const l = i === 0 ? l0 : i === 1 ? l1 : l2
    scale(N, box.u[i]!, l >= 0 ? 1 : -1)
    depth = s.r + g
    // Midway between the face and the sphere's far side.
    addScaled(P, s.c, N, (g - s.r) / 2)
  } else {
    copy(Q, box.c)
    addScaled(Q, Q, box.u[0], q0)
    addScaled(Q, Q, box.u[1], q1)
    addScaled(Q, Q, box.u[2], q2)
    sub(D, s.c, Q)
    const dist = Math.hypot(D.x, D.y, D.z)
    depth = s.r - dist
    if (depth <= 0) return
    normalize(N, D)
    addScaled(P, Q, N, -depth / 2)
  }
  if (flip) scale(N, N, -1)
  emit(P, N, depth)
}

/** Plane `normal · x = offset` (free side along the normal) against a sphere. */
export function planeSphere(normal: Vec3, offset: number, s: WorldSphere, emit: Emit): void {
  const dist = dot(normal, s.c) - offset
  const depth = s.r - dist
  if (depth <= 0) return
  emit(addScaled(P, s.c, normal, -(s.r + dist) / 2), normal, depth)
}

const corners: Vec3[] = Array.from({ length: 8 }, () => vec3())
const depths = new Float64Array(8)

/** Plane against a box: its corners below the plane (up to four, spread out). */
export function planeBox(normal: Vec3, offset: number, b: WorldBox, emit: Emit): void {
  let n = 0
  for (let k = 0; k < 8; k++) {
    const c = corners[n]!
    copy(c, b.c)
    addScaled(c, c, b.u[0], k & 1 ? b.e[0] : -b.e[0])
    addScaled(c, c, b.u[1], k & 2 ? b.e[1] : -b.e[1])
    addScaled(c, c, b.u[2], k & 4 ? b.e[2] : -b.e[2])
    const dist = dot(normal, c) - offset
    if (dist < 0) {
      depths[n] = -dist
      // Midway between the corner and the plane.
      addScaled(c, c, normal, -dist / 2)
      n++
    }
  }
  reduce(corners, depths, n, (p, d) => emit(p, normal, d))
}

// Box–box scratch.
const R = new Float64Array(9)
const AR = new Float64Array(9)
const T = [0, 0, 0]
const TW = vec3()
const poly: Vec3[] = Array.from({ length: 16 }, () => vec3())
const clip: Vec3[] = Array.from({ length: 16 }, () => vec3())
const found: Vec3[] = Array.from({ length: 16 }, () => vec3())
const foundDepth = new Float64Array(16)
const FC = vec3()
const RN = vec3()
const PA = vec3()
const PB = vec3()

export function boxBox(a: WorldBox, b: WorldBox, emit: Emit): void {
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const r = dot(a.u[i]!, b.u[j]!)
      R[i * 3 + j] = r
      AR[i * 3 + j] = Math.abs(r) + 1e-9
    }
  }
  sub(TW, b.c, a.c)
  T[0] = dot(TW, a.u[0])
  T[1] = dot(TW, a.u[1])
  T[2] = dot(TW, a.u[2])
  const ea = a.e
  const eb = b.e

  // Separation along each axis (negative: overlap). The least overlap wins.
  let face = -Infinity
  let faceOf = 0
  let faceAxis = 0
  for (let i = 0; i < 3; i++) {
    const s = Math.abs(T[i]!) - ea[i]! - (eb[0] * AR[i * 3]! + eb[1] * AR[i * 3 + 1]! + eb[2] * AR[i * 3 + 2]!)
    if (s > 0) return
    if (s > face) {
      face = s
      faceOf = 0
      faceAxis = i
    }
  }
  for (let j = 0; j < 3; j++) {
    const tj = T[0]! * R[j]! + T[1]! * R[3 + j]! + T[2]! * R[6 + j]!
    const s = Math.abs(tj) - eb[j]! - (ea[0] * AR[j]! + ea[1] * AR[3 + j]! + ea[2] * AR[6 + j]!)
    if (s > 0) return
    if (s > face) {
      face = s
      faceOf = 1
      faceAxis = j
    }
  }
  let edge = -Infinity
  let edgeI = -1
  let edgeJ = -1
  for (let i = 0; i < 3; i++) {
    const i1 = (i + 1) % 3
    const i2 = (i + 2) % 3
    for (let j = 0; j < 3; j++) {
      const len = Math.sqrt(Math.max(0, 1 - R[i * 3 + j]! * R[i * 3 + j]!))
      // Parallel edges: the face axes already decide.
      if (len < 1e-5) continue
      const j1 = (j + 1) % 3
      const j2 = (j + 2) % 3
      const ra = ea[i1]! * AR[i2 * 3 + j]! + ea[i2]! * AR[i1 * 3 + j]!
      const rb = eb[j1]! * AR[i * 3 + j2]! + eb[j2]! * AR[i * 3 + j1]!
      const tl = T[i2]! * R[i1 * 3 + j]! - T[i1]! * R[i2 * 3 + j]!
      const s = (Math.abs(tl) - ra - rb) / len
      if (s > 0) return
      if (s > edge) {
        edge = s
        edgeI = i
        edgeJ = j
      }
    }
  }

  // Faces unless an edge pair is clearly shallower (both are negative).
  if (edgeI >= 0 && edge > 0.95 * face + 1e-9) {
    const ai = a.u[edgeI]!
    const bj = b.u[edgeJ]!
    normalize(N, cross(N, ai, bj))
    if (dot(N, TW) < 0) scale(N, N, -1)
    // The edge of A furthest along the normal, and of B furthest against it.
    copy(PA, a.c)
    copy(PB, b.c)
    for (let k = 0; k < 3; k++) {
      if (k !== edgeI) addScaled(PA, PA, a.u[k]!, dot(a.u[k]!, N) > 0 ? ea[k]! : -ea[k]!)
      if (k !== edgeJ) addScaled(PB, PB, b.u[k]!, dot(b.u[k]!, N) > 0 ? -eb[k]! : eb[k]!)
    }
    // Closest points of the two edges.
    sub(D, PA, PB)
    const bb = dot(ai, bj)
    const c = dot(ai, D)
    const f = dot(bj, D)
    const denom = 1 - bb * bb
    let s = denom > 1e-9 ? (bb * f - c) / denom : 0
    s = Math.max(-ea[edgeI]!, Math.min(ea[edgeI]!, s))
    let t = f + s * bb
    t = Math.max(-eb[edgeJ]!, Math.min(eb[edgeJ]!, t))
    addScaled(PA, PA, ai, s)
    addScaled(PB, PB, bj, t)
    add(P, PA, PB)
    emit(scale(P, P, 0.5), N, -edge)
    return
  }

  if (faceOf === 0) {
    scale(RN, a.u[faceAxis]!, T[faceAxis]! >= 0 ? 1 : -1)
    faceContacts(a, faceAxis, RN, b, false, emit)
  } else {
    const tj = T[0]! * R[faceAxis]! + T[1]! * R[3 + faceAxis]! + T[2]! * R[6 + faceAxis]!
    // B's face looking at A.
    scale(RN, b.u[faceAxis]!, tj >= 0 ? -1 : 1)
    faceContacts(b, faceAxis, RN, a, true, emit)
  }
}

/**
 * Clips the incident box's face most opposed to `refN` against the reference
 * face (`ref`'s face along `refN`, which points at the incident box).
 */
function faceContacts(ref: WorldBox, axis: number, refN: Vec3, inc: WorldBox, refIsB: boolean, emit: Emit): void {
  addScaled(FC, ref.c, refN, ref.e[axis]!)
  // The incident face.
  let k = 0
  let best = -1
  for (let i = 0; i < 3; i++) {
    const d = Math.abs(dot(inc.u[i]!, refN))
    if (d > best) {
      best = d
      k = i
    }
  }
  const sign = dot(inc.u[k]!, refN) > 0 ? -1 : 1
  const m1 = (k + 1) % 3
  const m2 = (k + 2) % 3
  addScaled(Q, inc.c, inc.u[k]!, sign * inc.e[k]!)
  const corner = (out: Vec3, s1: number, s2: number) => {
    copy(out, Q)
    addScaled(out, out, inc.u[m1]!, s1 * inc.e[m1]!)
    return addScaled(out, out, inc.u[m2]!, s2 * inc.e[m2]!)
  }
  corner(poly[0]!, 1, 1)
  corner(poly[1]!, -1, 1)
  corner(poly[2]!, -1, -1)
  corner(poly[3]!, 1, -1)
  let count = 4
  // Clip against the reference face's four sides.
  let src = poly
  let dst = clip
  for (let side = 0; side < 4 && count > 0; side++) {
    const sAxis = ref.u[(axis + 1 + (side >> 1)) % 3]!
    const dir = side & 1 ? -1 : 1
    const limit = dir * dot(FC, sAxis) + ref.e[(axis + 1 + (side >> 1)) % 3]!
    let out = 0
    for (let i = 0; i < count; i++) {
      const p0 = src[i]!
      const p1 = src[(i + 1) % count]!
      const d0 = dir * dot(p0, sAxis) - limit
      const d1 = dir * dot(p1, sAxis) - limit
      if (d0 <= 0) copy(dst[out++]!, p0)
      if ((d0 < 0 && d1 > 0) || (d0 > 0 && d1 < 0)) {
        const t = d0 / (d0 - d1)
        const o = dst[out++]!
        sub(o, p1, p0)
        addScaled(o, p0, o, t)
      }
    }
    count = out
    const swap = src
    src = dst
    dst = swap
  }
  // Points below the reference face are contacts, halfway between the faces.
  const top = dot(FC, refN)
  let n = 0
  for (let i = 0; i < count; i++) {
    const p = src[i]!
    const depth = top - dot(p, refN)
    if (depth <= 0) continue
    addScaled(found[n]!, p, refN, depth / 2)
    foundDepth[n] = depth
    n++
  }
  // The emitted normal points from the first box (A) to the second.
  if (refIsB) scale(D, refN, -1)
  else copy(D, refN)
  reduce(found, foundDepth, n, (p, d) => emit(p, D, d))
}

const picked = [0, 0, 0, 0]
const E1 = vec3()
const E2 = vec3()

/** Up to four contacts: the deepest, then the ones spreading the patch most. */
function reduce(points: Vec3[], depth: Float64Array, n: number, out: (p: Vec3, d: number) => void): void {
  if (n <= 4) {
    for (let i = 0; i < n; i++) out(points[i]!, depth[i]!)
    return
  }
  let first = 0
  for (let i = 1; i < n; i++) if (depth[i]! > depth[first]!) first = i
  let second = first
  let far = -1
  for (let i = 0; i < n; i++) {
    sub(E1, points[i]!, points[first]!)
    const d = dot(E1, E1)
    if (d > far) {
      far = d
      second = i
    }
  }
  let third = first
  let area = -1
  sub(E1, points[second]!, points[first]!)
  for (let i = 0; i < n; i++) {
    sub(E2, points[i]!, points[first]!)
    cross(E2, E1, E2)
    const d = dot(E2, E2)
    if (d > area) {
      area = d
      third = i
    }
  }
  let fourth = first
  let spread = -1
  for (let i = 0; i < n; i++) {
    if (i === first || i === second || i === third) continue
    let d = 0
    for (const j of [first, second, third]) {
      sub(E2, points[i]!, points[j]!)
      d += Math.sqrt(dot(E2, E2))
    }
    if (d > spread) {
      spread = d
      fourth = i
    }
  }
  picked[0] = first
  picked[1] = second
  picked[2] = third
  picked[3] = fourth
  const seen = new Set<number>()
  for (const i of picked) {
    if (seen.has(i)) continue
    seen.add(i)
    out(points[i]!, depth[i]!)
  }
}
