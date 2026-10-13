import { afterEach, describe, expect, it, vi } from 'vitest'
import { Ticker } from '../src/core/ticker'
import { holdable } from '../src/interaction/hold'
import { createStage } from '../src/stage'

const clock = { t: 0 }
const newStage = () => {
  const ticker = new Ticker({ autoPause: false, requestFrame: () => 0, cancelFrame: () => {} })
  return { ticker, stage: createStage({ ticker, scroll: false, quality: false, autoStart: false }) }
}
const frames = (ticker: Ticker, n: number) => {
  for (let i = 0; i < n; i++) ticker.tick((clock.t += 1000 / 60))
}
const pointer = (type: string, init: PointerEventInit = {}) => new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, ...init })
const key = (type: string, k: string, init: KeyboardEventInit = {}) => new KeyboardEvent(type, { bubbles: true, cancelable: true, key: k, ...init })

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('holdable', () => {
  it('holds while a pointer is down, every frame, and reports how long', () => {
    const { ticker, stage } = newStage()
    const el = document.createElement('button')
    document.body.append(el)
    const started = vi.fn()
    const ended = vi.fn()
    let held = 0
    const hold = stage.use(holdable(el, { onStart: started, onHold: (_h, dt) => (held += dt), onEnd: ended }))
    frames(ticker, 2)
    el.dispatchEvent(pointer('pointerdown'))
    expect(started).toHaveBeenCalledOnce()
    expect(hold.held).toBe(true)
    expect(hold.source).toBe('pointer')
    expect(el.dataset.held).toBe('')
    frames(ticker, 30)
    expect(held).toBeCloseTo(0.5, 1)
    expect(hold.duration).toBeCloseTo(held, 6)
    // Another pointer lifting doesn't count.
    el.dispatchEvent(pointer('pointerup', { pointerId: 9 }))
    expect(hold.held).toBe(true)
    el.dispatchEvent(pointer('pointerup'))
    expect(ended).toHaveBeenCalledOnce()
    expect(hold.held).toBe(false)
    expect(hold.duration).toBeCloseTo(0.5, 1)
    expect('held' in el.dataset).toBe(false)
    frames(ticker, 10)
    expect(held).toBeCloseTo(0.5, 1)
    stage.destroy()
  })

  it('holds with Space or Enter, without scrolling the page or repeating', () => {
    const { ticker, stage } = newStage()
    const el = document.createElement('button')
    document.body.append(el)
    const started = vi.fn()
    const hold = stage.use(holdable(el, { onStart: started }))
    const down = key('keydown', ' ')
    el.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(true)
    el.dispatchEvent(key('keydown', ' ', { repeat: true }))
    expect(started).toHaveBeenCalledOnce()
    expect(hold.source).toBe('key')
    frames(ticker, 6)
    el.dispatchEvent(key('keyup', ' '))
    expect(hold.held).toBe(false)
    // Other keys are left alone.
    const other = key('keydown', 'a')
    el.dispatchEvent(other)
    expect(other.defaultPrevented).toBe(false)
    expect(hold.held).toBe(false)
    stage.destroy()
  })

  it('ends a hold when focus leaves or it is disabled, and ignores input while disabled', () => {
    const { stage } = newStage()
    const el = document.createElement('button')
    document.body.append(el)
    const ended = vi.fn()
    const hold = stage.use(holdable(el, { onEnd: ended }))
    el.dispatchEvent(key('keydown', 'Enter'))
    el.dispatchEvent(new FocusEvent('blur'))
    expect(ended).toHaveBeenCalledOnce()
    el.dispatchEvent(pointer('pointerdown'))
    hold.disable()
    expect(ended).toHaveBeenCalledTimes(2)
    el.dispatchEvent(pointer('pointerdown'))
    expect(hold.held).toBe(false)
    hold.enable()
    el.dispatchEvent(pointer('pointerdown'))
    expect(hold.held).toBe(true)
    // A long press doesn't open the context menu.
    const menu = new Event('contextmenu', { cancelable: true })
    el.dispatchEvent(menu)
    expect(menu.defaultPrevented).toBe(true)
    stage.destroy()
    expect(hold.held).toBe(false)
  })
})
