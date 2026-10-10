import { afterEach, describe, expect, it, vi } from 'vitest'
import { Ticker } from '../src/core/ticker'
import { flip } from '../src/motion/flip'
import { createStage } from '../src/stage'
import { horizontal } from '../src/scroll/horizontal'
import { marquee } from '../src/effects/marquee'

const manualTicker = () => new Ticker({ autoPause: false, requestFrame: () => 0, cancelFrame: () => {} })

/** Advances a manual ticker by `seconds` at 60 fps. */
function run(ticker: Ticker, seconds: number, from = { t: 0 }) {
  const frames = Math.round(seconds * 60)
  for (let i = 0; i <= frames; i++) ticker.tick((from.t += 1000 / 60))
}

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} }) as DOMRect

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('flip', () => {
  it('starts from the old box and animates to the new one', () => {
    const ticker = manualTicker()
    const el = document.createElement('div')
    document.body.append(el)
    let box = rect(0, 0, 100, 50)
    el.getBoundingClientRect = () => box
    const tl = flip(el, () => (box = rect(200, 100, 100, 50)), { ticker, duration: 0.5, ease: 'linear' })
    expect(el.style.transform).toBe('translate3d(-200px, -100px, 0px)')
    run(ticker, 0.25)
    expect(el.style.transform).toMatch(/^translate3d\(-1\d\dpx, -\d\dpx, 0px\)$/)
    run(ticker, 0.5, { t: 1000 })
    expect(el.style.transform).toBe('none')
    expect(tl.playing).toBe(false)
  })

  it('inverts size changes around the transform origin', () => {
    const ticker = manualTicker()
    const el = document.createElement('div')
    document.body.append(el)
    let box = rect(0, 0, 200, 100)
    el.getBoundingClientRect = () => box
    flip(el, () => (box = rect(0, 0, 100, 50)), { ticker })
    // Scaled ×2 about the center (50, 25), shifted by (50, 25), the new box covers the old one.
    expect(el.style.transform).toBe('translate3d(50px, 25px, 0px) scale(2, 2)')
  })

  it('fades in elements that had no box before and can skip animation', () => {
    const ticker = manualTicker()
    const el = document.createElement('div')
    document.body.append(el)
    let box = rect(0, 0, 0, 0)
    el.getBoundingClientRect = () => box
    flip(el, () => (box = rect(10, 10, 80, 40)), { ticker })
    expect(el.style.opacity).toBe('0')
    const still = document.createElement('div')
    document.body.append(still)
    let b2 = rect(0, 0, 50, 50)
    still.getBoundingClientRect = () => b2
    flip(still, () => (b2 = rect(300, 0, 50, 50)), { ticker, immediate: true })
    expect(still.style.transform).toBe('none')
  })
})

/** Builds a horizontal section with mocked geometry. */
function section(dir: 'ltr' | 'rtl') {
  const el = document.createElement('section')
  el.innerHTML = '<div class="pin"><div class="track"><article></article><article></article><article></article></div></div>'
  const pin = el.querySelector<HTMLElement>('.pin')!
  const track = el.querySelector<HTMLElement>('.track')!
  if (dir === 'rtl') track.setAttribute('dir', 'rtl')
  document.body.append(el)
  Object.defineProperty(pin, 'clientWidth', { value: 1000 })
  Object.defineProperty(pin, 'offsetHeight', { value: window.innerHeight })
  Object.defineProperty(track, 'scrollWidth', { value: 3000 })
  track.getBoundingClientRect = () => (dir === 'rtl' ? rect(-2000, 0, 3000, 768) : rect(0, 0, 3000, 768))
  track.querySelectorAll('article').forEach((panel, i) => {
    panel.getBoundingClientRect = () => (dir === 'rtl' ? rect(1000 - (i + 1) * 1000, 0, 1000, 768) : rect(i * 1000, 0, 1000, 768))
  })
  // The section sits 500px down the page; its height is whatever the plugin set.
  el.getBoundingClientRect = () => rect(0, 500 - window.scrollY, 1000, Number.parseFloat(el.style.height) || 0)
  return { el, track }
}

const scrollTo = (y: number) => Object.defineProperty(window, 'scrollY', { value: y, configurable: true })

describe('horizontal', () => {
  afterEach(() => scrollTo(0))

  it('sizes the section and moves the row against the reading direction', () => {
    const ticker = manualTicker()
    const stage = createStage({ ticker, scroll: false, quality: false, autoStart: false })
    const { el, track } = section('ltr')
    const panels: number[] = []
    const h = stage.use(horizontal(el, { onPanel: (i) => panels.push(i) }))
    expect(el.style.height).toBe(`${window.innerHeight + 2000}px`)
    expect(h.distance).toBe(2000)
    stage.refresh(true)
    scrollTo(500 + 1000)
    run(ticker, 0.05)
    expect(h.progress).toBeCloseTo(0.5)
    expect(track.style.transform).toBe('translate3d(-1000px, 0px, 0px)')
    expect(h.active).toBe(1)
    expect(h.panelProgress(1)).toBeCloseTo(0.5)
    expect(h.panels[1]!.style.getPropertyValue('--panel-progress')).toBe('0.5')
    expect(panels.at(-1)).toBe(1)
    stage.destroy()
    expect(track.style.transform).toBe('none')
    expect(el.style.height).toBe('')
  })

  it('travels rightward in a right-to-left section', () => {
    const ticker = manualTicker()
    const stage = createStage({ ticker, scroll: false, quality: false, autoStart: false })
    const { el, track } = section('rtl')
    const h = stage.use(horizontal(el))
    expect(h.direction).toBe('rtl')
    stage.refresh(true)
    scrollTo(500 + 2000)
    run(ticker, 0.05)
    expect(h.progress).toBe(1)
    expect(track.style.transform).toBe('translate3d(2000px, 0px, 0px)')
    expect(h.active).toBe(2)
    stage.destroy()
  })
})

describe('horizontal with a header in the pin', () => {
  afterEach(() => scrollTo(0))

  it('moves the widest child, not the first one', () => {
    const ticker = manualTicker()
    const stage = createStage({ ticker, scroll: false, quality: false, autoStart: false })
    const { el, track } = section('ltr')
    const pin = track.parentElement!
    const head = document.createElement('header')
    head.getBoundingClientRect = () => rect(0, 0, 1000, 60)
    pin.prepend(head)
    const h = stage.use(horizontal(el))
    stage.refresh(true)
    scrollTo(500 + 1000)
    run(ticker, 0.05)
    expect(h.distance).toBe(2000)
    expect(track.style.transform).toBe('translate3d(-1000px, 0px, 0px)')
    expect(head.style.transform).toBe('')
    stage.destroy()
  })
})

describe('marquee', () => {
  const setup = (dir: 'ltr' | 'rtl') => {
    const el = document.createElement('div')
    el.innerHTML = '<span>Veyra · ویرا ·</span>'
    if (dir === 'rtl') el.setAttribute('dir', 'rtl')
    document.body.append(el)
    Object.defineProperty(el, 'clientWidth', { value: 500 })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.style.flexShrink === '0' ? rect(0, 0, 200, 40) : rect(0, 0, 500, 40)
    })
    return el
  }

  it('fills the band with inert copies and runs leftward in English', () => {
    const ticker = manualTicker()
    const stage = createStage({ ticker, scroll: false, quality: false, autoStart: false })
    const el = setup('ltr')
    const m = stage.use(marquee(el, { speed: 100 }))
    const track = el.querySelector<HTMLElement>('[data-veyra-marquee-track]')!
    expect(track.children.length).toBe(4)
    const copy = track.children[1] as HTMLElement
    expect(copy.getAttribute('aria-hidden')).toBe('true')
    expect(copy.inert).toBe(true)
    run(ticker, 1)
    expect(m.offset).toBeLessThan(0)
    expect(m.offset).toBeGreaterThanOrEqual(-200)
    expect(track.style.transform).toMatch(/^translate3d\(-/)
    stage.destroy()
    expect(el.innerHTML).toBe('<span>Veyra · ویرا ·</span>')
  })

  it('runs rightward in Persian and stays still under reduced motion', () => {
    const ticker = manualTicker()
    const stage = createStage({ ticker, scroll: false, quality: false, autoStart: false })
    const el = setup('rtl')
    const m = stage.use(marquee(el, { speed: 100 }))
    run(ticker, 1)
    expect(m.offset).toBeGreaterThan(0)
    expect(m.offset).toBeLessThan(200)
    stage.reducedMotion.set(true)
    run(ticker, 0.1, { t: 5000 })
    expect(m.offset).toBe(0)
    stage.destroy()
  })
})
