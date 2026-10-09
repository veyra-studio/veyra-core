import { describe, expect, it } from 'vitest'
import { cubicBezier, ease, resolveEase } from '../src/core/ease'

describe('ease', () => {
  it('all built-in eases start at 0 and end at 1', () => {
    for (const [name, fn] of Object.entries(ease)) {
      expect(fn(0), name).toBeCloseTo(0, 6)
      expect(fn(1), name).toBeCloseTo(1, 6)
    }
  })

  it('cubicBezier matches CSS keywords', () => {
    const easeCss = cubicBezier(0.25, 0.1, 0.25, 1)
    // Reference values for CSS `ease`.
    expect(easeCss(0.5)).toBeCloseTo(0.8024, 3)
    const linear = cubicBezier(0, 0, 1, 1)
    for (const t of [0.1, 0.33, 0.77]) expect(linear(t)).toBeCloseTo(t, 5)
  })

  it('is monotonic for standard curves', () => {
    const fn = ease.glide
    let prev = -1
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const v = fn(Math.min(1, t))
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = v
    }
  })

  it('resolves names and rejects unknown ones', () => {
    expect(resolveEase('linear')(0.3)).toBe(0.3)
    expect(() => resolveEase('nope' as never)).toThrow()
  })
})
