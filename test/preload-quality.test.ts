import { describe, expect, it, vi } from 'vitest'
import { Preloader } from '../src/assets/preload'
import { QualityGovernor } from '../src/quality/governor'

describe('Preloader', () => {
  it('tracks weighted progress and survives failures', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const p = new Preloader()
    let resolveA!: (v: string) => void
    const a = p.add(new Promise<string>((r) => (resolveA = r)), 3)
    const b = p.add(Promise.reject(new Error('missing')), 1)
    await b.catch(() => {})
    expect(p.progress.value).toBeCloseTo(0.25)
    resolveA('ok')
    expect(await a).toBe('ok')
    await p.done()
    expect(p.progress.value).toBe(1)
    expect(p.errors).toHaveLength(1)
    warn.mockRestore()
  })

  it('is complete when empty', async () => {
    const p = new Preloader()
    await p.done()
    expect(p.progress.value).toBe(1)
  })
})

describe('QualityGovernor', () => {
  it('detects refresh rate and steps down under load', () => {
    const q = new QualityGovernor({ initial: 1, window: 10 })
    for (let i = 0; i < 60; i++) q.sample(1 / 60)
    expect(q.refreshRate).toBe(60)
    for (let i = 0; i < 40; i++) q.sample(1 / 30)
    expect(q.level.value).toBeLessThan(1)
    expect(q.tier.value).not.toBe('low')
  })

  it('climbs back slowly with headroom', () => {
    const q = new QualityGovernor({ initial: 0.4, window: 10 })
    for (let i = 0; i < 60; i++) q.sample(1 / 120)
    for (let i = 0; i < 400; i++) q.sample(1 / 120)
    expect(q.level.value).toBeGreaterThan(0.4)
  })

  it('ignores an isolated stall but drops to the lowest level when frames stay far too slow', () => {
    const q = new QualityGovernor({ initial: 1, window: 10, min: 0.1 })
    for (let i = 0; i < 60; i++) q.sample(1 / 60)
    // A tab switch: one long frame, then normal frames again.
    q.sample(2)
    q.sample(1 / 60)
    q.sample(3)
    q.sample(1 / 60)
    expect(q.level.value).toBe(1)
    // A device rendering at a few frames per second (each frame > 250 ms).
    q.sample(0.6)
    q.sample(0.7)
    expect(q.level.value).toBe(1)
    q.sample(0.6)
    expect(q.level.value).toBe(0.1)
    expect(q.tier.value).toBe('low')
    // It can still climb back once frames are fast again.
    for (let i = 0; i < 2000; i++) q.sample(1 / 120)
    expect(q.level.value).toBeGreaterThan(0.1)
  })

  it('maps level to a capped pixel ratio', () => {
    const q = new QualityGovernor({ initial: 0, dprRange: [1, 2] })
    expect(q.dpr.value).toBe(1)
  })
})
