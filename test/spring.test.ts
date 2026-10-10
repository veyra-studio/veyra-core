import { describe, expect, it } from 'vitest'
import { Spring, springs } from '../src/motion/spring'

function settle(s: Spring, dt: number, maxSteps = 10000) {
  let steps = 0
  while (!s.settled && steps < maxSteps) {
    s.step(dt)
    steps++
  }
  return steps
}

describe('Spring', () => {
  it('reaches its target for every preset', () => {
    for (const [name, cfg] of Object.entries(springs)) {
      const s = new Spring(0, cfg)
      s.target = 100
      settle(s, 1 / 60)
      expect(s.value, name).toBe(100)
      expect(s.velocity, name).toBe(0)
    }
  })

  it('is exact regardless of step size (analytic solution)', () => {
    const a = new Spring(0, springs.bouncy)
    const b = new Spring(0, springs.bouncy)
    a.target = b.target = 1
    a.step(0.1)
    for (let i = 0; i < 10; i++) b.step(0.01)
    expect(a.value).toBeCloseTo(b.value, 9)
    expect(a.velocity).toBeCloseTo(b.velocity, 9)
  })

  it('overshoots when under-damped and not when over-damped', () => {
    const bouncy = new Spring(0, { stiffness: 300, damping: 8 })
    bouncy.target = 1
    let max = 0
    for (let i = 0; i < 300; i++) max = Math.max(max, bouncy.step(1 / 120))
    expect(max).toBeGreaterThan(1.1)

    const heavy = new Spring(0, { stiffness: 50, damping: 60 })
    heavy.target = 1
    let maxH = 0
    for (let i = 0; i < 2000; i++) maxH = Math.max(maxH, heavy.step(1 / 60))
    expect(maxH).toBeLessThanOrEqual(1 + 1e-9)
  })

  it('handles near-critical damping without blowing up', () => {
    const s = new Spring(0, { stiffness: 100, damping: 20.00001, mass: 1 })
    s.target = 10
    for (let i = 0; i < 120; i++) {
      const v = s.step(1 / 60)
      expect(Number.isFinite(v)).toBe(true)
    }
    expect(s.value).toBeCloseTo(10, 2)
  })

  it('stays stable with huge time steps', () => {
    const s = new Spring(0, springs.snappy)
    s.target = 1
    s.step(5)
    expect(s.value).toBeCloseTo(1, 6)
  })

  it('supports impulses and snapping', () => {
    const s = new Spring(0)
    s.impulse(50)
    s.step(1 / 60)
    expect(s.value).toBeGreaterThan(0)
    s.snap(3)
    expect(s.value).toBe(3)
    expect(s.settled).toBe(true)
  })
})
