import { describe, expect, it } from 'vitest'
import { Profile } from '../src/three/profile'

describe('Profile', () => {
  const cylinder = new Profile(
    [
      [0, 0],
      [1, 0],
      [1, 2],
      [0, 2],
    ],
    { samples: 1 },
  )

  it('reads the radius off the first rising span', () => {
    const cone = new Profile(
      [
        [2, 0],
        [1, 1],
      ],
      { samples: 1 },
    )
    expect(cone.radiusAt(0.5)).toBeCloseTo(1.5)
    expect(cone.slopeAt(0.5)).toBeCloseTo(-1)
    expect(cone.radiusAt(3)).toBe(0)
    expect(cylinder.radiusAt(1)).toBe(1)
  })

  it('smooths through the measured points and keeps corners sharp', () => {
    const measured: Array<[number, number]> = [
      [0, 0],
      [0.9, 0],
      [1, 0.4],
      [0.8, 1],
      [0.5, 1.5],
    ]
    const smooth = new Profile(measured, { samples: 8, corners: [1] })
    for (const [r, h] of measured) {
      expect(smooth.points.some((p) => Math.abs(p.x - r) < 1e-9 && Math.abs(p.y - h) < 1e-9)).toBe(true)
    }
    expect(smooth.points.length).toBeGreaterThan(measured.length * 4)
    // The base edge stays a corner: the bottom face stays flat up to it.
    const bottom = smooth.points.filter((p) => p.x <= 0.9)
    expect(bottom.filter((p) => p.y === 0).length).toBeGreaterThanOrEqual(2)
  })

  it('measures volume (a cylinder of radius 1 and height 2 holds 2π)', () => {
    expect(cylinder.volume()).toBeCloseTo(Math.PI * 2, 6)
    expect(cylinder.volume(0.5, 1.5)).toBeCloseTo(Math.PI, 6)
  })

  it('offsets inward along the normal and clips to a closed solid', () => {
    const wall = cylinder.offset(0.1)
    expect(wall.radiusAt(1)).toBeCloseTo(0.9, 6)
    const liquid = wall.clip(0.2, 1.6)
    expect(liquid.points[0]!.x).toBe(0)
    expect(liquid.points.at(-1)!.x).toBe(0)
    expect(liquid.volume()).toBeCloseTo(Math.PI * 0.81 * 1.4, 4)
  })

  it('builds label bands whose artwork keeps its proportions on a cone', () => {
    const cone = new Profile(
      [
        [0.2, 0],
        [0.1, 1],
      ],
      { samples: 1 },
    )
    const band = cone.band({ from: 0, to: 1, arc: Math.PI / 2, segments: [16, 8] })
    // Artwork size: arc length at the widest row × outline length.
    expect(band.width).toBeCloseTo((Math.PI / 2) * 0.2, 6)
    expect(band.height).toBeCloseTo(Math.hypot(0.1, 1), 6)
    // Edges follow the cut: half as wide where the radius halves.
    expect(band.halfWidthAt(0)).toBeCloseTo(0.5, 6)
    expect(band.halfWidthAt(1)).toBeCloseTo(0.25, 6)
    const uv = band.geometry.attributes.uv!
    let minU = Infinity
    let maxU = -Infinity
    let maxV = -Infinity
    for (let i = 0; i < uv.count; i++) {
      minU = Math.min(minU, uv.getX(i))
      maxU = Math.max(maxU, uv.getX(i))
      maxV = Math.max(maxV, uv.getY(i))
    }
    expect(minU).toBeCloseTo(0, 6)
    expect(maxU).toBeCloseTo(1, 6)
    expect(maxV).toBeCloseTo(1, 6)
    expect(band.geometry.index!.count).toBe(16 * 8 * 6)
  })
})
