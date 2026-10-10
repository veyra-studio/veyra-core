import { describe, expect, it } from 'vitest'
import { createNoise, fbm2, noise2, noise3 } from '../src/core/noise'

describe('noise', () => {
  it('is deterministic per seed and differs between seeds', () => {
    const a = createNoise(7)
    const b = createNoise(7)
    const c = createNoise(8)
    expect(a.noise2(1.3, 4.7)).toBe(b.noise2(1.3, 4.7))
    expect(a.noise3(1.3, 4.7, 0.2)).toBe(b.noise3(1.3, 4.7, 0.2))
    let differs = false
    for (let i = 0; i < 20; i++) if (a.noise2(i * 0.37 + 0.1, 2.2) !== c.noise2(i * 0.37 + 0.1, 2.2)) differs = true
    expect(differs).toBe(true)
  })

  it('is zero on the lattice, bounded and smooth', () => {
    expect(noise2(3, 7)).toBeCloseTo(0, 12)
    expect(noise3(-2, 5, 1)).toBeCloseTo(0, 12)
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < 4000; i++) {
      const x = (i % 63) * 0.173 - 5
      const y = Math.floor(i / 63) * 0.211 - 3
      const v = noise2(x, y)
      const w = noise3(x, y, i * 0.013)
      min = Math.min(min, v, w)
      max = Math.max(max, v, w)
      expect(Math.abs(noise2(x + 1e-4, y) - v)).toBeLessThan(2e-3)
    }
    expect(min).toBeGreaterThanOrEqual(-1)
    expect(max).toBeLessThanOrEqual(1)
    // It actually varies.
    expect(max - min).toBeGreaterThan(0.8)
  })

  it('layers octaves into fractal noise within [-1, 1]', () => {
    for (let i = 0; i < 200; i++) {
      const v = fbm2(i * 0.31, i * 0.17, { octaves: 5 })
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    }
    expect(fbm2(0.5, 0.5, { octaves: 1 })).toBeCloseTo(noise2(0.5, 0.5))
  })
})
