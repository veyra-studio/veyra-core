import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { glslNoiseTexture } from '../src/glsl/index'
import { noiseTexture, tilingNoise } from '../src/three/noise'

const at = (data: Float32Array, size: number, c: number, x: number, y: number) => data[(((y + size) % size) * size + ((x + size) % size)) * 4 + c]!

describe('tiling noise', () => {
  it('is deterministic per seed, and both noise layers stay in [-1, 1]', () => {
    const a = tilingNoise({ size: 64, cells: 4, seed: 2 })
    const b = tilingNoise({ size: 64, cells: 4, seed: 2 })
    const c = tilingNoise({ size: 64, cells: 4, seed: 3 })
    expect(Array.from(a.data)).toEqual(Array.from(b.data))
    expect(Array.from(a.data)).not.toEqual(Array.from(c.data))
    for (const layer of [0, 3]) {
      let min = Infinity
      let max = -Infinity
      for (let i = layer; i < a.data.length; i += 4) {
        min = Math.min(min, a.data[i]!)
        max = Math.max(max, a.data[i]!)
      }
      expect(min).toBeGreaterThanOrEqual(-1)
      expect(max).toBeLessThanOrEqual(1)
      expect(max - min).toBeGreaterThan(0.8)
    }
  })

  it('tiles seamlessly: across the edges it changes no faster than inside', () => {
    const { data, size } = tilingNoise({ size: 64, cells: 4, seed: 5 })
    for (const c of [0, 1, 2, 3]) {
      let inside = 0
      let across = 0
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size - 1; j++) {
          inside = Math.max(inside, Math.abs(at(data, size, c, j + 1, i) - at(data, size, c, j, i)))
          inside = Math.max(inside, Math.abs(at(data, size, c, i, j + 1) - at(data, size, c, i, j)))
        }
        across = Math.max(across, Math.abs(at(data, size, c, 0, i) - at(data, size, c, size - 1, i)))
        across = Math.max(across, Math.abs(at(data, size, c, i, 0) - at(data, size, c, i, size - 1)))
      }
      expect(across).toBeLessThanOrEqual(inside * 1.0001)
    }
  })

  it('stores the analytic gradient of the noise, per tile', () => {
    const { data, size } = tilingNoise({ size: 128, cells: 4, seed: 7 })
    // Central differences across one texel (1/size of a tile) agree with the stored derivatives.
    let err = 0
    let scale = 0
    for (let y = 0; y < size; y += 7) {
      for (let x = 0; x < size; x += 5) {
        const ddx = (at(data, size, 0, x + 1, y) - at(data, size, 0, x - 1, y)) * (size / 2)
        const ddy = (at(data, size, 0, x, y + 1) - at(data, size, 0, x, y - 1)) * (size / 2)
        err = Math.max(err, Math.abs(ddx - at(data, size, 1, x, y)), Math.abs(ddy - at(data, size, 2, x, y)))
        scale = Math.max(scale, Math.abs(at(data, size, 1, x, y)), Math.abs(at(data, size, 2, x, y)))
      }
    }
    expect(scale).toBeGreaterThan(1)
    expect(err).toBeLessThan(scale * 0.03)
  })

  it('has a second layer independent of the first', () => {
    const { data } = tilingNoise({ size: 64, cells: 8, seed: 9 })
    const n = data.length / 4
    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0
    for (let i = 0; i < n; i++) {
      const x = data[i * 4]!
      const y = data[i * 4 + 3]!
      sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y
    }
    const corr = (sab / n - (sa / n) * (sb / n)) / Math.sqrt((saa / n - (sa / n) ** 2) * (sbb / n - (sb / n) ** 2))
    expect(Math.abs(corr)).toBeLessThan(0.25)
  })

  it('rejects sizes that are not powers of two', () => {
    expect(() => tilingNoise({ size: 100 })).toThrow()
    expect(() => tilingNoise({ size: 64, cells: 0 })).toThrow()
  })
})

describe('noise texture', () => {
  it('is half float, repeating, with a full box-filtered mip chain', () => {
    const tex = noiseTexture({ size: 32, cells: 4, seed: 1 })
    expect(tex.type).toBe(THREE.HalfFloatType)
    expect(tex.wrapS).toBe(THREE.RepeatWrapping)
    expect(tex.wrapT).toBe(THREE.RepeatWrapping)
    expect(tex.generateMipmaps).toBe(false)
    expect(tex.userData.cells).toBe(4)
    expect(tex.mipmaps.map((m: { width: number }) => m.width)).toEqual([32, 16, 8, 4, 2, 1])
    const half = (m: { data: Uint16Array }, i: number) => THREE.DataUtils.fromHalfFloat(m.data[i]!)
    const [l0, l1] = tex.mipmaps as Array<{ data: Uint16Array; width: number }>
    // Level 1 averages 2×2 blocks of level 0 (to half-float precision).
    const avg = (half(l0!, 0) + half(l0!, 4) + half(l0!, 32 * 4) + half(l0!, 33 * 4)) / 4
    expect(half(l1!, 0)).toBeCloseTo(avg, 2)
    tex.dispose()
  })

  it('ships a GLSL reader with the 2D, gradient and triplanar forms', () => {
    expect(glslNoiseTexture).toContain('#ifndef VEYRA_NOISE_TEXTURE')
    expect(glslNoiseTexture).toMatch(/float tfbm\(sampler2D tex, float cells, vec2 p, int octaves\)/)
    expect(glslNoiseTexture).toMatch(/vec3 tfbmd\(sampler2D tex, float cells, vec2 p, int octaves\)/)
    expect(glslNoiseTexture).toMatch(/float tfbm\(sampler2D tex, float cells, vec3 p, vec3 n, int octaves\)/)
    expect(glslNoiseTexture).toMatch(/vec4 tfbmd\(sampler2D tex, float cells, vec3 p, vec3 n, int octaves\)/)
  })
})
