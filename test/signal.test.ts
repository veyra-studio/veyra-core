import { describe, expect, it, vi } from 'vitest'
import { computed, signal } from '../src/core/signal'

describe('signal', () => {
  it('notifies on change only', () => {
    const s = signal(1)
    const fn = vi.fn()
    s.subscribe(fn)
    s.set(1)
    s.set(2)
    s.value = 3
    s.update((v) => v + 1)
    expect(fn.mock.calls).toEqual([[2, 1], [3, 2], [4, 3]])
  })

  it('unsubscribes and supports immediate', () => {
    const s = signal('a')
    const fn = vi.fn()
    const off = s.subscribe(fn, { immediate: true })
    off()
    s.set('b')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('derives values from inputs', () => {
    const w = signal(100)
    const h = signal(50)
    const aspect = computed([w, h], (a, b) => a / b)
    expect(aspect.value).toBe(2)
    const fn = vi.fn()
    aspect.subscribe(fn)
    w.set(200)
    expect(aspect.value).toBe(4)
    h.set(100) // aspect back to 2
    expect(fn).toHaveBeenCalledTimes(2)
    aspect.dispose()
    w.set(400)
    expect(aspect.value).toBe(2)
  })
})
