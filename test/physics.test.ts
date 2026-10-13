import { afterEach, describe, expect, it, vi } from 'vitest'
import { Ticker } from '../src/core/ticker'
import { boxBox, type WorldBox } from '../src/physics/collide'
import { domColliders } from '../src/physics/dom'
import { quat, vec3, type Quat, type Vec3 } from '../src/physics/math'
import { PhysicsWorld, type Body, type ContactEvent } from '../src/physics/world'
import { createStage } from '../src/stage'

const run = (world: PhysicsWorld, seconds: number, forces?: (h: number) => void) => {
  for (let i = 0, n = Math.round(seconds * 60); i < n; i++) world.step(1 / 60, forces)
}
const axisAngle = (x: number, y: number, z: number, angle: number): Quat => {
  const l = Math.hypot(x, y, z)
  const s = Math.sin(angle / 2) / l
  return quat(x * s, y * s, z * s, Math.cos(angle / 2))
}
const box = (half: Vec3, options: Partial<Parameters<PhysicsWorld['add']>[0]> = {}) => ({ shape: { type: 'box' as const, half }, ...options })
const sphere = (radius: number, options: Partial<Parameters<PhysicsWorld['add']>[0]> = {}) => ({ shape: { type: 'sphere' as const, radius }, ...options })
const momentum = (bodies: Body[]) => bodies.reduce((p, b) => ({ x: p.x + b.velocity.x * b.mass, y: p.y + b.velocity.y * b.mass, z: p.z + b.velocity.z * b.mass }), vec3())
/** Deepest overlap between two box bodies (0 when apart). */
const overlap = (a: Body, b: Body) => {
  let depth = 0
  a.update()
  b.update()
  boxBox(a.boxes[0] as WorldBox, b.boxes[0] as WorldBox, (_p, _n, d) => (depth = Math.max(depth, d)))
  return depth
}

describe('PhysicsWorld', () => {
  it('turns bodies by their angular velocity', () => {
    const world = new PhysicsWorld({ substeps: 4 })
    const b = world.add(box(vec3(1, 1, 1), { angularVelocity: vec3(0, 0, Math.PI) }))
    run(world, 1)
    // Half a turn about z.
    expect(Math.abs(b.quaternion.z)).toBeCloseTo(1, 2)
    expect(Math.abs(b.quaternion.w)).toBeLessThan(0.02)
  })

  it('swaps the velocities of equal spheres meeting head on, keeping momentum', () => {
    const world = new PhysicsWorld({ substeps: 4 })
    const a = world.add(sphere(1, { position: vec3(-3, 0, 0), velocity: vec3(4, 0, 0), restitution: 1, friction: 0 }))
    const b = world.add(sphere(1, { position: vec3(3, 0, 0), restitution: 1, friction: 0 }))
    run(world, 2)
    expect(a.velocity.x).toBeCloseTo(0, 1)
    expect(b.velocity.x).toBeCloseTo(4, 1)
    expect(momentum([a, b]).x).toBeCloseTo(4, 5)
  })

  it('lets a box fall on the floor and come to rest flat, without sinking', () => {
    const world = new PhysicsWorld({ gravity: vec3(0, -9.8, 0), substeps: 4 })
    world.addPlane(vec3(0, 1, 0), 0)
    const b = world.add(box(vec3(0.5, 0.25, 0.5), { position: vec3(0, 2, 0), restitution: 0.2 }))
    run(world, 4)
    expect(b.position.y).toBeGreaterThan(0.25 - 0.03)
    expect(b.position.y).toBeLessThan(0.25 + 0.01)
    expect(Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z)).toBeLessThan(0.05)
    expect(Math.hypot(b.angularVelocity.x, b.angularVelocity.y, b.angularVelocity.z)).toBeLessThan(0.05)
    expect(Math.abs(b.quaternion.w)).toBeGreaterThan(0.999)
  })

  it('separates boxes that meet face to face and keeps their momentum', () => {
    const world = new PhysicsWorld({ substeps: 4 })
    const a = world.add(box(vec3(1, 1, 1), { position: vec3(-3, 0, 0), velocity: vec3(5, 0, 0), restitution: 0.5, friction: 0 }))
    const b = world.add(box(vec3(1, 1, 1), { position: vec3(3, 0, 0), restitution: 0.5, friction: 0 }))
    run(world, 2)
    expect(b.velocity.x).toBeGreaterThan(a.velocity.x)
    expect(b.position.x - a.position.x).toBeGreaterThan(2 - 0.02)
    expect(momentum([a, b]).x).toBeCloseTo(5, 4)
    // Square on: no spin.
    expect(Math.hypot(b.angularVelocity.x, b.angularVelocity.y, b.angularVelocity.z)).toBeLessThan(1e-6)
  })

  it('sets a box spinning when it is hit off center by a corner', () => {
    const world = new PhysicsWorld({ substeps: 4 })
    world.add(box(vec3(1, 1, 1), { position: vec3(-4, 0.8, 0), quaternion: axisAngle(0, 0, 1, Math.PI / 4), velocity: vec3(6, 0, 0) }))
    const b = world.add(box(vec3(1, 1, 1), { position: vec3(0, 0, 0) }))
    run(world, 1.5)
    expect(b.velocity.x).toBeGreaterThan(0.5)
    expect(Math.abs(b.angularVelocity.z)).toBeGreaterThan(0.05)
  })

  it('pushes apart a crowd of thin, overlapping packets and keeps them apart', () => {
    // Weightless square packets (54 × 54 × 3), turned every which way, thrown together.
    const world = new PhysicsWorld({ substeps: 3, slop: 0.2 })
    let seed = 3
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
    const packets: Body[] = []
    for (let i = 0; i < 14; i++) {
      packets.push(
        world.add(
          box(vec3(27, 27, 1.5), {
            position: vec3(rand() * 40, rand() * 40, rand() * 40),
            quaternion: axisAngle(rand(), rand(), rand(), rand() * Math.PI),
            linearDamping: 1.5,
            angularDamping: 1.5,
            restitution: 0.3,
          }),
        ),
      )
    }
    let worst = 0
    for (let i = 0; i < packets.length; i++) for (let j = i + 1; j < packets.length; j++) worst = Math.max(worst, overlap(packets[i]!, packets[j]!))
    expect(worst).toBeGreaterThan(5)
    // Each one is drawn back to the middle all the while: they must still not sink into each other.
    run(world, 6, () => {
      for (const p of packets) p.applyForce(vec3(-p.position.x * 2, -p.position.y * 2, -p.position.z * 2))
    })
    worst = 0
    for (let i = 0; i < packets.length; i++) for (let j = i + 1; j < packets.length; j++) worst = Math.max(worst, overlap(packets[i]!, packets[j]!))
    expect(worst).toBeLessThan(0.5)
    for (const p of packets) expect(Number.isFinite(p.position.x + p.quaternion.w)).toBe(true)
  })

  it('rests a sphere on a static box and bounces one off a wall', () => {
    const world = new PhysicsWorld({ gravity: vec3(0, -9.8, 0), substeps: 4 })
    world.add(box(vec3(2, 0.5, 2), { kind: 'static' }))
    const ball = world.add(sphere(0.5, { position: vec3(0.3, 3, 0), restitution: 0 }))
    run(world, 3)
    expect(ball.position.y).toBeCloseTo(1, 1)
    const wall = new PhysicsWorld({ substeps: 4 })
    wall.addPlane(vec3(-1, 0, 0), -5, { restitution: 1 })
    const thrown = wall.add(sphere(0.5, { velocity: vec3(3, 0, 0), restitution: 1, friction: 0 }))
    run(wall, 3)
    expect(thrown.velocity.x).toBeCloseTo(-3, 1)
    expect(thrown.position.x).toBeLessThan(4.5)
  })

  it('lets a kinematic body push without being pushed', () => {
    const world = new PhysicsWorld({ substeps: 4 })
    const paddle = world.add(box(vec3(0.5, 2, 2), { kind: 'kinematic', position: vec3(-2, 0, 0), velocity: vec3(3, 0, 0) }))
    const ball = world.add(sphere(0.5, { position: vec3(0, 0, 0), restitution: 0.5 }))
    for (let i = 0; i < 60; i++) {
      paddle.position.x += 3 / 60
      world.step(1 / 60)
    }
    expect(ball.velocity.x).toBeGreaterThan(3)
    expect(paddle.velocity.x).toBe(3)
    expect(paddle.position.x).toBeCloseTo(1, 5)
  })

  it('reports contacts: how hard, how fast, and when a touch begins', () => {
    const world = new PhysicsWorld({ substeps: 2 })
    // A tenth apart, closing at 12 per second: they meet in the second step.
    const a = world.add(sphere(1, { position: vec3(-1.05, 0, 0), velocity: vec3(6, 0, 0), restitution: 0 }))
    const b = world.add(sphere(1, { position: vec3(1.05, 0, 0), velocity: vec3(-6, 0, 0), restitution: 0 }))
    const events: ContactEvent[] = []
    world.onContact((e) => events.push({ ...e, point: { ...e.point }, normal: { ...e.normal } }))
    world.step(1 / 60)
    expect(events).toHaveLength(0)
    for (let i = 0; i < 3; i++) world.step(1 / 60)
    expect(events.length).toBeGreaterThan(1)
    const first = events[0]!
    expect(first.began).toBe(true)
    expect(first.a).toBe(a)
    expect(first.b).toBe(b)
    expect(first.impulse).toBeGreaterThan(5)
    expect(first.speed).toBeGreaterThan(11)
    expect(first.normal.x).toBeCloseTo(1, 5)
    expect(events.slice(1).every((e) => !e.began)).toBe(true)
  })

  it('filters collisions by group and mask', () => {
    const world = new PhysicsWorld({ substeps: 2 })
    const a = world.add(sphere(1, { position: vec3(-2, 0, 0), velocity: vec3(4, 0, 0), group: 2, mask: 1 }))
    world.add(sphere(1, { position: vec3(2, 0, 0), group: 2, mask: 1 }))
    run(world, 1.5)
    expect(a.velocity.x).toBe(4)
  })

  it('keeps inertia in step with a shape that grows', () => {
    const world = new PhysicsWorld()
    const shape = { type: 'box' as const, half: vec3(0.01, 0.01, 0.01) }
    const b = world.add({ shape })
    shape.half.x = shape.half.y = shape.half.z = 1
    b.applyImpulse(vec3(0, 1, 0), vec3(1, 0, 0))
    // A unit cube of mass 1: I = 2/3, so a unit off-center blow spins it at 1.5 rad/s.
    expect(b.angularVelocity.z).toBeCloseTo(1.5, 5)
  })
})

describe('domColliders', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('places page elements as boxes in a pixel-camera world and moves them with the scroll', () => {
    const ticker = new Ticker({ autoPause: false, requestFrame: () => 0, cancelFrame: () => {} })
    const stage = createStage({ ticker, scroll: false, quality: false, autoStart: false })
    const el = document.createElement('h2')
    document.body.append(el)
    let scroll = 0
    vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scroll)
    vi.spyOn(el, 'getBoundingClientRect').mockImplementation(() => ({ left: 100, top: 300 - scroll, width: 400, height: 80, right: 500, bottom: 380 - scroll, x: 100, y: 300 - scroll, toJSON() {} }) as DOMRect)
    const world = new PhysicsWorld()
    const walls = stage.use(domColliders(world, el, { size: () => ({ width: 1000, height: 800 }), depth: 200 }))
    const b = walls.bodies[0]!
    expect(b.kind).toBe('kinematic')
    expect(b.userData).toBe(el)
    // Center (300, 340) in the viewport → (-200, 60) from the middle, y up.
    expect(b.position.x).toBe(-200)
    expect(b.position.y).toBe(60)
    expect(b.shapes[0]).toMatchObject({ half: { x: 200, y: 40, z: 100 } })
    scroll = 100
    walls.update(0.1)
    expect(b.position.y).toBe(160)
    expect(b.velocity.y).toBeCloseTo(1000, 5)
    walls.destroy()
    expect(world.bodies).toHaveLength(0)
    stage.destroy()
  })
})
