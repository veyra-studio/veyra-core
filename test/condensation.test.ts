import { describe, expect, it } from 'vitest'
import { condensationField } from '../src/three/condensation'

describe('condensation', () => {
  it('is deterministic per seed and bounded', () => {
    const a = condensationField({ size: 64, seed: 3 })
    const b = condensationField({ size: 64, seed: 3 })
    const c = condensationField({ size: 64, seed: 4 })
    expect(Array.from(a.height)).toEqual(Array.from(b.height))
    expect(Array.from(a.height)).not.toEqual(Array.from(c.height))
    for (const v of a.height) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('has drops, mist between them, and dry rings around the drops', () => {
    const f = condensationField({ size: 256, seed: 5, mist: 0.7 })
    const drops = Array.from(f.height).filter((h) => h > 0.5).length
    expect(drops).toBeGreaterThan(f.size * f.size * 0.005)
    expect(Math.max(...f.mist)).toBeCloseTo(0.7, 6)
    // Where a drop sits the glass is clear of mist.
    let checked = 0
    for (let i = 0; i < f.height.length; i++) {
      if (f.height[i]! > 0.6) {
        expect(f.mist[i]!).toBe(0)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('wipes clear tracks where drops have run', () => {
    const withRuns = condensationField({ size: 128, seed: 9, runs: 1 })
    const without = condensationField({ size: 128, seed: 9, runs: 0 })
    const clear = (f: { mist: Float32Array }) => Array.from(f.mist).filter((m) => m === 0).length
    expect(clear(withRuns)).toBeGreaterThan(clear(without))
  })
})
