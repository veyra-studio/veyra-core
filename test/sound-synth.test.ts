import { afterEach, describe, expect, it, vi } from 'vitest'
import { SoundBus } from '../src/sound/bus'

// Enough of Web Audio for the bus: a context that starts suspended, as
// browsers create it before a gesture, and resumes when asked.
class FakeContext {
  state: AudioContextState | 'interrupted' = 'suspended'
  currentTime = 0
  sampleRate = 44100
  destination = {}
  resumes = 0
  hold = false
  createGain() {
    return { gain: { value: 1, cancelScheduledValues() {}, setTargetAtTime() {} }, connect: (n: unknown) => n }
  }
  resume() {
    this.resumes++
    if (this.hold) return new Promise<void>(() => {})
    this.state = 'running'
    return Promise.resolve()
  }
  suspend() {
    this.state = 'suspended'
    return Promise.resolve()
  }
  close() {
    this.state = 'closed'
    return Promise.resolve()
  }
}

const withAudio = () => {
  vi.stubGlobal('AudioContext', FakeContext)
  ;(window as unknown as Record<string, unknown>).AudioContext = FakeContext
}
const contextOf = (bus: SoundBus) => (bus as unknown as { ctx: FakeContext | null }).ctx

afterEach(() => {
  vi.unstubAllGlobals()
  delete (window as unknown as Record<string, unknown>).AudioContext
  localStorage.clear()
})

describe('SoundBus one-shots', () => {
  it('are silent no-ops until sound is enabled and running', () => {
    const bus = new SoundBus({ storageKey: false })
    expect(bus.audible).toBe(false)
    expect(() => bus.tone({ frequency: 440, to: 220, decay: 0.1 })).not.toThrow()
    expect(() => bus.burst({ from: 3000, to: 1000, filter: 'highpass', decay: 0.2 })).not.toThrow()
    bus.destroy()
  })
})

describe('SoundBus on and off', () => {
  it('can start on for visitors who have not chosen, and keeps a choice once made', () => {
    expect(new SoundBus({ storageKey: 'k' }).enabled.value).toBe(false)
    expect(new SoundBus({ storageKey: 'k', defaultOn: true }).enabled.value).toBe(true)
    localStorage.setItem('k', '0')
    expect(new SoundBus({ storageKey: 'k', defaultOn: true }).enabled.value).toBe(false)
    localStorage.setItem('k', '1')
    expect(new SoundBus({ storageKey: 'k' }).enabled.value).toBe(true)
  })

  it('starts audio on the end of a touch or a click, not on a touch starting', async () => {
    withAudio()
    let t = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => t)
    const bus = new SoundBus({ storageKey: false, defaultOn: true })
    window.dispatchEvent(new Event('pointerdown'))
    expect(contextOf(bus)).toBeNull()
    window.dispatchEvent(new Event('touchend'))
    await Promise.resolve()
    expect(contextOf(bus)?.state).toBe('running')
    expect(bus.audible).toBe(true)
    // Suspended or interrupted by the system (another app, a call): the next tap brings it back.
    t += 1000
    contextOf(bus)!.state = 'interrupted'
    expect(bus.audible).toBe(false)
    window.dispatchEvent(new Event('click'))
    await Promise.resolve()
    expect(contextOf(bus)?.state).toBe('running')
    bus.destroy()
  })

  it("lets the gesture's own sounds through while the context resumes, briefly", () => {
    withAudio()
    let t = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => t)
    const bus = new SoundBus({ storageKey: false, defaultOn: true })
    // A context that takes its time to resume.
    const ctx = bus.context as unknown as FakeContext
    ctx.hold = true
    window.dispatchEvent(new Event('keydown'))
    expect(bus.audible).toBe(true)
    t += 300
    expect(bus.audible).toBe(false)
    bus.destroy()
  })

  it("doesn't start audio while sound is off", () => {
    withAudio()
    const bus = new SoundBus({ storageKey: false })
    window.dispatchEvent(new Event('click'))
    expect(contextOf(bus)).toBeNull()
    bus.destroy()
  })
})
