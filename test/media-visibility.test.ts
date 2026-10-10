import { afterEach, describe, expect, it, vi } from 'vitest'
import { Ticker } from '../src/core/ticker'
import { whenVisible } from '../src/env/visibility'
import { imageSequence, nearestLoaded, progressiveOrder } from '../src/media/sequence'
import { createStage } from '../src/stage'

const manualTicker = () => new Ticker({ autoPause: false, requestFrame: () => 0, cancelFrame: () => {} })

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('image sequence helpers', () => {
  it('orders loads coarse-to-fine and covers every frame once', () => {
    const order = progressiveOrder(120)
    expect(order.slice(0, 4)).toEqual([0, 119, 8, 16])
    expect(order).toHaveLength(120)
    expect(new Set(order).size).toBe(120)
    expect(progressiveOrder(1)).toEqual([0])
    expect(progressiveOrder(5, 2)).toEqual([0, 4, 2, 1, 3])
  })

  it('finds the nearest loaded frame', () => {
    const loaded = [0, 1, 0, 0, 0, 1, 0]
    expect(nearestLoaded(1, loaded)).toBe(1)
    expect(nearestLoaded(3, loaded)).toBe(1)
    expect(nearestLoaded(4, loaded)).toBe(5)
    expect(nearestLoaded(6, loaded)).toBe(5)
    expect(nearestLoaded(2, [0, 0, 0])).toBe(-1)
  })

  it('creates a scrubbable sequence on a canvas', () => {
    const stage = createStage({ ticker: manualTicker(), scroll: false, quality: false, autoStart: false })
    const canvas = document.createElement('canvas')
    document.body.append(canvas)
    const seq = stage.use(imageSequence(canvas, { count: 10, src: (i) => `frame-${i}.webp` }))
    seq.progress = 2
    expect(seq.progress).toBe(1)
    expect(seq.frame).toBe(-1)
    expect(seq.scene).toBeNull()
    stage.destroy()
  })
})

describe('whenVisible', () => {
  it('runs immediately without IntersectionObserver', () => {
    const el = document.createElement('div')
    const exit = vi.fn()
    const enter = vi.fn(() => exit)
    const stop = whenVisible(el, enter)
    expect(enter).toHaveBeenCalledTimes(1)
    stop()
    expect(exit).toHaveBeenCalledTimes(1)
  })

  it('enters and leaves with an observer', () => {
    let notify: (entries: Array<{ isIntersecting: boolean }>) => void = () => {}
    const disconnect = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: typeof notify) {
          notify = cb
        }
        observe() {}
        disconnect = disconnect
      },
    )
    const el = document.createElement('div')
    const exit = vi.fn()
    const enter = vi.fn(() => exit)
    const stop = whenVisible(el, enter, { once: false })
    notify([{ isIntersecting: false }])
    expect(enter).not.toHaveBeenCalled()
    notify([{ isIntersecting: true }])
    notify([{ isIntersecting: true }])
    expect(enter).toHaveBeenCalledTimes(1)
    notify([{ isIntersecting: false }])
    expect(exit).toHaveBeenCalledTimes(1)
    stop()
    expect(disconnect).toHaveBeenCalled()

    const once = vi.fn()
    whenVisible(el, once)
    notify([{ isIntersecting: true }])
    expect(once).toHaveBeenCalledTimes(1)
  })
})

describe('stage.media', () => {
  it('mirrors a media query and releases it with the stage', () => {
    const listeners = new Set<(e: { matches: boolean }) => void>()
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'),
      addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.delete(fn),
    }))
    const stage = createStage({ ticker: manualTicker(), scroll: false, quality: false, autoStart: false })
    const before = listeners.size
    const narrow = stage.media('(max-width: 700px)')
    expect(narrow.value).toBe(true)
    expect(listeners.size).toBe(before + 1)
    for (const fn of [...listeners]) fn({ matches: false })
    expect(narrow.value).toBe(false)
    stage.destroy()
    expect(listeners.size).toBe(0)
  })
})
