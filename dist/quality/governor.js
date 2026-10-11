/**
 * Adaptive quality. Watches real frame times and steps a quality level
 * down when the device struggles, and cautiously back up when it has
 * headroom. Renderers subscribe to `level` / `dpr` instead of guessing
 * device capability up front.
 */
import { clamp, lerp } from '../core/math.js';
import { signal } from '../core/signal.js';
/**
 * Estimates a starting level from hardware hints. Phones and tablets
 * (a coarse pointer) start in the middle: their GPUs are far weaker than
 * desktops' and their screens dense, and an octa-core CPU says little about
 * either. The governor climbs from there when frames have headroom.
 */
export function estimateQuality() {
    if (typeof navigator === 'undefined')
        return 0.75;
    const nav = navigator;
    const coarse = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
    const cores = nav.hardwareConcurrency ?? 4;
    let level = coarse ? 0.55 : 0.75;
    if (cores <= 4)
        level -= 0.15;
    if (cores >= 8 && !coarse)
        level += 0.1;
    if (nav.deviceMemory !== undefined && nav.deviceMemory <= 2)
        level -= 0.3;
    else if (nav.deviceMemory !== undefined && nav.deviceMemory <= 4)
        level -= 0.15;
    if (nav.connection?.saveData)
        level -= 0.25;
    return clamp(level);
}
/** Where the tiers begin: medium at 0.34, high at 0.67. */
const TIER_LOW = 0.34;
const TIER_HIGH = 0.67;
export class QualityGovernor {
    /** Continuous quality level, `0…1`. */
    level;
    /** Coarse tier derived from `level`. */
    tier;
    /** Recommended canvas pixel ratio. */
    dpr;
    /** Detected display refresh rate (Hz), refined over the first second. */
    refreshRate = 60;
    opts;
    /** The highest level the governor may climb to (see `steadyTier`). */
    ceiling;
    samples = [];
    warmup = [];
    badWindows = 0;
    goodWindows = 0;
    cooldown = 0;
    stalls = 0;
    constructor(options = {}) {
        this.opts = {
            min: options.min ?? 0,
            max: options.max ?? 1,
            window: options.window ?? 30,
            targetRatio: options.targetRatio ?? 0.86,
            minRefreshRate: options.minRefreshRate ?? 60,
            steadyTier: options.steadyTier ?? true,
            dprRange: options.dprRange ?? [1, 2],
            adaptive: options.adaptive ?? true,
        };
        this.ceiling = this.opts.max;
        const initial = options.initial === undefined || options.initial === 'auto' ? estimateQuality() : options.initial;
        this.level = signal(clamp(initial, this.opts.min, this.opts.max));
        this.tier = signal(this.toTier(this.level.value));
        this.dpr = signal(this.toDpr(this.level.value));
        this.level.subscribe((l) => {
            this.tier.set(this.toTier(l));
            this.dpr.set(this.toDpr(l));
        });
    }
    /** Target frames per second given the refresh rate. */
    get target() {
        return Math.min(this.refreshRate, 120) * this.opts.targetRatio;
    }
    /** Forces a level (e.g. from a user setting); the governor may climb to it again. */
    set(level) {
        const l = clamp(level, this.opts.min, this.opts.max);
        this.ceiling = Math.max(this.ceiling, l);
        this.level.set(l);
    }
    /** Feeds one frame's real duration in seconds. Called by the stage every frame. */
    sample(rawDelta) {
        if (rawDelta <= 0)
            return;
        // A single long frame is a stall (tab switch, GC pause, first frame) and
        // says nothing about load. Several in a row mean the device can't keep up
        // at all (a software renderer, a far too heavy scene): drop to the lowest
        // level at once instead of waiting for windows of frames that never come.
        if (rawDelta > 0.25) {
            if (++this.stalls >= 3) {
                this.stalls = 0;
                this.samples = [];
                this.badWindows = 0;
                this.goodWindows = 0;
                this.step(this.opts.min - this.level.value);
            }
            return;
        }
        this.stalls = 0;
        if (this.warmup.length < 60) {
            this.warmup.push(rawDelta);
            if (this.warmup.length === 60) {
                const sorted = [...this.warmup].sort((a, b) => a - b);
                const median = sorted[30];
                const hz = 1 / median;
                // Snap to common refresh rates, never below the floor: slow frames
                // here more likely mean a struggling device than a slow screen.
                const snapped = [30, 48, 60, 75, 90, 100, 120, 144, 165, 240].reduce((best, r) => (Math.abs(r - hz) < Math.abs(best - hz) ? r : best), 60);
                this.refreshRate = Math.max(this.opts.minRefreshRate, snapped);
                // Already far too slow while warming up: step down now rather than
                // after more windows of slow frames.
                if (this.opts.adaptive && hz < this.target * 0.6)
                    this.step(-this.drop(hz));
            }
            return;
        }
        if (!this.opts.adaptive)
            return;
        if (this.cooldown > 0) {
            this.cooldown--;
            return;
        }
        this.samples.push(rawDelta);
        if (this.samples.length < this.opts.window)
            return;
        const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
        this.samples = [];
        const fps = 1 / avg;
        if (fps < this.target * 0.6) {
            // Far too slow: don't wait for a second window.
            this.goodWindows = 0;
            this.badWindows = 0;
            this.slowDown(this.drop(fps));
        }
        else if (fps < this.target) {
            this.goodWindows = 0;
            if (++this.badWindows >= 2) {
                this.badWindows = 0;
                this.slowDown(0.2);
            }
        }
        else if (fps > this.target * 1.08) {
            this.badWindows = 0;
            // Climb slowly to avoid oscillating between levels.
            if (++this.goodWindows >= 6) {
                this.goodWindows = 0;
                this.step(0.1);
            }
        }
        else {
            this.badWindows = 0;
            this.goodWindows = 0;
        }
    }
    /** How far to step down at `fps`, far below target: further the slower it is. */
    drop(fps) {
        return fps < this.target * 0.4 ? 0.4 : 0.25;
    }
    /** Steps down after sustained slow frames; with `steadyTier`, the tier left behind stays out of reach. */
    slowDown(amount) {
        const from = this.level.value;
        this.step(-amount);
        if (!this.opts.steadyTier || this.toTier(this.level.value) === this.toTier(from))
            return;
        const floorOfLeft = from >= TIER_HIGH ? TIER_HIGH : TIER_LOW;
        this.ceiling = Math.min(this.ceiling, floorOfLeft - 0.01);
    }
    step(amount) {
        const top = amount > 0 ? Math.max(this.level.value, this.ceiling) : this.opts.max;
        const next = clamp(Math.min(this.level.value + amount, top), this.opts.min, this.opts.max);
        if (next === this.level.value)
            return;
        this.level.set(next);
        // Give the new level time to show its effect before judging again.
        this.cooldown = 30;
    }
    toTier(l) {
        return l < TIER_LOW ? 'low' : l < TIER_HIGH ? 'medium' : 'high';
    }
    toDpr(l) {
        const device = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
        const [lo, hi] = this.opts.dprRange;
        return Math.round(Math.min(device, lerp(lo, hi, l)) * 100) / 100;
    }
}
//# sourceMappingURL=governor.js.map