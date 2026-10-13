import { afterEach, describe, expect, it, vi } from 'vitest'
import { SoundBus } from '../src/sound/bus'

// Enough of Web Audio to follow what a voice schedules.
class Param {
  value: number
  events: Array<[string, number, number]> = []
  constructor(value: number) {
    this.value = value
  }
  cancelScheduledValues(t: number) {
    this.events.push(['cancel', 0, t])
  }
  setValueAtTime(v: number, t: number) {
    this.events.push(['set', v, t])
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.events.push(['ramp', v, t])
    this.value = v
  }
  setTargetAtTime() {}
}
class Source {
  buffer: unknown = null
  loop = false
  loopStart = 0
  loopEnd = 0
  playbackRate = new Param(1)
  started: number[] = []
  stopped: number[] = []
  listeners: Record<string, () => void> = {}
  connect = (n: unknown) => n
  start(...args: number[]) {
    this.started = args
  }
  stop(t: number) {
    this.stopped.push(t)
  }
  addEventListener(type: string, fn: () => void) {
    this.listeners[type] = fn
  }
}
const sources: Source[] = []
const gains: Param[] = []
class FakeContext {
  state = 'running'
  currentTime = 2
  destination = {}
  createGain() {
    const gain = new Param(1)
    gains.push(gain)
    return { gain, connect: (n: unknown) => n }
  }
  createBufferSource() {
    const s = new Source()
    sources.push(s)
    return s
  }
  resume() {
    return Promise.resolve()
  }
  suspend() {
    return Promise.resolve()
  }
  close() {
    return Promise.resolve()
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete (window as unknown as Record<string, unknown>).AudioContext
  sources.length = 0
  gains.length = 0
})

const audibleBus = async () => {
  vi.stubGlobal('AudioContext', FakeContext)
  ;(window as unknown as Record<string, unknown>).AudioContext = FakeContext
  const bus = new SoundBus({ storageKey: false })
  await bus.enable()
  return bus
}

describe('SoundBus voices', () => {
  it('are null while silent', () => {
    const bus = new SoundBus({ storageKey: false })
    expect(bus.voice({} as AudioBuffer)).toBeNull()
    bus.destroy()
  })

  it('loop part of a buffer and glide their pitch and volume', async () => {
    const bus = await audibleBus()
    const voice = bus.voice({ duration: 3 } as AudioBuffer, { loop: true, loopStart: 0.5, loopEnd: 1.5, offset: 0.5, rate: 1.2, volume: 0.6, fadeIn: 0.1 })!
    const src = sources[0]!
    expect(src.loop).toBe(true)
    expect([src.loopStart, src.loopEnd]).toEqual([0.5, 1.5])
    expect(src.started).toEqual([2, 0.5])
    expect(src.playbackRate.value).toBe(1.2)
    voice.setRate(0.7, 0.2)
    expect(src.playbackRate.events.at(-1)).toEqual(['ramp', 0.7, 2.2])
    voice.setVolume(0.3)
    voice.stop(0.1)
    expect(voice.playing).toBe(false)
    expect(src.stopped[0]).toBeCloseTo(2.12, 5)
    // Stopping twice, or gliding after, does nothing.
    voice.stop()
    voice.setRate(2)
    expect(src.stopped).toHaveLength(1)
    bus.destroy()
  })

  it('play a stretch of a buffer as a one-shot', async () => {
    const bus = await audibleBus()
    bus.play({ duration: 3 } as AudioBuffer, { offset: 1.25, duration: 0.5, delay: 0.1 })
    expect(sources[0]!.started).toEqual([2.1, 1.25, 0.5])
    bus.play({ duration: 3 } as AudioBuffer)
    expect(sources[1]!.started).toEqual([2, 0])
    bus.destroy()
  })

  it('fade a grain in and out on the audio clock, stretched by its rate', async () => {
    const bus = await audibleBus()
    const before = gains.length
    bus.play({ duration: 3 } as AudioBuffer, { offset: 1, duration: 0.4, rate: 2, volume: 0.5, fadeIn: 0.01, fadeOut: 0.05 })
    // The grain lasts 0.4 s of buffer at double speed: 0.2 s of clock, from t = 2.
    const expected: Array<[string, number, number]> = [
      ['set', 0, 2],
      ['ramp', 0.5, 2.01],
      ['set', 0.5, 2.15],
      ['ramp', 0, 2.2],
    ]
    const events = gains[before]!.events
    expect(events.map((e) => [e[0], e[1]])).toEqual(expected.map((e) => [e[0], e[1]]))
    events.forEach((e, i) => expect(e[2]).toBeCloseTo(expected[i]![2], 9))
    // Without fades it is a plain level.
    bus.play({ duration: 3 } as AudioBuffer, { volume: 0.3 })
    expect(gains.at(-1)!.events).toEqual([])
    expect(gains.at(-1)!.value).toBe(0.3)
    bus.destroy()
  })
})
