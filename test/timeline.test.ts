import { describe, expect, it, vi } from 'vitest'
import { Ticker } from '../src/core/ticker'
import { Timeline } from '../src/motion/timeline'

const ticker = () => new Ticker({ autoPause: false, requestFrame: () => 0, cancelFrame: () => {} })

describe('Timeline', () => {
  it('sequences tweens and scrubs both ways', () => {
    const o = { x: 0 }
    const tl = new Timeline({ ticker: ticker() })
      .to(o, { x: 100 }, { duration: 1, ease: 'linear' })
      .to(o, { x: 200 }, { duration: 1, ease: 'linear' })
    expect(tl.duration).toBe(2)
    tl.progress = 0.25
    expect(o.x).toBeCloseTo(50)
    tl.progress = 0.75
    expect(o.x).toBeCloseTo(150)
    tl.progress = 0.25 // scrub back across the boundary
    expect(o.x).toBeCloseTo(50)
    tl.progress = 1
    expect(o.x).toBe(200)
    tl.progress = 0
    expect(o.x).toBe(0)
  })

  it('captures start values when first reached (chaining)', () => {
    const o = { x: 0 }
    const tl = new Timeline({ ticker: ticker() })
      .to(o, { x: 10 }, { duration: 1, ease: 'linear' })
      .to(o, { x: 20 }, { duration: 1, ease: 'linear' })
    tl.seek(1.5)
    expect(o.x).toBeCloseTo(15)
  })

  it('resolves positions', () => {
    const a = {}
    const tl = new Timeline({ ticker: ticker() })
      .to(a, {}, { duration: 1 })
      .label('mid')
      .to(a, {}, { duration: 1 }, '<0.5')
      .to(a, {}, { duration: 1 }, '+=1')
      .to(a, {}, { duration: 0.5 }, 'mid+=0.25')
    expect(tl.duration).toBe(3.5)
    expect(() => tl.to(a, {}, {}, 'nowhere')).toThrow()
  })

  it('fromTo applies the start state immediately', () => {
    const o = { opacity: 1 }
    new Timeline({ ticker: ticker() }).fromTo(o, { opacity: 0 }, { opacity: 1 }, { duration: 1 }, 2)
    expect(o.opacity).toBe(0)
  })

  it('staggers multiple targets', () => {
    const items = [{ y: 0 }, { y: 0 }, { y: 0 }]
    const tl = new Timeline({ ticker: ticker() }).to(items, { y: 10 }, { duration: 1, stagger: 0.5, ease: 'linear' })
    expect(tl.duration).toBe(2)
    tl.seek(1)
    expect(items.map((i) => i.y)).toEqual([10, 5, 0])
  })

  it('fires calls when the playhead crosses them, in both directions', () => {
    const fn = vi.fn()
    const tl = new Timeline({ ticker: ticker() }).to({}, {}, { duration: 2 }).call(fn, 1)
    tl.seek(0.5)
    tl.seek(1.5)
    tl.seek(0.2)
    expect(fn.mock.calls).toEqual([[1], [-1]])
  })

  it('plays on the ticker and resolves finished', async () => {
    const t = ticker()
    const o = { v: 0 }
    const done = vi.fn()
    const tl = new Timeline({ ticker: t, onComplete: done }).to(o, { v: 1 }, { duration: 0.1, ease: 'linear' })
    tl.play()
    t.tick(0)
    for (let i = 1; i <= 10; i++) t.tick(i * 16)
    await tl.finished
    expect(o.v).toBe(1)
    expect(done).toHaveBeenCalledTimes(1)
    expect(tl.playing).toBe(false)
  })

  it('drives function children and nested timelines', () => {
    const seen: number[] = []
    const inner = new Timeline({ ticker: ticker() }).add((p) => seen.push(p), 0, { duration: 1 })
    const outer = new Timeline({ ticker: ticker() }).add(inner, 1)
    outer.seek(1.5)
    expect(seen.at(-1)).toBeCloseTo(0.5)
    outer.seek(3)
    expect(seen.at(-1)).toBe(1)
  })

  it('animates element transforms and styles', () => {
    const el = document.createElement('div')
    const tl = new Timeline({ ticker: ticker() }).to(el, { x: 100, opacity: 0.5, '--reveal': 1 }, { duration: 1, ease: 'linear' })
    tl.seek(0.5)
    expect(el.style.transform).toBe('translate3d(50px, 0px, 0px)')
    expect(el.style.opacity).toBe('0.75')
    expect(el.style.getPropertyValue('--reveal')).toBe('0.5')
  })
})
