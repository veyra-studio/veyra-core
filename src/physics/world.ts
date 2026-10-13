/**
 * Light rigid-body physics: boxes and spheres (alone or as a compound),
 * planes, gravity or none, sub-stepped sequential impulses with friction and
 * bounce. Made for a page's worth of bodies — floating packets that knock
 * into each other, a balloon bouncing off the headlines — not thousands.
 * Units are yours: CSS pixels through a pixel camera work as well as metres.
 *
 * ```ts
 * const physics = new PhysicsWorld({ gravity: vec3(0, -1800, 0), slop: 0.5 })
 * const card = physics.add({ shape: { type: 'box', half: vec3(80, 50, 4) }, position: vec3(0, 300, 0) })
 * physics.addPlane(vec3(0, 1, 0), -400) // a floor at y = -400
 * stage.onFrame((frame) => physics.step(frame.delta))
 * ```
 */
import {
  addScaled,
  column,
  copy,
  cross,
  dot,
  integrateQuat,
  mat3,
  mat3FromQuat,
  mulMat3,
  quat,
  rotateDiagonal,
  scale,
  set,
  sub,
  tangents,
  vec3,
  type Mat3,
  type Quat,
  type Vec3,
} from './math.js'
import { boxBox, boxSphere, planeBox, planeSphere, sphereSphere, type Emit, type WorldBox, type WorldSphere } from './collide.js'

export type BodyKind = 'dynamic' | 'kinematic' | 'static'

/** A collision shape; `offset` places it in the body's frame (the body's origin is its center of mass). */
export type Shape = { type: 'box'; half: Vec3; offset?: Vec3 } | { type: 'sphere'; radius: number; offset?: Vec3 }

export interface BodyOptions<T = unknown> {
  /** One shape, or `shapes` for a compound body. Shapes can be resized later (mutate them). */
  shape?: Shape
  shapes?: Shape[]
  /**
   * Default `'dynamic'`. Kinematic bodies move only as you set them — give
   * them a `velocity` so what they hit responds to it; static ones never move.
   */
  kind?: BodyKind
  /** Default `1`. */
  mass?: number
  position?: Vec3
  quaternion?: Quat
  velocity?: Vec3
  angularVelocity?: Vec3
  /** Bounciness `0…1`; a contact uses the larger of its two. Default `0.3`. */
  restitution?: number
  /** Coulomb friction; a contact uses the geometric mean. Default `0.4`. */
  friction?: number
  /** Velocity lost per second, as an exponential rate. Default `0`. */
  linearDamping?: number
  /** Default `0`. */
  angularDamping?: number
  /** Principal moments of inertia; by default derived from the shapes (and kept in step as they resize). */
  inertia?: Vec3
  /** Bodies collide when each one's `group` is in the other's `mask`. Defaults: `1`, every group. */
  group?: number
  mask?: number
  userData?: T
}

let ids = 0

export class Body<T = unknown> {
  readonly id = ++ids
  kind: BodyKind
  readonly shapes: Shape[]
  readonly position: Vec3
  readonly quaternion: Quat
  readonly velocity: Vec3
  readonly angularVelocity: Vec3
  mass: number
  restitution: number
  friction: number
  linearDamping: number
  angularDamping: number
  inertia: Vec3 | null
  group: number
  mask: number
  /** Left out of the simulation while `false`. */
  enabled = true
  userData: T

  /** @internal */ readonly force = vec3()
  /** @internal */ readonly torque = vec3()
  /** @internal */ readonly rotation: Mat3 = mat3()
  /** @internal */ readonly invInertia = vec3()
  /** @internal */ readonly invInertiaWorld: Mat3 = mat3()
  /** @internal */ invMass = 0
  /** @internal */ readonly boxes: WorldBox[] = []
  /** @internal */ readonly spheres: WorldSphere[] = []
  /** @internal */ readonly min = vec3()
  /** @internal */ readonly max = vec3()

  constructor(options: BodyOptions<T>) {
    this.shapes = options.shapes ?? (options.shape ? [options.shape] : [])
    if (this.shapes.length === 0) throw new Error('[veyra] a body needs a shape')
    this.kind = options.kind ?? 'dynamic'
    this.mass = options.mass ?? 1
    this.position = options.position ?? vec3()
    this.quaternion = options.quaternion ?? quat()
    this.velocity = options.velocity ?? vec3()
    this.angularVelocity = options.angularVelocity ?? vec3()
    this.restitution = options.restitution ?? 0.3
    this.friction = options.friction ?? 0.4
    this.linearDamping = options.linearDamping ?? 0
    this.angularDamping = options.angularDamping ?? 0
    this.inertia = options.inertia ?? null
    this.group = options.group ?? 1
    this.mask = options.mask ?? 0xffffffff
    this.userData = options.userData as T
    for (const s of this.shapes) {
      if (s.type === 'box') this.boxes.push({ c: vec3(), u: [vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1)], e: [0, 0, 0] })
      else this.spheres.push({ c: vec3(), r: 0 })
    }
    this.update()
  }

  get dynamic(): boolean {
    return this.kind === 'dynamic' && this.mass > 0
  }

  /** Adds a force (and its torque about the center when applied at a world `point`) for the next step. */
  applyForce(f: Vec3, point?: Vec3): this {
    addScaled(this.force, this.force, f, 1)
    if (point) {
      sub(T1, point, this.position)
      addScaled(this.torque, this.torque, cross(T1, T1, f), 1)
    }
    return this
  }

  applyTorque(t: Vec3): this {
    addScaled(this.torque, this.torque, t, 1)
    return this
  }

  /** Changes the velocity right away, as a blow at a world `point` (or at the center). */
  applyImpulse(j: Vec3, point?: Vec3): this {
    if (!this.dynamic) return this
    this.update()
    addScaled(this.velocity, this.velocity, j, this.invMass)
    if (point) {
      sub(T1, point, this.position)
      cross(T1, T1, j)
      addScaled(this.angularVelocity, this.angularVelocity, mulMat3(T1, this.invInertiaWorld, T1), 1)
    }
    return this
  }

  /** @internal Rotation, mass properties, world shapes and bounds from the current state. */
  update(): void {
    const r = mat3FromQuat(this.rotation, this.quaternion)
    if (this.dynamic) {
      this.invMass = 1 / this.mass
      const i = this.inertia ?? shapeInertia(this.shapes, this.mass, T2)
      set(this.invInertia, i.x > 0 ? 1 / i.x : 0, i.y > 0 ? 1 / i.y : 0, i.z > 0 ? 1 / i.z : 0)
      rotateDiagonal(this.invInertiaWorld, r, this.invInertia)
    } else {
      this.invMass = 0
      set(this.invInertia, 0, 0, 0)
      this.invInertiaWorld.fill(0)
    }
    set(this.min, Infinity, Infinity, Infinity)
    set(this.max, -Infinity, -Infinity, -Infinity)
    let bi = 0
    let si = 0
    for (const shape of this.shapes) {
      const c = shape.type === 'box' ? this.boxes[bi]!.c : this.spheres[si]!.c
      if (shape.offset) addScaled(c, this.position, mulMat3(c, r, shape.offset), 1)
      else copy(c, this.position)
      let ex: number
      let ey: number
      let ez: number
      if (shape.type === 'box') {
        const box = this.boxes[bi++]!
        column(box.u[0], r, 0)
        column(box.u[1], r, 1)
        column(box.u[2], r, 2)
        const h = shape.half
        box.e[0] = h.x
        box.e[1] = h.y
        box.e[2] = h.z
        ex = Math.abs(r[0]!) * h.x + Math.abs(r[1]!) * h.y + Math.abs(r[2]!) * h.z
        ey = Math.abs(r[3]!) * h.x + Math.abs(r[4]!) * h.y + Math.abs(r[5]!) * h.z
        ez = Math.abs(r[6]!) * h.x + Math.abs(r[7]!) * h.y + Math.abs(r[8]!) * h.z
      } else {
        const sphere = this.spheres[si++]!
        sphere.r = shape.radius
        ex = ey = ez = shape.radius
      }
      this.min.x = Math.min(this.min.x, c.x - ex)
      this.min.y = Math.min(this.min.y, c.y - ey)
      this.min.z = Math.min(this.min.z, c.z - ez)
      this.max.x = Math.max(this.max.x, c.x + ex)
      this.max.y = Math.max(this.max.y, c.y + ey)
      this.max.z = Math.max(this.max.z, c.z + ez)
    }
  }
}

/** Principal moments of a compound of solid shapes sharing `mass` by volume (offsets by the parallel axis rule). */
function shapeInertia(shapes: readonly Shape[], mass: number, out: Vec3): Vec3 {
  let volume = 0
  for (const s of shapes) volume += s.type === 'box' ? 8 * s.half.x * s.half.y * s.half.z : (4 / 3) * Math.PI * s.radius ** 3
  set(out, 0, 0, 0)
  for (const s of shapes) {
    const v = s.type === 'box' ? 8 * s.half.x * s.half.y * s.half.z : (4 / 3) * Math.PI * s.radius ** 3
    const m = volume > 0 ? (mass * v) / volume : mass / shapes.length
    if (s.type === 'box') {
      const { x, y, z } = s.half
      out.x += (m * (y * y + z * z)) / 3
      out.y += (m * (x * x + z * z)) / 3
      out.z += (m * (x * x + y * y)) / 3
    } else {
      const i = 0.4 * m * s.radius * s.radius
      out.x += i
      out.y += i
      out.z += i
    }
    const o = s.offset
    if (o) {
      out.x += m * (o.y * o.y + o.z * o.z)
      out.y += m * (o.x * o.x + o.z * o.z)
      out.z += m * (o.x * o.x + o.y * o.y)
    }
  }
  return out
}

/** A static boundary `normal · x = offset`; bodies are kept on the side the normal points to. */
export interface Plane<T = unknown> {
  readonly id: number
  /** Unit normal, pointing to the free side. */
  readonly normal: Vec3
  offset: number
  restitution: number
  friction: number
  group: number
  mask: number
  enabled: boolean
  userData: T
}

export interface ContactEvent {
  /** The first body, or the plane. */
  a: Body | Plane
  b: Body
  /** Normal impulse over the step (mass × speed): how hard they met. */
  impulse: number
  /** Speed at which they closed in along the normal. */
  speed: number
  /** The deepest contact point and the normal (from `a` to `b`), in world space. Scratch: copy to keep. */
  point: Vec3
  normal: Vec3
  /** The first step of this touch. */
  began: boolean
}

export interface PhysicsOptions {
  /** Default: none (zero gravity). */
  gravity?: Vec3
  /** Steps per `step(dt)`: more keeps fast, thin bodies from passing through each other. Default `2`. */
  substeps?: number
  /** Solver passes per substep. Default `8`. */
  iterations?: number
  /** Penetration left alone (world units) so resting contacts don't jitter. Default `0.01`. */
  slop?: number
  /** Share of the remaining penetration pushed out per substep. Default `0.2`. */
  correction?: number
  /** Fastest positional correction (units per second). Default: no limit. */
  maxCorrection?: number
  /** Contacts closing slower than this don't bounce (units per second). Default `1`. */
  bounceThreshold?: number
}

interface Constraint {
  a: Body | null
  b: Body
  plane: Plane | null
  key: number
  point: Vec3
  normal: Vec3
  rA: Vec3
  rB: Vec3
  t1: Vec3
  t2: Vec3
  depth: number
  massN: number
  massT1: number
  massT2: number
  target: number
  bias: number
  friction: number
  jn: number
  jt1: number
  jt2: number
  approach: number
}

interface Touch {
  a: Body | Plane
  b: Body
  impulse: number
  speed: number
  depth: number
  point: Vec3
  normal: Vec3
}

const T1 = vec3()
const T2 = vec3()
const T3 = vec3()
const V = vec3()

export class PhysicsWorld {
  readonly bodies: Body<any>[] = []
  readonly planes: Plane<any>[] = []
  gravity: Vec3
  substeps: number
  iterations: number
  slop: number
  correction: number
  maxCorrection: number
  bounceThreshold: number

  private readonly pool: Constraint[] = []
  private count = 0
  private readonly listeners = new Set<(contact: ContactEvent) => void>()
  private touches = new Map<number, Touch>()
  private touching = new Set<number>()
  private planeIds = 0
  private h = 1 / 60
  private readonly event: ContactEvent = { a: null as unknown as Body, b: null as unknown as Body, impulse: 0, speed: 0, point: vec3(), normal: vec3(), began: false }

  constructor(options: PhysicsOptions = {}) {
    this.gravity = options.gravity ?? vec3()
    this.substeps = options.substeps ?? 2
    this.iterations = options.iterations ?? 8
    this.slop = options.slop ?? 0.01
    this.correction = options.correction ?? 0.2
    this.maxCorrection = options.maxCorrection ?? Infinity
    this.bounceThreshold = options.bounceThreshold ?? 1
  }

  add<T = unknown>(options: BodyOptions<T>): Body<T> {
    const body = new Body(options)
    this.bodies.push(body)
    return body
  }

  remove(body: Body<any>): void {
    const i = this.bodies.indexOf(body)
    if (i >= 0) this.bodies.splice(i, 1)
  }

  addPlane<T = unknown>(normal: Vec3, offset: number, options: Partial<Omit<Plane<T>, 'id' | 'normal' | 'offset'>> = {}): Plane<T> {
    const n = vec3()
    const l = Math.hypot(normal.x, normal.y, normal.z) || 1
    scale(n, normal, 1 / l)
    const plane: Plane<T> = {
      id: ++this.planeIds,
      normal: n,
      offset,
      restitution: options.restitution ?? 0.3,
      friction: options.friction ?? 0.4,
      group: options.group ?? 1,
      mask: options.mask ?? 0xffffffff,
      enabled: options.enabled ?? true,
      userData: options.userData as T,
    }
    this.planes.push(plane)
    return plane
  }

  removePlane(plane: Plane<any>): void {
    const i = this.planes.indexOf(plane)
    if (i >= 0) this.planes.splice(i, 1)
  }

  /** Called after each step for every pair in contact. Returns an unsubscribe function. */
  onContact(listener: (contact: ContactEvent) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Advances by `dt` seconds in `substeps` equal steps. `forces(h)` runs
   * before each of them: apply forces that depend on where bodies are
   * (springs, fields) there; forces applied outside last one substep.
   */
  step(dt: number, forces?: (h: number) => void): void {
    if (!(dt > 0)) return
    const steps = Math.max(1, Math.round(this.substeps))
    const h = (this.h = dt / steps)
    this.touches.clear()
    for (let s = 0; s < steps; s++) {
      forces?.(h)
      for (const body of this.bodies) {
        if (!body.enabled) continue
        body.update()
        if (body.dynamic) {
          addScaled(body.velocity, body.velocity, this.gravity, h)
          addScaled(body.velocity, body.velocity, body.force, h * body.invMass)
          addScaled(body.angularVelocity, body.angularVelocity, mulMat3(T1, body.invInertiaWorld, body.torque), h)
          if (body.linearDamping > 0) scale(body.velocity, body.velocity, Math.exp(-body.linearDamping * h))
          if (body.angularDamping > 0) scale(body.angularVelocity, body.angularVelocity, Math.exp(-body.angularDamping * h))
        }
        set(body.force, 0, 0, 0)
        set(body.torque, 0, 0, 0)
      }
      this.collide()
      for (let it = 0; it < this.iterations; it++) for (let i = 0; i < this.count; i++) this.solve(this.pool[i]!)
      this.gather()
      for (const body of this.bodies) {
        if (!body.enabled || !body.dynamic) continue
        addScaled(body.position, body.position, body.velocity, h)
        integrateQuat(body.quaternion, body.angularVelocity, h)
      }
    }
    this.emit()
  }

  private collide(): void {
    this.count = 0
    const bodies = this.bodies
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i]!
      if (!a.enabled) continue
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j]!
        if (!b.enabled || (!a.dynamic && !b.dynamic)) continue
        if (!(a.group & b.mask) || !(b.group & a.mask)) continue
        if (a.max.x < b.min.x || b.max.x < a.min.x || a.max.y < b.min.y || b.max.y < a.min.y || a.max.z < b.min.z || b.max.z < a.min.z) continue
        const emit: Emit = (p, n, d) => this.addConstraint(a, b, null, p, n, d)
        for (const ba of a.boxes) {
          for (const bb of b.boxes) boxBox(ba, bb, emit)
          for (const sb of b.spheres) boxSphere(ba, sb, emit)
        }
        for (const sa of a.spheres) {
          for (const bb of b.boxes) boxSphere(bb, sa, emit, true)
          for (const sb of b.spheres) sphereSphere(sa, sb, emit)
        }
      }
    }
    for (const plane of this.planes) {
      if (!plane.enabled) continue
      const n = plane.normal
      for (const b of bodies) {
        if (!b.enabled || !b.dynamic || !(plane.group & b.mask) || !(b.group & plane.mask)) continue
        // The bounds' lowest corner along the normal.
        const low = (n.x > 0 ? b.min.x : b.max.x) * n.x + (n.y > 0 ? b.min.y : b.max.y) * n.y + (n.z > 0 ? b.min.z : b.max.z) * n.z
        if (low > plane.offset) continue
        const emit: Emit = (p, nn, d) => this.addConstraint(null, b, plane, p, nn, d)
        for (const box of b.boxes) planeBox(n, plane.offset, box, emit)
        for (const sphere of b.spheres) planeSphere(n, plane.offset, sphere, emit)
      }
    }
  }

  private addConstraint(a: Body | null, b: Body, plane: Plane | null, point: Vec3, normal: Vec3, depth: number): void {
    let c = this.pool[this.count]
    if (!c) {
      c = { a, b, plane, key: 0, point: vec3(), normal: vec3(), rA: vec3(), rB: vec3(), t1: vec3(), t2: vec3(), depth: 0, massN: 0, massT1: 0, massT2: 0, target: 0, bias: 0, friction: 0, jn: 0, jt1: 0, jt2: 0, approach: 0 }
      this.pool.push(c)
    }
    this.count++
    c.a = a
    c.b = b
    c.plane = plane
    c.key = a ? a.id * 1048576 + b.id : -(plane!.id * 1048576 + b.id)
    copy(c.point, point)
    copy(c.normal, normal)
    if (a) sub(c.rA, point, a.position)
    else set(c.rA, 0, 0, 0)
    sub(c.rB, point, b.position)
    tangents(c.normal, c.t1, c.t2)
    c.depth = depth
    c.massN = this.effectiveMass(c, c.normal)
    c.massT1 = this.effectiveMass(c, c.t1)
    c.massT2 = this.effectiveMass(c, c.t2)
    const vn = dot(this.relativeVelocity(c), c.normal)
    c.approach = Math.max(0, -vn)
    const restitution = Math.max(a ? a.restitution : plane!.restitution, b.restitution)
    c.target = vn < -this.bounceThreshold ? -restitution * vn : 0
    c.bias = Math.min(this.maxCorrection, (this.correction / this.h) * Math.max(0, depth - this.slop))
    c.friction = Math.sqrt(Math.max(0, (a ? a.friction : plane!.friction) * b.friction))
    c.jn = c.jt1 = c.jt2 = 0
  }

  private effectiveMass(c: Constraint, dir: Vec3): number {
    let k = c.b.invMass
    cross(T2, c.rB, dir)
    k += dot(T2, mulMat3(T3, c.b.invInertiaWorld, T2))
    if (c.a) {
      k += c.a.invMass
      cross(T2, c.rA, dir)
      k += dot(T2, mulMat3(T3, c.a.invInertiaWorld, T2))
    }
    return k > 1e-12 ? 1 / k : 0
  }

  /** Velocity of b's contact point relative to a's. */
  private relativeVelocity(c: Constraint): Vec3 {
    cross(V, c.b.angularVelocity, c.rB)
    addScaled(V, V, c.b.velocity, 1)
    if (c.a) {
      cross(T1, c.a.angularVelocity, c.rA)
      addScaled(T1, T1, c.a.velocity, 1)
      sub(V, V, T1)
    }
    return V
  }

  private applyImpulse(c: Constraint, dir: Vec3, j: number): void {
    const b = c.b
    if (b.invMass > 0) {
      addScaled(b.velocity, b.velocity, dir, j * b.invMass)
      cross(T2, c.rB, dir)
      addScaled(b.angularVelocity, b.angularVelocity, mulMat3(T3, b.invInertiaWorld, T2), j)
    }
    const a = c.a
    if (a && a.invMass > 0) {
      addScaled(a.velocity, a.velocity, dir, -j * a.invMass)
      cross(T2, c.rA, dir)
      addScaled(a.angularVelocity, a.angularVelocity, mulMat3(T3, a.invInertiaWorld, T2), -j)
    }
  }

  private solve(c: Constraint): void {
    if (c.friction > 0 && c.jn > 0) {
      const limit = c.friction * c.jn
      let old = c.jt1
      c.jt1 = Math.max(-limit, Math.min(limit, old - c.massT1 * dot(this.relativeVelocity(c), c.t1)))
      this.applyImpulse(c, c.t1, c.jt1 - old)
      old = c.jt2
      c.jt2 = Math.max(-limit, Math.min(limit, old - c.massT2 * dot(this.relativeVelocity(c), c.t2)))
      this.applyImpulse(c, c.t2, c.jt2 - old)
    }
    const vn = dot(this.relativeVelocity(c), c.normal)
    const old = c.jn
    c.jn = Math.max(0, old + c.massN * (Math.max(c.target, c.bias) - vn))
    this.applyImpulse(c, c.normal, c.jn - old)
  }

  /** Sums each pair's impulses over the step and keeps its deepest point. */
  private gather(): void {
    for (let i = 0; i < this.count; i++) {
      const c = this.pool[i]!
      let touch = this.touches.get(c.key)
      if (!touch) {
        touch = { a: c.a ?? c.plane!, b: c.b, impulse: 0, speed: 0, depth: -Infinity, point: vec3(), normal: vec3() }
        this.touches.set(c.key, touch)
      }
      touch.impulse += c.jn
      touch.speed = Math.max(touch.speed, c.approach)
      if (c.depth > touch.depth) {
        touch.depth = c.depth
        copy(touch.point, c.point)
        copy(touch.normal, c.normal)
      }
    }
  }

  private emit(): void {
    const touching = new Set<number>()
    const e = this.event
    for (const [key, touch] of this.touches) {
      touching.add(key)
      if (this.listeners.size === 0) continue
      e.a = touch.a
      e.b = touch.b
      e.impulse = touch.impulse
      e.speed = touch.speed
      copy(e.point, touch.point)
      copy(e.normal, touch.normal)
      e.began = !this.touching.has(key)
      for (const listener of this.listeners) listener(e)
    }
    this.touching = touching
  }
}
