import { describe, expect, it } from 'vitest'
import { bakeOcclusion, bakeSunlight, erodedNoise, heightfield, heightfieldMesh, ridgedNoise, valueNoiseD } from '../src/core/terrain'

describe('terrain', () => {
  it('samples a height function on a grid and interpolates between samples', () => {
    const f = heightfield({ size: [10, 10], resolution: 11, height: (x, z) => x * 2 + z })
    expect(f.sample(0, 0)).toBeCloseTo(0)
    expect(f.sample(3, -2)).toBeCloseTo(4)
    expect(f.sample(2.5, 1.5)).toBeCloseTo(6.5) // between samples, exact for a plane
    expect(f.min).toBeCloseTo(-15)
    expect(f.max).toBeCloseTo(15)
    const n = f.normal(0, 0)
    // Plane y = 2x + z: normal ∝ (-2, 1, -1).
    expect(n[0] / n[1]).toBeCloseTo(-2, 4)
    expect(n[2] / n[1]).toBeCloseTo(-1, 4)
  })

  it('accepts precomputed heights (from a worker)', () => {
    const a = heightfield({ size: [8, 8], resolution: 9, height: (x, z) => Math.sin(x) + z })
    const b = heightfield({ size: [8, 8], resolution: 9, heights: a.heights.slice() })
    expect(b.sample(1.3, -2.2)).toBeCloseTo(a.sample(1.3, -2.2))
    expect(() => heightfield({ size: [8, 8], resolution: 9, heights: new Float32Array(3) })).toThrow()
  })

  it('has value noise derivatives that match finite differences', () => {
    const [, dx, dz] = valueNoiseD(3.37, -1.81, 4)
    const e = 1e-5
    const fx = (valueNoiseD(3.37 + e, -1.81, 4)[0] - valueNoiseD(3.37 - e, -1.81, 4)[0]) / (2 * e)
    const fz = (valueNoiseD(3.37, -1.81 + e, 4)[0] - valueNoiseD(3.37, -1.81 - e, 4)[0]) / (2 * e)
    expect(dx).toBeCloseTo(fx, 4)
    expect(dz).toBeCloseTo(fz, 4)
  })

  it('makes deterministic, bounded mountain noise', () => {
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < 500; i++) {
      const x = (i % 25) * 0.37
      const z = Math.floor(i / 25) * 0.41
      const e = erodedNoise(x, z, { seed: 2 })
      const r = ridgedNoise(x, z, { seed: 2 })
      expect(erodedNoise(x, z, { seed: 2 })).toBe(e)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(1)
      min = Math.min(min, e)
      max = Math.max(max, e)
    }
    expect(min).toBeGreaterThanOrEqual(0)
    expect(max).toBeLessThanOrEqual(1)
    expect(max - min).toBeGreaterThan(0.2)
    expect(erodedNoise(1.1, 2.2, { seed: 1 })).not.toBe(erodedNoise(1.1, 2.2, { seed: 2 }))
  })

  it('bakes sunlight: a wall casts a shadow as long as the sun is low', () => {
    // A 10-unit wall along x = 0; the sun at 45° in the +x direction casts a
    // shadow 10 units long behind it.
    const f = heightfield({ size: [40, 40], resolution: 81, height: (x) => (Math.abs(x) < 1 ? 10 : 0) })
    const sun = bakeSunlight(f, [1, 1, 0])
    const at = (x: number, z: number) => f.bilinear(sun, x, z)
    expect(at(6, 0)).toBeGreaterThan(0.95) // in front of the wall, facing the sun
    expect(at(-6, 0)).toBeLessThan(0.05) // in its shadow
    expect(at(-16, 0)).toBeGreaterThan(0.95) // beyond the shadow's reach
    // A lower sun reaches further.
    const low = bakeSunlight(f, [1, 0.3, 0])
    expect(f.bilinear(low, -16, 0)).toBeLessThan(0.05)
  })

  it('bakes occlusion: a pit sees less sky than a summit', () => {
    const f = heightfield({ size: [20, 20], resolution: 41, height: (x, z) => -6 * Math.exp(-(x * x + z * z) / 8) })
    const ao = bakeOcclusion(f, { radius: 6 })
    const pit = f.bilinear(ao, 0, 0)
    const flat = f.bilinear(ao, 9, 9)
    expect(pit).toBeLessThan(flat)
    expect(flat).toBeGreaterThan(0.9)
  })

  it('builds mesh arrays with resampled attributes', () => {
    const f = heightfield({ size: [10, 10], resolution: 11, height: (x) => x })
    const data = new Float32Array(f.heights.length).map((_, i) => i)
    const mesh = heightfieldMesh(f, { segments: [4, 3], attributes: { aData: data } })
    expect(mesh.positions.length).toBe(5 * 4 * 3)
    expect(mesh.indices.length).toBe(4 * 3 * 6)
    expect(Math.max(...mesh.indices)).toBe(5 * 4 - 1)
    expect(mesh.attributes.aData!.length).toBe(20)
    // Height follows the field at each vertex.
    expect(mesh.positions[1]).toBeCloseTo(mesh.positions[0]!)
    // Faces point up.
    const [a, b, c] = [mesh.indices[0]!, mesh.indices[1]!, mesh.indices[2]!]
    const p = (i: number) => [mesh.positions[i * 3]!, mesh.positions[i * 3 + 1]!, mesh.positions[i * 3 + 2]!]
    const [pa, pb, pc] = [p(a), p(b), p(c)]
    const u = [pb[0]! - pa[0]!, pb[1]! - pa[1]!, pb[2]! - pa[2]!]
    const v = [pc[0]! - pa[0]!, pc[1]! - pa[1]!, pc[2]! - pa[2]!]
    expect(u[2]! * v[0]! - u[0]! * v[2]!).toBeGreaterThan(0)
  })
})
