import { afterEach, describe, expect, it, vi } from 'vitest'
import { Ticker } from '../src/core/ticker'
import { cursor } from '../src/interaction/cursor'
import { draggable } from '../src/interaction/drag'
import { magnetic } from '../src/interaction/magnetic'
import { tilt } from '../src/interaction/tilt'
import { createStage } from '../src/stage'

const manualTicker = () => new Ticker({ autoPause: false, requestFrame: () => 0, cancelFrame: () => {} })
const clock = { t: 0 }
function run(ticker: Ticker, seconds: number) {
  for (let i = 0, n = Math.round(seconds * 60); i <= n; i++) ticker.tick((clock.t += 1000 / 60))
}
const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} }) as DOMRect
const pointer = (type: string, init: PointerEventInit) => new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, ...init })
const newStage = () => {
  const ticker = manualTicker()
  return { ticker, stage: createStage({ ticker, scroll: false, quality: false, autoStart: false }) }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('draggable', () => {
  it('follows the pointer past a threshold and rubber-bands beyond the bounds', () => {
    const { ticker, stage } = newStage()
    const el = document.createElement('div')
    document.body.append(el)
    const d = stage.use(draggable(el, { bounds: { minX: -300, maxX: 0 } }))
    expect(el.style.touchAction).toBe('pan-y')
    el.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 0 }))
    el.dispatchEvent(pointer('pointermove', { clientX: 98, clientY: 0 }))
    expect(d.dragging).toBe(false)
    el.dispatchEvent(pointer('pointermove', { clientX: 60, clientY: 0 }))
    expect(d.dragging).toBe(true)
    run(ticker, 0.02)
    expect(d.x).toBe(-40)
    expect(el.style.transform).toBe('translate3d(-40px, 0px, 0px)')
    // Past maxX the element resists: well under the 100px the pointer moved.
    el.dispatchEvent(pointer('pointermove', { clientX: 200, clientY: 0 }))
    expect(d.x).toBeGreaterThan(0)
    expect(d.x).toBeLessThan(60)
    stage.destroy()
  })

  it('springs to the nearest snap point after release and swallows the click', () => {
    const { ticker, stage } = newStage()
    const el = document.createElement('div')
    document.body.append(el)
    const rested = vi.fn()
    const d = stage.use(draggable(el, { snap: [0, -150, -300], onRest: rested }))
    el.dispatchEvent(pointer('pointerdown', { clientX: 300 }))
    el.dispatchEvent(pointer('pointermove', { clientX: 200 }))
    el.dispatchEvent(pointer('pointerup', { clientX: 200 }))
    expect(d.moving).toBe(true)
    run(ticker, 2)
    expect(d.x).toBe(-150)
    expect(d.moving).toBe(false)
    expect(rested).toHaveBeenCalledTimes(1)
    const clicked = vi.fn()
    el.addEventListener('click', clicked)
    el.click()
    expect(clicked).not.toHaveBeenCalled()
    stage.destroy()
  })

  it('steps between snap points from the keyboard', () => {
    const { ticker, stage } = newStage()
    const el = document.createElement('div')
    el.tabIndex = 0
    document.body.append(el)
    const d = stage.use(draggable(el, { snap: [0, -150, -300], keyboard: 'content' }))
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    run(ticker, 2)
    expect(d.x).toBe(-150)
    stage.destroy()
  })

  it('steps to the next resting place in the arrow direction, within bounds', () => {
    const { ticker, stage } = newStage()
    const el = document.createElement('div')
    document.body.append(el)
    // A carousel parked at its end bound, between two snap points.
    const d = stage.use(draggable(el, { snap: [0, -320, -640, -960], bounds: { minX: -720, maxX: 0 } }))
    d.setPosition(-720, 0, { animate: false })
    d.step(1)
    run(ticker, 2)
    expect(d.x).toBe(-640)
    d.step(-1)
    run(ticker, 2)
    expect(d.x).toBe(-720)
    d.step(-1)
    run(ticker, 2)
    expect(d.x).toBe(-720)
    stage.destroy()
  })

  it('lands on the resting place directly under reduced motion', () => {
    const { stage } = newStage()
    stage.reducedMotion.set(true)
    const el = document.createElement('div')
    document.body.append(el)
    const d = stage.use(draggable(el, { snap: 100 }))
    el.dispatchEvent(pointer('pointerdown', { clientX: 0 }))
    el.dispatchEvent(pointer('pointermove', { clientX: 70 }))
    el.dispatchEvent(pointer('pointerup', { clientX: 70 }))
    expect(d.x).toBe(100)
    expect(d.moving).toBe(false)
    stage.destroy()
  })
})

describe('magnetic', () => {
  it('leans toward a nearby pointer and settles back', () => {
    const { ticker, stage } = newStage()
    const el = document.createElement('button')
    document.body.append(el)
    el.getBoundingClientRect = () => rect(100, 100, 100, 40)
    const m = stage.use(magnetic(el, { strength: 0.5 }))
    Object.assign(stage.pointer!, { x: 170, y: 130, inside: true, type: 'mouse' })
    run(ticker, 2)
    expect(m.active).toBe(true)
    // Offset from the center (150, 120) × 0.5.
    expect(el.style.transform).toBe('translate3d(10px, 5px, 0px)')
    Object.assign(stage.pointer!, { x: 900, y: 700 })
    run(ticker, 3)
    expect(m.active).toBe(false)
    expect(el.style.transform).toBe('none')
    stage.destroy()
  })
})

describe('tilt', () => {
  it('leans toward the pointer while hovered, then returns to no transform', () => {
    const { ticker, stage } = newStage()
    const el = document.createElement('div')
    document.body.append(el)
    el.getBoundingClientRect = () => rect(0, 0, 200, 100)
    stage.use(tilt(el, { max: 10 }))
    el.dispatchEvent(pointer('pointerenter', { clientX: 200, clientY: 50 }))
    run(ticker, 2)
    expect(el.style.transform).toBe('perspective(900px) rotateY(10deg)')
    el.dispatchEvent(pointer('pointerleave', { clientX: 300, clientY: 50 }))
    run(ticker, 3)
    expect(el.style.transform).toBe('none')
    stage.destroy()
  })
})

describe('cursor', () => {
  it('follows the pointer and labels interactive targets', () => {
    const { ticker, stage } = newStage()
    const link = document.createElement('a')
    link.setAttribute('data-cursor', 'ببین')
    document.body.append(link)
    const c = stage.use(cursor({ smoothing: 0 }))
    expect(document.querySelector('.veyra-cursor')).toBe(c.el)
    Object.assign(stage.pointer!, { x: 40, y: 60, inside: true, type: 'mouse' })
    run(ticker, 0.05)
    expect(c.el.style.transform).toBe('translate3d(40px, 60px, 0px)')
    link.dispatchEvent(pointer('pointerover', {}))
    expect(c.label).toBe('ببین')
    expect(c.el.classList.contains('is-active')).toBe(true)
    expect(c.el.getAttribute('data-cursor-state')).toBe('ببین')
    expect(c.el.textContent).toBe('ببین')
    stage.destroy()
    expect(document.querySelector('.veyra-cursor')).toBeNull()
  })
})
