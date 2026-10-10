import { describe, expect, it } from 'vitest'
import { Decay, projectDecay } from '../src/motion/decay'
import { stagger } from '../src/motion/stagger'
import { composeTransform } from '../src/motion/style'

describe('Decay', () => {
  it('coasts to the projected resting place', () => {
    const d = new Decay(0, { timeConstant: 0.3 })
    d.start(10, 1000)
    expect(d.target).toBeCloseTo(310)
    expect(projectDecay(10, 1000, 0.3)).toBeCloseTo(310)
    for (let i = 0; i < 400; i++) d.step(1 / 60)
    expect(d.settled).toBe(true)
    expect(d.value).toBeGreaterThan(305)
    expect(d.value).toBeLessThanOrEqual(310)
  })

  it('is exact for any step size', () => {
    const a = new Decay(0).start(0, 800)
    const b = new Decay(0).start(0, 800)
    a.step(0.1)
    b.step(0.05)
    b.step(0.05)
    expect(a.value).toBeCloseTo(b.value, 9)
    expect(a.velocity).toBeCloseTo(b.velocity, 9)
  })

  it('stops on demand', () => {
    const d = new Decay(5).start(5, 300)
    d.stop()
    expect(d.step(0.1)).toBe(5)
  })
})

describe('stagger', () => {
  it('runs from the start by default', () => {
    const s = stagger(0.1)
    expect([0, 1, 2, 3].map((i) => s(i, 4))).toEqual([0, 0.1, 0.2, expect.closeTo(0.3)])
  })

  it('radiates from the center, the edges, the end or an index', () => {
    const center = stagger(1, { from: 'center' })
    expect([0, 1, 2, 3, 4].map((i) => center(i, 5))).toEqual([2, 1, 0, 1, 2])
    const edges = stagger(1, { from: 'edges' })
    expect([0, 1, 2, 3, 4].map((i) => edges(i, 5))).toEqual([0, 1, 2, 1, 0])
    const end = stagger(1, { from: 'end' })
    expect([0, 1, 2].map((i) => end(i, 3))).toEqual([2, 1, 0])
    const fromTwo = stagger(1, { from: 1 })
    expect([0, 1, 2, 3].map((i) => fromTwo(i, 4))).toEqual([1, 0, 1, 2])
  })

  it('spreads over a total and shapes with an ease', () => {
    const total = stagger(0, { total: 1 })
    expect(total(4, 5)).toBe(1)
    expect(total(2, 5)).toBe(0.5)
    const eased = stagger(0, { total: 1, ease: 'quadIn' })
    expect(eased(2, 5)).toBe(0.25)
  })

  it('travels across a grid, mirrored for right-to-left', () => {
    const grid = stagger(1, { grid: [2, 3] })
    expect(grid(0, 6)).toBe(0)
    expect(grid(2, 6)).toBe(2)
    expect(grid(5, 6)).toBeCloseTo(Math.hypot(1, 2))
    const rtl = stagger(1, { grid: [2, 3], rtl: true })
    expect(rtl(2, 6)).toBe(0)
    expect(rtl(0, 6)).toBe(2)
    const rows = stagger(1, { grid: [2, 3], axis: 'y' })
    expect([0, 1, 2, 3].map((i) => rows(i, 6))).toEqual([0, 0, 0, 1])
  })

  it('gives every target a distinct rank when random', () => {
    const r = stagger(1, { from: 'random', seed: 4 })
    const delays = Array.from({ length: 8 }, (_, i) => r(i, 8))
    expect(new Set(delays).size).toBe(8)
    expect(Math.max(...delays)).toBe(7)
    expect(stagger(1, { from: 'random', seed: 4 })(3, 8)).toBe(delays[3])
  })
})

describe('transform perspective', () => {
  it('prefixes perspective() when set', () => {
    const base = { x: 0, y: 0, z: 0, rotate: 0, rotateX: 10, rotateY: 0, scale: 1, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, transformPerspective: 800 }
    expect(composeTransform(base)).toBe('perspective(800px) rotateX(10deg)')
    expect(composeTransform({ ...base, rotateX: 0, transformPerspective: 0 })).toBe('none')
  })
})
