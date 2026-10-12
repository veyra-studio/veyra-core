/**
 * Sound as an optional layer. Off unless the site turns it on by default
 * (`defaultOn`), never required for understanding the experience,
 * persisted per visitor, unlocked on a user gesture (as browsers require)
 * and silenced while the tab is hidden.
 */
import { signal, type Signal } from '../core/signal.js'

export interface SoundOptions {
  /** localStorage key for the visitor's choice; `false` disables persistence. Default `'veyra:sound'`. */
  storageKey?: string | false
  /** Master volume `0…1`. Default `0.8`. */
  volume?: number
  /**
   * Sound on for visitors who haven't chosen yet. Browsers still hold audio
   * back until the visitor's first click, tap or key press; the bus starts
   * it then. Default `false`.
   */
  defaultOn?: boolean
}

export interface PlayOptions {
  volume?: number
  /** Playback rate (pitch). Default `1`. */
  rate?: number
  /** Stereo pan `-1…1`. */
  pan?: number
  /** Seconds from now. */
  delay?: number
}

export interface ToneOptions {
  /** Start frequency in Hz. */
  frequency: number
  /** End frequency for an exponential glide. Default: no glide. */
  to?: number
  /** Default `'sine'`. */
  type?: OscillatorType
  /** Peak gain. Default `0.2`. */
  gain?: number
  /** Attack in seconds. Default `0.004`. */
  attack?: number
  /** Decay in seconds (exponential, to silence). Default `0.2`. */
  decay?: number
  /** Seconds from now. Default `0`. */
  delay?: number
  /** Stereo pan `-1…1`. */
  pan?: number
}

export interface BurstOptions {
  /** Filter type. Default `'bandpass'`. */
  filter?: BiquadFilterType
  /** Filter frequency at the start, in Hz. */
  from: number
  /** Filter frequency at the end (exponential sweep). Default: `from`. */
  to?: number
  /** Filter Q. Default `1`. */
  q?: number
  /** Peak gain. Default `0.2`. */
  gain?: number
  /** Attack in seconds. Default `0.004`. */
  attack?: number
  /** Decay in seconds (exponential, to silence). Default `0.3`. */
  decay?: number
  /** Seconds from now. Default `0`. */
  delay?: number
  /** Noise color. Default `'white'`. */
  color?: 'white' | 'pink'
  /** Stereo pan `-1…1`. */
  pan?: number
}

/** The visitor's stored choice: `true` on, `false` off, `null` not chosen yet (or no storage). */
function readStored(key: string | false): boolean | null {
  if (!key) return null
  try {
    const stored = localStorage.getItem(key)
    return stored === null ? null : stored === '1'
  } catch {
    return null
  }
}

/**
 * Safari's Audio Session API (iOS 16.4+): `'playback'` plays like media,
 * even with the ring/silent switch on silent; `'auto'` lets the system
 * decide, which keeps Web Audio quiet on silent.
 */
function setAudioSession(type: 'auto' | 'playback'): void {
  const session = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { audioSession?: { type: string } }).audioSession
  if (!session || session.type === type) return
  try {
    session.type = type
  } catch {
    /* not allowed here — keep the system's choice */
  }
}

/**
 * Events that count as user activation, the only moments browsers let audio
 * start: a key, a click, a mouse press, the end of a touch — not a touch's
 * start, not a scroll or a wheel.
 */
const ACTIVATION = ['keydown', 'mousedown', 'pointerup', 'touchend', 'click'] as const

/** While the context is being resumed from a gesture, sounds of that same gesture are let through. */
const RESUME_GRACE_MS = 250

export class SoundBus {
  /** Whether the visitor wants sound. */
  readonly enabled: Signal<boolean>
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private readonly volume: number
  private readonly key: string | false
  private readonly noiseCache = new Map<string, AudioBuffer>()
  private readonly cleanups: Array<() => void> = []
  private graceUntil = 0
  /** Sound is on because the visitor turned it on (now or in an earlier visit), not by default. */
  private chosen: boolean

  constructor(options: SoundOptions = {}) {
    this.key = options.storageKey ?? 'veyra:sound'
    this.volume = options.volume ?? 0.8
    const stored = readStored(this.key)
    this.chosen = stored === true
    this.enabled = signal(stored ?? options.defaultOn ?? false)
    if (typeof window === 'undefined') return

    // An "on" from storage or the default still needs a gesture before
    // audio may start; so does a context the system suspended or
    // interrupted (another app, a call). Listen on every activation, in the
    // capture phase so the context is resuming before the page's own
    // handlers play their sounds.
    const unlock = () => {
      if (!this.enabled.value || this.ctx?.state === 'running') return
      // Sound the visitor asked for plays on a phone set to silent, like a
      // video they start; sound that is merely on by default follows the switch.
      if (this.chosen) setAudioSession('playback')
      void this.resume(true)
    }
    for (const type of ACTIVATION) window.addEventListener(type, unlock, { capture: true, passive: true })
    const onVisibility = () => {
      if (!this.ctx) return
      if (document.hidden) void this.ctx.suspend()
      else if (this.enabled.value) void this.resume(false)
    }
    document.addEventListener('visibilitychange', onVisibility)
    this.cleanups.push(() => {
      for (const type of ACTIVATION) window.removeEventListener(type, unlock, { capture: true })
      document.removeEventListener('visibilitychange', onVisibility)
    })
  }

  /** The audio context, created lazily. `null` outside the browser. */
  get context(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined' && 'AudioContext' in window) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.enabled.value ? this.volume : 0
      this.master.connect(this.ctx.destination)
    }
    return this.ctx
  }

  /** Node to connect custom graphs (synths, effects) to. */
  get output(): AudioNode | null {
    return this.context ? this.master : null
  }

  /**
   * True when sound is wanted and the context is running — or is being
   * resumed by the gesture under way, so that gesture's own sounds play.
   */
  get audible(): boolean {
    if (!this.enabled.value || !this.ctx) return false
    return this.ctx.state === 'running' || (this.ctx.state !== 'closed' && now() < this.graceUntil)
  }

  /**
   * Turns sound on. Call from a click or key handler. Asked for out loud,
   * it plays even on an iPhone switched to silent (where Safari's Audio
   * Session API exists).
   */
  async enable(): Promise<void> {
    this.chosen = true
    this.enabled.set(true)
    this.persist()
    setAudioSession('playback')
    await this.resume(true)
  }

  /** Turns sound off (fades out quickly). */
  disable(): void {
    this.chosen = false
    this.enabled.set(false)
    this.persist()
    setAudioSession('auto')
    if (this.ctx && this.master) {
      const t = this.ctx.currentTime
      this.master.gain.cancelScheduledValues(t)
      this.master.gain.setTargetAtTime(0, t, 0.05)
    }
  }

  async toggle(): Promise<void> {
    if (this.enabled.value) this.disable()
    else await this.enable()
  }

  /** Plays a decoded buffer through the master bus. No-op when silent. */
  play(buffer: AudioBuffer, options: PlayOptions = {}): AudioBufferSourceNode | null {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.audible) return null
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.playbackRate.value = options.rate ?? 1
    let node: AudioNode = src
    const gain = ctx.createGain()
    gain.gain.value = options.volume ?? 1
    node.connect(gain)
    node = gain
    if (options.pan !== undefined && 'createStereoPanner' in ctx) {
      const panner = ctx.createStereoPanner()
      panner.pan.value = options.pan
      node.connect(panner)
      node = panner
    }
    node.connect(this.master)
    src.start(ctx.currentTime + (options.delay ?? 0))
    return src
  }

  /** Fetches and decodes an audio file. */
  async load(url: string): Promise<AudioBuffer> {
    const ctx = this.context
    if (!ctx) throw new Error('[veyra] Web Audio is not available')
    const data = await (await fetch(url)).arrayBuffer()
    return ctx.decodeAudioData(data)
  }

  /** A buffer of noise — the raw material for synthesized fizz, wind, hiss. */
  noise(seconds = 1, color: 'white' | 'pink' = 'white'): AudioBuffer | null {
    const ctx = this.context
    if (!ctx) return null
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      if (color === 'white') data[i] = white
      else {
        // Paul Kellet's economy pink filter.
        b0 = 0.99765 * b0 + white * 0.099046
        b1 = 0.963 * b1 + white * 0.2965164
        b2 = 0.57 * b2 + white * 1.0526913
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2
      }
    }
    return buffer
  }

  /**
   * A synthesized tone with an exponential envelope and an optional pitch
   * glide — ticks, pings, the ring of a cap, a thump. No-op when silent.
   */
  tone(options: ToneOptions): void {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.audible) return
    const t = ctx.currentTime + (options.delay ?? 0)
    const attack = options.attack ?? 0.004
    const decay = options.decay ?? 0.2
    const o = ctx.createOscillator()
    o.type = options.type ?? 'sine'
    o.frequency.setValueAtTime(options.frequency, t)
    if (options.to !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(1, options.to), t + attack + decay)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, options.gain ?? 0.2), t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
    o.connect(g).connect(this.route(ctx, options.pan))
    o.start(t)
    o.stop(t + attack + decay + 0.05)
  }

  /**
   * A filtered noise burst — clicks, hisses, thuds, whooshes, the pop of a
   * cap. No-op when silent.
   */
  burst(options: BurstOptions): void {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.audible) return
    const color = options.color ?? 'white'
    let buffer = this.noiseCache.get(color)
    if (!buffer) {
      buffer = this.noise(2, color) ?? undefined
      if (!buffer) return
      this.noiseCache.set(color, buffer)
    }
    const t = ctx.currentTime + (options.delay ?? 0)
    const attack = options.attack ?? 0.004
    const decay = options.decay ?? 0.3
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const f = ctx.createBiquadFilter()
    f.type = options.filter ?? 'bandpass'
    f.Q.value = options.q ?? 1
    f.frequency.setValueAtTime(options.from, t)
    if (options.to !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(1, options.to), t + attack + decay)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, options.gain ?? 0.2), t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
    src.connect(f).connect(g).connect(this.route(ctx, options.pan))
    src.start(t, Math.random() * Math.max(0, buffer.duration - attack - decay - 0.1))
    src.stop(t + attack + decay + 0.05)
  }

  destroy(): void {
    for (const c of this.cleanups) c()
    void this.ctx?.close()
    this.ctx = null
    this.master = null
  }

  /** The master bus, or a panner in front of it. */
  private route(ctx: AudioContext, pan: number | undefined): AudioNode {
    if (pan === undefined || !('createStereoPanner' in ctx)) return this.master!
    const panner = ctx.createStereoPanner()
    panner.pan.value = pan
    panner.connect(this.master!)
    return panner
  }

  private async resume(fromGesture: boolean): Promise<void> {
    const ctx = this.context
    if (!ctx || !this.master) return
    if (ctx.state !== 'running') {
      if (fromGesture) this.graceUntil = now() + RESUME_GRACE_MS
      try {
        await ctx.resume()
      } catch {
        return
      }
    }
    // The bus may have been destroyed while the context resumed.
    const master = this.master
    if (this.ctx !== ctx || !master) return
    const t = ctx.currentTime
    master.gain.cancelScheduledValues(t)
    master.gain.setTargetAtTime(this.enabled.value ? this.volume : 0, t, 0.08)
  }

  private persist(): void {
    if (!this.key) return
    try {
      localStorage.setItem(this.key, this.enabled.value ? '1' : '0')
    } catch {
      /* storage unavailable (private mode) — keep the in-memory choice */
    }
  }
}

const now = () => (typeof performance === 'undefined' ? Date.now() : performance.now())
