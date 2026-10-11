/**
 * Sound as an optional layer. Off unless the site turns it on by default
 * (`defaultOn`), never required for understanding the experience,
 * persisted per visitor, unlocked on a user gesture (as browsers require)
 * and silenced while the tab is hidden.
 */
import { type Signal } from '../core/signal.js';
export interface SoundOptions {
    /** localStorage key for the visitor's choice; `false` disables persistence. Default `'veyra:sound'`. */
    storageKey?: string | false;
    /** Master volume `0…1`. Default `0.8`. */
    volume?: number;
    /**
     * Sound on for visitors who haven't chosen yet. Browsers still hold audio
     * back until the visitor's first click, tap or key press; the bus starts
     * it then. Default `false`.
     */
    defaultOn?: boolean;
}
export interface PlayOptions {
    volume?: number;
    /** Playback rate (pitch). Default `1`. */
    rate?: number;
    /** Stereo pan `-1…1`. */
    pan?: number;
    /** Seconds from now. */
    delay?: number;
}
export interface ToneOptions {
    /** Start frequency in Hz. */
    frequency: number;
    /** End frequency for an exponential glide. Default: no glide. */
    to?: number;
    /** Default `'sine'`. */
    type?: OscillatorType;
    /** Peak gain. Default `0.2`. */
    gain?: number;
    /** Attack in seconds. Default `0.004`. */
    attack?: number;
    /** Decay in seconds (exponential, to silence). Default `0.2`. */
    decay?: number;
    /** Seconds from now. Default `0`. */
    delay?: number;
    /** Stereo pan `-1…1`. */
    pan?: number;
}
export interface BurstOptions {
    /** Filter type. Default `'bandpass'`. */
    filter?: BiquadFilterType;
    /** Filter frequency at the start, in Hz. */
    from: number;
    /** Filter frequency at the end (exponential sweep). Default: `from`. */
    to?: number;
    /** Filter Q. Default `1`. */
    q?: number;
    /** Peak gain. Default `0.2`. */
    gain?: number;
    /** Attack in seconds. Default `0.004`. */
    attack?: number;
    /** Decay in seconds (exponential, to silence). Default `0.3`. */
    decay?: number;
    /** Seconds from now. Default `0`. */
    delay?: number;
    /** Noise color. Default `'white'`. */
    color?: 'white' | 'pink';
    /** Stereo pan `-1…1`. */
    pan?: number;
}
export declare class SoundBus {
    /** Whether the visitor wants sound. */
    readonly enabled: Signal<boolean>;
    private ctx;
    private master;
    private readonly volume;
    private readonly key;
    private readonly noiseCache;
    private readonly cleanups;
    private graceUntil;
    constructor(options?: SoundOptions);
    /** The audio context, created lazily. `null` outside the browser. */
    get context(): AudioContext | null;
    /** Node to connect custom graphs (synths, effects) to. */
    get output(): AudioNode | null;
    /**
     * True when sound is wanted and the context is running — or is being
     * resumed by the gesture under way, so that gesture's own sounds play.
     */
    get audible(): boolean;
    /** Turns sound on. Call from a click or key handler. */
    enable(): Promise<void>;
    /** Turns sound off (fades out quickly). */
    disable(): void;
    toggle(): Promise<void>;
    /** Plays a decoded buffer through the master bus. No-op when silent. */
    play(buffer: AudioBuffer, options?: PlayOptions): AudioBufferSourceNode | null;
    /** Fetches and decodes an audio file. */
    load(url: string): Promise<AudioBuffer>;
    /** A buffer of noise — the raw material for synthesized fizz, wind, hiss. */
    noise(seconds?: number, color?: 'white' | 'pink'): AudioBuffer | null;
    /**
     * A synthesized tone with an exponential envelope and an optional pitch
     * glide — ticks, pings, the ring of a cap, a thump. No-op when silent.
     */
    tone(options: ToneOptions): void;
    /**
     * A filtered noise burst — clicks, hisses, thuds, whooshes, the pop of a
     * cap. No-op when silent.
     */
    burst(options: BurstOptions): void;
    destroy(): void;
    /** The master bus, or a panner in front of it. */
    private route;
    private resume;
    private persist;
}
//# sourceMappingURL=bus.d.ts.map