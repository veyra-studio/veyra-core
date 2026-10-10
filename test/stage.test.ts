import { describe, expect, it, vi } from 'vitest'
import { supportsWebGL2 } from '../src/env/capabilities'
import { Ticker } from '../src/core/ticker'
import { createStage } from '../src/stage'

const manualTicker = () => new Ticker({ autoPause: false, requestFrame: () => 0, cancelFrame: () => {} })

describe('createStage', () => {
  it('wires scenes to the frame loop and tears down cleanly', () => {
    const ticker = manualTicker()
    const stage = createStage({ ticker, scroll: false, quality: false, autoStart: false })
    const el = document.createElement('section')
    document.body.append(el)
    const onUpdate = vi.fn()
    const scene = stage.scene(el, { start: 'top bottom', end: 'bottom top', onUpdate, margin: 1e6 })
    expect(stage.scenes.size).toBe(1)
    ticker.tick(0)
    ticker.tick(16)
    expect(onUpdate).toHaveBeenCalled()
    scene.destroy()
    expect(stage.scenes.size).toBe(0)
    stage.destroy()
    expect(ticker.size).toBe(0)
    el.remove()
  })

  it('honours reduced motion in animate()', () => {
    const ticker = manualTicker()
    const stage = createStage({ ticker, scroll: false, quality: false, reducedMotion: true, autoStart: false })
    const o = { v: 0 }
    stage.animate(o, { v: 1 }, { duration: 5 })
    ticker.tick(0)
    ticker.tick(16)
    expect(o.v).toBe(1)
    expect(document.documentElement.hasAttribute('data-reduced-motion')).toBe(true)
    stage.destroy()
  })

  it('notifies refresh listeners and releases them with the stage', () => {
    const stage = createStage({ ticker: manualTicker(), scroll: false, quality: false, autoStart: false })
    const listener = vi.fn()
    const off = stage.onRefresh(listener)
    stage.refresh(true)
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    stage.refresh(true)
    expect(listener).toHaveBeenCalledTimes(1)
    stage.onRefresh(listener)
    stage.destroy()
    stage.refresh(true)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('runs plugins with cleanup', () => {
    const stage = createStage({ ticker: manualTicker(), scroll: false, quality: false, autoStart: false })
    const cleanup = vi.fn()
    const value = stage.use((s, onDestroy) => {
      onDestroy(cleanup)
      return s.viewport.w
    })
    expect(typeof value).toBe('number')
    stage.destroy()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})

describe('capabilities', () => {
  it('reports WebGL2 support as a cached boolean', () => {
    const first = supportsWebGL2()
    expect(typeof first).toBe('boolean')
    expect(supportsWebGL2()).toBe(first)
  })
})
