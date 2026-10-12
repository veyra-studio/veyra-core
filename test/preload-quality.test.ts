import { describe, expect, it, vi } from 'vitest'
import { Preloader } from '../src/assets/preload'
import { estimateQuality, QualityGovernor } from '../src/quality/governor'

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

  it('assumes at least 60 Hz: 30 fps on load means a struggling device, not a 30 Hz screen', () => {
    const q = new QualityGovernor({ initial: 0.85 })
    for (let i = 0; i < 60; i++) q.sample(1 / 30)
    expect(q.refreshRate).toBe(60)
    expect(q.level.value).toBeCloseTo(0.6)
    // Unless the floor is lowered for a project that knows better.
    const lenient = new QualityGovernor({ initial: 0.85, minRefreshRate: 30 })
    for (let i = 0; i < 60; i++) lenient.sample(1 / 30)
    expect(lenient.refreshRate).toBe(30)
    expect(lenient.level.value).toBe(0.85)
  })

  it('steps down after a single window when far too slow, further the slower', () => {
    const q = new QualityGovernor({ initial: 0.9, window: 10 })
    for (let i = 0; i < 60; i++) q.sample(1 / 60)
    for (let i = 0; i < 10; i++) q.sample(1 / 18)
    expect(q.level.value).toBeCloseTo(0.5)
    const mild = new QualityGovernor({ initial: 0.9, window: 10 })
    for (let i = 0; i < 60; i++) mild.sample(1 / 60)
    // 45 fps: below target, but not by much — two windows before a step.
    for (let i = 0; i < 10; i++) mild.sample(1 / 45)
    expect(mild.level.value).toBe(0.9)
    for (let i = 0; i < 10; i++) mild.sample(1 / 45)
    expect(mild.level.value).toBeCloseTo(0.7)
  })

  it('keeps the tier steady: a tier left for slow frames comes back once, after long headroom, then stays out of reach', () => {
    const q = new QualityGovernor({ initial: 0.8, window: 10, reentryWindows: 20 })
    for (let i = 0; i < 60; i++) q.sample(1 / 60)
    for (let i = 0; i < 10; i++) q.sample(1 / 25)
    expect(q.tier.value).toBe('medium')
    const dropped = q.level.value
    // Some headroom: it climbs within medium and waits at the fence.
    for (let i = 0; i < 400; i++) q.sample(1 / 120)
    expect(q.level.value).toBeGreaterThan(dropped)
    expect(q.tier.value).toBe('medium')
    // Steady headroom for long enough: it may return to high, once.
    for (let i = 0; i < 3000; i++) q.sample(1 / 120)
    expect(q.tier.value).toBe('high')
    // Pushed out of high a second time: high stays out of reach for the session.
    for (let i = 0; i < 200 && q.tier.value === 'high'; i++) q.sample(1 / 25)
    expect(q.tier.value).toBe('medium')
    for (let i = 0; i < 6000; i++) q.sample(1 / 120)
    expect(q.tier.value).toBe('medium')
    // An explicit setting may still raise it.
    q.set(0.9)
    expect(q.tier.value).toBe('high')
    // Without steadyTier it climbs back right away.
    const free = new QualityGovernor({ initial: 0.8, window: 10, steadyTier: false })
    for (let i = 0; i < 60; i++) free.sample(1 / 60)
    for (let i = 0; i < 10; i++) free.sample(1 / 25)
    for (let i = 0; i < 400; i++) free.sample(1 / 120)
    expect(free.tier.value).toBe('high')
  })

  it('judges a window by its typical frame: a few hitches are not a slow device', () => {
    const q = new QualityGovernor({ initial: 0.9 })
    for (let i = 0; i < 60; i++) q.sample(1 / 60)
    // A texture upload or a shader compiling: three 150 ms frames in each window of 30.
    for (let w = 0; w < 8; w++) for (let i = 0; i < 30; i++) q.sample(i % 10 === 4 ? 0.15 : 1 / 60)
    expect(q.level.value).toBeGreaterThanOrEqual(0.9)
    // Frames slow throughout still step it down.
    const before = q.level.value
    for (let i = 0; i < 150; i++) q.sample(1 / 40)
    expect(q.level.value).toBeLessThan(before)
  })

  it('holds judgement during heavy one-off work, stalls and warm-up included', async () => {
    const q = new QualityGovernor({ initial: 0.9, window: 10 })
    const release = q.hold()
    expect(q.held).toBe(true)
    // Building a world: slow frames and long stalls — none of it counts.
    for (let i = 0; i < 100; i++) q.sample(1 / 8)
    for (let i = 0; i < 5; i++) q.sample(0.6)
    expect(q.level.value).toBe(0.9)
    release()
    expect(q.held).toBe(false)
    // The warm-up runs on the frames after the work, and the device is fine.
    for (let i = 0; i < 300; i++) q.sample(1 / 60)
    expect(q.refreshRate).toBe(60)
    const level = q.level.value
    expect(level).toBeGreaterThanOrEqual(0.9)
    // A promise holds until it settles; a number holds for that many seconds of frames.
    let done!: () => void
    q.hold(new Promise<void>((r) => (done = r)))
    for (let i = 0; i < 40; i++) q.sample(1 / 10)
    expect(q.level.value).toBe(level)
    done()
    await Promise.resolve()
    expect(q.held).toBe(false)
    q.hold(0.5)
    for (let i = 0; i < 4; i++) q.sample(1 / 10)
    expect(q.held).toBe(true)
    q.sample(1 / 10)
    expect(q.held).toBe(false)
    expect(q.level.value).toBe(level)
    // Afterwards, slow frames are judged again.
    for (let i = 0; i < 80; i++) q.sample(1 / 10)
    expect(q.level.value).toBeLessThan(level)
  })

  it("doesn't trade quality for more than 60 fps on fast screens, unless asked", () => {
    const q = new QualityGovernor({ initial: 0.9, window: 10 })
    for (let i = 0; i < 60; i++) q.sample(1 / 120)
    expect(q.refreshRate).toBe(120)
    // 80 fps on a 120 Hz screen: smooth enough, keep the quality.
    for (let i = 0; i < 400; i++) q.sample(1 / 80)
    expect(q.level.value).toBeGreaterThanOrEqual(0.9)
    const fast = new QualityGovernor({ initial: 0.9, window: 10, maxTargetFps: 120 })
    for (let i = 0; i < 60; i++) fast.sample(1 / 120)
    for (let i = 0; i < 400; i++) fast.sample(1 / 80)
    expect(fast.level.value).toBeLessThan(0.9)
  })

  it('follows the device pixel ratio when it changes', () => {
    const ratio = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio')
    try {
      Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true })
      const q = new QualityGovernor({ initial: 1, adaptive: false, dprRange: [1, 2] })
      expect(q.dpr.value).toBe(1)
      // Moved to a denser screen.
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })
      q.syncDpr()
      expect(q.dpr.value).toBe(2)
    } finally {
      if (ratio) Object.defineProperty(window, 'devicePixelRatio', ratio)
      else delete (window as unknown as Record<string, unknown>).devicePixelRatio
    }
  })

  it("doesn't fence a tier over stalls: frames over 250 ms may be a one-off", () => {
    const q = new QualityGovernor({ initial: 0.8, window: 10 })
    for (let i = 0; i < 60; i++) q.sample(1 / 60)
    for (let i = 0; i < 3; i++) q.sample(0.4)
    expect(q.tier.value).toBe('low')
    for (let i = 0; i < 6000; i++) q.sample(1 / 120)
    expect(q.tier.value).toBe('high')
  })

  it('starts phones and tablets in the middle', () => {
    const matchMedia = window.matchMedia
    const nav = navigator as Navigator & { deviceMemory?: number }
    const cores = Object.getOwnPropertyDescriptor(Navigator.prototype, 'hardwareConcurrency')
    const coarse = (on: boolean) => (q: string) => ({ matches: on && q.includes('coarse') }) as MediaQueryList
    try {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true })
      window.matchMedia = coarse(true)
      expect(estimateQuality()).toBeCloseTo(0.55)
      Object.defineProperty(navigator, 'deviceMemory', { value: 2, configurable: true })
      expect(estimateQuality()).toBeCloseTo(0.25)
      window.matchMedia = coarse(false)
      Object.defineProperty(navigator, 'deviceMemory', { value: 8, configurable: true })
      expect(estimateQuality()).toBeCloseTo(0.85)
    } finally {
      window.matchMedia = matchMedia
      delete (navigator as unknown as Record<string, unknown>).hardwareConcurrency
      delete (nav as unknown as Record<string, unknown>).deviceMemory
      if (cores) Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', cores)
    }
  })

  it('maps level to a capped pixel ratio', () => {
    const q = new QualityGovernor({ initial: 0, dprRange: [1, 2] })
    expect(q.dpr.value).toBe(1)
  })
})
