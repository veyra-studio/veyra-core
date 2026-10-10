import { describe, expect, it } from 'vitest'
import { SoundBus } from '../src/sound/bus'

describe('SoundBus one-shots', () => {
  it('are silent no-ops until sound is enabled and running', () => {
    const bus = new SoundBus({ storageKey: false })
    expect(bus.audible).toBe(false)
    expect(() => bus.tone({ frequency: 440, to: 220, decay: 0.1 })).not.toThrow()
    expect(() => bus.burst({ from: 3000, to: 1000, filter: 'highpass', decay: 0.2 })).not.toThrow()
    bus.destroy()
  })
})
