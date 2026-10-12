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
/**
 * A window's typical frame time: the mean without its slowest tenth. A few
 * one-off hitches (a texture upload, a shader compiling, a GC pause) don't
 * make a window slow; frames that are slow throughout still do.
 */
function typicalFrame(samples) {
    const sorted = [...samples].sort((a, b) => a - b);
    const keep = sorted.length - Math.floor(sorted.length / 10);
    let sum = 0;
    for (let i = 0; i < keep; i++)
        sum += sorted[i];
    return sum / keep;
}
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
    samples = [];
    warmup = [];
    badWindows = 0;
    goodWindows = 0;
    cooldown = 0;
    stalls = 0;
    /** Tiers out of reach after slow frames pushed the level out of them (see `steadyTier`). */
    fenced = new Set();
    /** How often sustained slow frames pushed the level out of each tier. */
    exits = new Map();
    /** Fast windows in a row spent against a fence that may still open. */
    patience = 0;
    holds = 0;
    /** Seconds of frames until a timed `hold()` lets go. */
    heldFor = 0;
    constructor(options = {}) {
        this.opts = {
            min: options.min ?? 0,
            max: options.max ?? 1,
            window: options.window ?? 30,
            targetRatio: options.targetRatio ?? 0.86,
            minRefreshRate: options.minRefreshRate ?? 60,
            maxTargetFps: options.maxTargetFps ?? 60,
            steadyTier: options.steadyTier ?? true,
            reentryWindows: options.reentryWindows ?? 20,
            dprRange: options.dprRange ?? [1, 2],
            adaptive: options.adaptive ?? true,
        };
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
        return Math.min(this.refreshRate, this.opts.maxTargetFps) * this.opts.targetRatio;
    }
    /** True while a `hold()` keeps frames from being judged. */
    get held() {
        return this.holds > 0 || this.heldFor > 0;
    }
    /** The highest level the governor may climb to (see `steadyTier`). */
    get ceiling() {
        let top = this.opts.max;
        if (this.fenced.has('high'))
            top = Math.min(top, TIER_HIGH - 0.01);
        if (this.fenced.has('medium'))
            top = Math.min(top, TIER_LOW - 0.01);
        return top;
    }
    /** Forces a level (e.g. from a user setting); the governor may climb to it again. */
    set(level) {
        const l = clamp(level, this.opts.min, this.opts.max);
        const tier = this.toTier(l);
        // Lift the fences up to the tier asked for.
        if (tier !== 'low')
            this.fenced.delete('medium');
        if (tier === 'high')
            this.fenced.delete('high');
        this.patience = 0;
        this.level.set(l);
    }
    /**
     * Stops judging frames while heavy one-off work runs — preloading,
     * building a scene, compiling shaders, uploading textures — so its slow
     * frames don't lower the quality of a device that is fine. Pass the work
     * (released when it settles), a duration in seconds of frames, or nothing
     * and call the returned function when done. Holds nest.
     *
     * ```ts
     * stage.quality?.hold(buildWorld())
     * ```
     */
    hold(work) {
        if (typeof work === 'number') {
            this.heldFor = Math.max(this.heldFor, work);
            return () => {
                if (this.heldFor > 0)
                    this.heldFor = 0;
                if (!this.held)
                    this.resumeJudging();
            };
        }
        this.holds++;
        let released = false;
        const release = () => {
            if (released)
                return;
            released = true;
            this.holds--;
            if (!this.held)
                this.resumeJudging();
        };
        work?.then(release, release);
        return release;
    }
    /** Re-reads the device pixel ratio (a window moved to another screen, a zoom). The stage calls it on resize. */
    syncDpr() {
        this.dpr.set(this.toDpr(this.level.value));
    }
    /** Feeds one frame's real duration in seconds. Called by the stage every frame. */
    sample(rawDelta) {
        if (rawDelta <= 0)
            return;
        if (this.heldFor > 0) {
            const left = this.heldFor - rawDelta;
            this.heldFor = left > 1e-6 ? left : 0;
            if (!this.held)
                this.resumeJudging();
            return;
        }
        if (this.holds > 0)
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
        const fps = 1 / typicalFrame(this.samples);
        this.samples = [];
        if (fps < this.target * 0.6) {
            // Far too slow: don't wait for a second window.
            this.goodWindows = 0;
            this.badWindows = 0;
            this.patience = 0;
            this.slowDown(this.drop(fps));
        }
        else if (fps < this.target) {
            this.goodWindows = 0;
            this.patience = 0;
            if (++this.badWindows >= 2) {
                this.badWindows = 0;
                this.slowDown(0.2);
            }
        }
        else if (fps > this.target * 1.08) {
            this.badWindows = 0;
            this.openFence();
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
    /** Steps down after sustained slow frames; with `steadyTier`, the tier left behind is fenced off. */
    slowDown(amount) {
        const from = this.toTier(this.level.value);
        this.step(-amount);
        if (!this.opts.steadyTier || from === 'low' || this.toTier(this.level.value) === from)
            return;
        this.exits.set(from, (this.exits.get(from) ?? 0) + 1);
        this.fenced.add(from);
        this.patience = 0;
    }
    /**
     * A fast window: if the level is held against a fence that may still open
     * (its tier was left only once), count it; enough in a row open it.
     */
    openFence() {
        const blocking = this.fenced.has('medium') ? 'medium' : this.fenced.has('high') ? 'high' : null;
        if (!blocking || this.level.value < this.ceiling - 1e-6 || (this.exits.get(blocking) ?? 0) > 1)
            return;
        if (++this.patience >= this.opts.reentryWindows) {
            this.patience = 0;
            this.fenced.delete(blocking);
        }
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
    /** After a hold: start a fresh window, and let the first frames after the work settle first. */
    resumeJudging() {
        this.samples = [];
        this.badWindows = 0;
        this.goodWindows = 0;
        this.stalls = 0;
        this.cooldown = Math.max(this.cooldown, this.opts.window);
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