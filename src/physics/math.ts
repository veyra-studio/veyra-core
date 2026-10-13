/**
 * Small, allocation-free vector math for the physics: plain `{x, y, z}`
 * objects (so bodies can be read straight into any renderer's types) and
 * row-major 3×3 matrices in a `Float64Array`.
 */

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Quat {
  x: number
  y: number
  z: number
  w: number
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z })
export const quat = (x = 0, y = 0, z = 0, w = 1): Quat => ({ x, y, z, w })

/** @internal */
export function set(out: Vec3, x: number, y: number, z: number): Vec3 {
  out.x = x
  out.y = y
  out.z = z
  return out
}

/** @internal */
export const copy = (out: Vec3, a: Vec3): Vec3 => set(out, a.x, a.y, a.z)
/** @internal */
export const add = (out: Vec3, a: Vec3, b: Vec3): Vec3 => set(out, a.x + b.x, a.y + b.y, a.z + b.z)
/** @internal */
export const sub = (out: Vec3, a: Vec3, b: Vec3): Vec3 => set(out, a.x - b.x, a.y - b.y, a.z - b.z)
/** @internal */
export const scale = (out: Vec3, a: Vec3, s: number): Vec3 => set(out, a.x * s, a.y * s, a.z * s)
/** `a + b·s` @internal */
export const addScaled = (out: Vec3, a: Vec3, b: Vec3, s: number): Vec3 => set(out, a.x + b.x * s, a.y + b.y * s, a.z + b.z * s)
/** @internal */
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z
/** @internal */
export const length = (a: Vec3): number => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z)

/** `a × b` (safe when `out` is `a` or `b`). @internal */
export function cross(out: Vec3, a: Vec3, b: Vec3): Vec3 {
  return set(out, a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
}

/** Unit vector; `fallback` (default +y) for a zero vector. @internal */
export function normalize(out: Vec3, a: Vec3, fallback?: Vec3): Vec3 {
  const l = length(a)
  if (l < 1e-12) return fallback ? copy(out, fallback) : set(out, 0, 1, 0)
  return scale(out, a, 1 / l)
}

/** Two unit vectors perpendicular to unit `n` and to each other. @internal */
export function tangents(n: Vec3, t1: Vec3, t2: Vec3): void {
  if (Math.abs(n.x) < 0.57735) set(t1, 0, n.z, -n.y)
  else set(t1, n.y, -n.x, 0)
  normalize(t1, t1)
  cross(t2, n, t1)
}

/** @internal */
export type Mat3 = Float64Array

/** @internal */
export const mat3 = (): Mat3 => new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1])

/** Rotation matrix of a unit quaternion: its columns are the body's axes in world space. @internal */
export function mat3FromQuat(out: Mat3, q: Quat): Mat3 {
  const { x, y, z, w } = q
  out[0] = 1 - 2 * (y * y + z * z)
  out[1] = 2 * (x * y - z * w)
  out[2] = 2 * (x * z + y * w)
  out[3] = 2 * (x * y + z * w)
  out[4] = 1 - 2 * (x * x + z * z)
  out[5] = 2 * (y * z - x * w)
  out[6] = 2 * (x * z - y * w)
  out[7] = 2 * (y * z + x * w)
  out[8] = 1 - 2 * (x * x + y * y)
  return out
}

/** `m · v` @internal */
export function mulMat3(out: Vec3, m: Mat3, v: Vec3): Vec3 {
  return set(out, m[0]! * v.x + m[1]! * v.y + m[2]! * v.z, m[3]! * v.x + m[4]! * v.y + m[5]! * v.z, m[6]! * v.x + m[7]! * v.y + m[8]! * v.z)
}

/** `mᵀ · v` (world to local for a rotation). @internal */
export function mulMat3T(out: Vec3, m: Mat3, v: Vec3): Vec3 {
  return set(out, m[0]! * v.x + m[3]! * v.y + m[6]! * v.z, m[1]! * v.x + m[4]! * v.y + m[7]! * v.z, m[2]! * v.x + m[5]! * v.y + m[8]! * v.z)
}

/** Column `i` of `m` (a body axis). @internal */
export const column = (out: Vec3, m: Mat3, i: number): Vec3 => set(out, m[i]!, m[3 + i]!, m[6 + i]!)

/** `R · diag(d) · Rᵀ`: a world-space inverse inertia from principal values. @internal */
export function rotateDiagonal(out: Mat3, r: Mat3, d: Vec3): Mat3 {
  const dd = [d.x, d.y, d.z]
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0
      for (let k = 0; k < 3; k++) s += r[i * 3 + k]! * dd[k]! * r[j * 3 + k]!
      out[i * 3 + j] = s
    }
  }
  return out
}

/** Integrates an orientation by angular velocity `w` over `h` seconds, then renormalizes. @internal */
export function integrateQuat(q: Quat, w: Vec3, h: number): Quat {
  const hx = 0.5 * h * w.x
  const hy = 0.5 * h * w.y
  const hz = 0.5 * h * w.z
  const { x, y, z, w: qw } = q
  q.x = x + hx * qw + hy * z - hz * y
  q.y = y + hy * qw + hz * x - hx * z
  q.z = z + hz * qw + hx * y - hy * x
  q.w = qw - hx * x - hy * y - hz * z
  const l = Math.hypot(q.x, q.y, q.z, q.w) || 1
  q.x /= l
  q.y /= l
  q.z /= l
  q.w /= l
  return q
}
