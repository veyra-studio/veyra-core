import { afterEach, describe, expect, it, vi } from 'vitest'
import { RectCache } from '../src/layout/rects'
import { ScrollController } from '../src/scroll/scroll'

/** Replaces a getter for the length of a test, counting reads. */
function countReads(target: object, key: string, value: () => number) {
  let owner: object | null = target
  while (owner && !Object.getOwnPropertyDescriptor(owner, key)) owner = Object.getPrototypeOf(owner)
  const original = owner ? Object.getOwnPropertyDescriptor(owner, key) : undefined
  const counter = { reads: 0 }
  Object.defineProperty(target, key, {
    configurable: true,
    get: () => {
      counter.reads++
      return value()
    },
  })
  restores.push(() => {
    if (owner === target && original) Object.defineProperty(target, key, original)
    else delete (target as Record<string, unknown>)[key]
  })
  return counter
}

const restores: Array<() => void> = []
afterEach(() => {
  for (const restore of restores.splice(0).reverse()) restore()
  vi.restoreAllMocks()
})

describe('RectCache', () => {
  it('derives viewport rects without reading layout, every frame', () => {
    const el = document.createElement('div')
    el.getBoundingClientRect = () => ({ top: 100, left: 20, width: 300, height: 200, bottom: 300, right: 320, x: 20, y: 100, toJSON() {} })
    const rects = new RectCache(() => 0)
    rects.track(el)
    const scrollX = countReads(window, 'scrollX', () => 0)
    const boxes = vi.spyOn(el, 'getBoundingClientRect')
    for (let i = 0; i < 100; i++) rects.view(el, 50)
    expect(rects.view(el, 50)).toMatchObject({ top: 50, left: 20, bottom: 250, right: 320 })
    // Reading the offset forces a layout once styles were written: never in view().
    expect(scrollX.reads).toBe(0)
    expect(boxes).not.toHaveBeenCalled()
    // The measure phase reads it, with the measurements.
    rects.invalidate()
    rects.updateLive()
    expect(scrollX.reads).toBe(1)
    expect(boxes).toHaveBeenCalledTimes(1)
  })
})

describe('ScrollController', () => {
  it("doesn't read layout on wheel events, and re-measures once when pushed past the end", () => {
    let height = 5000
    const scrollHeight = countReads(document.documentElement, 'scrollHeight', () => height)
    countReads(window, 'innerHeight', () => 1000)
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const scroll = new ScrollController()
    expect(scroll.limit).toBe(4000)
    const reads = scrollHeight.reads
    for (let i = 0; i < 20; i++) window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, cancelable: true }))
    expect(scrollHeight.reads).toBe(reads)
    expect(scroll.target).toBe(2000)
    // Past the end as last measured, while the page grew: the next frame re-measures and carries on.
    height = 7000
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 2500, cancelable: true }))
    expect(scroll.target).toBe(4000)
    expect(scrollHeight.reads).toBe(reads)
    scroll.update(1 / 60)
    expect(scrollHeight.reads).toBe(reads + 1)
    expect(scroll.limit).toBe(6000)
    expect(scroll.target).toBe(4500)
    scroll.update(1 / 60)
    expect(scrollHeight.reads).toBe(reads + 1)
    scroll.destroy()
  })
})
