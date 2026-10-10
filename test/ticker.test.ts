import { describe, expect, it, vi } from 'vitest'
import { Phase, Ticker } from '../src/core/ticker'

function manual() {
  return new Ticker({ autoPause: false, requestFrame: () => 0, cancelFrame: () => {} })
}

describe('Ticker', () => {
  it('runs callbacks in phase order, stable within a phase', () => {
    const t = manual()
    const order: string[] = []
    t.add(() => order.push('render'), Phase.render)
    t.add(() => order.push('update-a'))
    t.add(() => order.push('input'), Phase.input)
    t.add(() => order.push('update-b'))
    t.tick(0)
    expect(order).toEqual(['input', 'update-a', 'update-b', 'render'])
  })

  it('computes clamped, scaled deltas', () => {
    const t = manual()
    const deltas: number[] = []
    t.add((f) => deltas.push(f.delta))
    t.tick(0)
    t.tick(16)
    t.tick(1016) // 1 s stall
    t.timeScale = 0.5
    t.tick(1032)
    expect(deltas[0]).toBe(0)
    expect(deltas[1]).toBeCloseTo(0.016)
    expect(deltas[2]).toBeCloseTo(1 / 15) // clamped
    expect(deltas[3]).toBeCloseTo(0.008)
  })

  it('tolerates removal during iteration', () => {
    const t = manual()
    const calls: string[] = []
    const removeB = t.add(() => calls.push('b'), 1)
    t.add(() => {
      calls.push('a')
      removeB()
    }, 0)
    t.tick(0)
    t.tick(16)
    expect(calls).toEqual(['a', 'a'])
  })

  it('runs once() callbacks a single time', () => {
    const t = manual()
    const fn = vi.fn()
    t.once(fn)
    t.tick(0)
    t.tick(16)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('drops a throwing callback but keeps the loop alive', () => {
    const t = manual()
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ok = vi.fn()
    t.add(() => {
      throw new Error('boom')
    })
    t.add(ok)
    t.tick(0)
    t.tick(16)
    expect(ok).toHaveBeenCalledTimes(2)
    expect(t.size).toBe(1)
    expect(err).toHaveBeenCalledTimes(1)
    err.mockRestore()
  })
})
