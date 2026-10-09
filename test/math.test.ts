import { describe, expect, it } from 'vitest'
import { clamp, damp, invLerp, lerp, lerpToLambda, mapRange, range, seededRandom, smoothstep, wrap } from '../src/core/math'

describe('math', () => {
  it('clamps, lerps and inverts', () => {
    expect(clamp(2)).toBe(1)
    expect(clamp(-1, -0.5, 0.5)).toBe(-0.5)
    expect(lerp(10, 20, 0.25)).toBe(12.5)
    expect(invLerp(10, 20, 15)).toBe(0.5)
    expect(invLerp(5, 5, 4)).toBe(0)
    expect(invLerp(5, 5, 6)).toBe(1)
  })

  it('maps ranges with optional clamping', () => {
    expect(mapRange(5, 0, 10, 100, 200)).toBe(150)
    expect(mapRange(20, 0, 10, 100, 200)).toBe(300)
    expect(mapRange(20, 0, 10, 100, 200, true)).toBe(200)
  })

  it('computes sub-progress windows for choreography', () => {
    expect(range(0.1, 0.2, 0.4)).toBe(0)
    expect(range(0.3, 0.2, 0.4)).toBeCloseTo(0.5)
    expect(range(0.9, 0.2, 0.4)).toBe(1)
  })

  it('smoothsteps', () => {
    expect(smoothstep(0, 1, 0.5)).toBe(0.5)
    expect(smoothstep(0, 1, -1)).toBe(0)
  })

  it('damps independently of frame rate', () => {
    // One 1/30 s step must land where two 1/60 s steps land.
    const a = damp(0, 100, 8, 1 / 30)
    const b = damp(damp(0, 100, 8, 1 / 60), 100, 8, 1 / 60)
    expect(a).toBeCloseTo(b, 10)
    // A 60 fps lerp factor converts to the equivalent lambda.
    expect(damp(0, 1, lerpToLambda(0.1), 1 / 60)).toBeCloseTo(0.1, 10)
  })

  it('wraps and seeds', () => {
    expect(wrap(370, 0, 360)).toBe(10)
    expect(wrap(-10, 0, 360)).toBe(350)
    const r1 = seededRandom(42)
    const r2 = seededRandom(42)
    expect(r1()).toBe(r2())
  })
})
