import { describe, expect, it, vi } from 'vitest'
import { RectCache } from '../src/layout/rects'
import { resolveAnchor, resolveEdge, Scene, scenePresets } from '../src/scene/scene'

const frame = { time: 0, delta: 1 / 60, rawDelta: 1 / 60, frame: 1, now: 0 }

function fakeRects(top: number, height: number): RectCache {
  const rc = new RectCache(() => 0)
  rc.measure = () => ({ top, left: 0, width: 100, height })
  return rc
}

describe('scene anchors', () => {
  it('resolves edges', () => {
    expect(resolveEdge('top', 500)).toBe(0)
    expect(resolveEdge('center', 500)).toBe(250)
    expect(resolveEdge('bottom', 500)).toBe(500)
    expect(resolveEdge('20%', 500)).toBe(100)
    expect(resolveEdge('120px', 500)).toBe(120)
    expect(resolveEdge('top+=50', 500)).toBe(50)
    expect(resolveEdge('bottom-=10%', 500)).toBe(450)
    expect(() => resolveEdge('middle', 500)).toThrow()
  })

  it('resolves anchors to scroll positions', () => {
    // Element at 2000px, 1000px tall, viewport 800px.
    expect(resolveAnchor('top bottom', 2000, 1000, 800)).toBe(1200)
    expect(resolveAnchor('bottom top', 2000, 1000, 800)).toBe(3000)
    expect(resolveAnchor('top top', 2000, 1000, 800)).toBe(2000)
    expect(resolveAnchor('bottom bottom', 2000, 1000, 800)).toBe(2200)
  })
})

describe('Scene', () => {
  it('maps scroll to progress and fires transitions', () => {
    const el = document.createElement('section')
    const calls: string[] = []
    const scene = new Scene(
      el,
      {
        ...scenePresets.pinned,
        cssVar: '--p',
        onEnter: () => calls.push('enter'),
        onLeave: () => calls.push('leave'),
        onEnterBack: () => calls.push('enterBack'),
        onLeaveBack: () => calls.push('leaveBack'),
      },
      fakeRects(1000, 3000),
      () => 1000,
    )
    expect(scene.start).toBe(1000)
    expect(scene.end).toBe(3000)
    scene.update(0, frame)
    expect(scene.progress).toBe(0)
    scene.update(2000, frame)
    expect(scene.progress).toBe(0.5)
    expect(el.style.getPropertyValue('--p')).toBe('0.5000')
    scene.update(4000, frame)
    scene.update(2500, frame)
    scene.update(0, frame)
    expect(calls).toEqual(['enter', 'leave', 'enterBack', 'leaveBack'])
  })

  it('fires both enter and leave when jumping across', () => {
    const fn = vi.fn()
    const scene = new Scene(document.createElement('div'), { onEnter: fn, onLeave: fn }, fakeRects(1000, 100), () => 500)
    scene.update(0, frame)
    scene.update(5000, frame)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('only runs onUpdate near its range', () => {
    const fn = vi.fn()
    const scene = new Scene(document.createElement('div'), { ...scenePresets.pinned, margin: 100, onUpdate: fn }, fakeRects(1000, 1500), () => 500)
    scene.update(0, frame)
    scene.update(950, frame)
    scene.update(1200, frame)
    scene.update(1700, frame)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('exposes local sub-progress', () => {
    const scene = new Scene(document.createElement('div'), scenePresets.pinned, fakeRects(0, 2000), () => 1000)
    scene.update(500, frame)
    expect(scene.progress).toBe(0.5)
    expect(scene.local(0.25, 0.75)).toBe(0.5)
  })
})
