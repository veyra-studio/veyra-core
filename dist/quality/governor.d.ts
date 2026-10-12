import { type Signal } from '../core/signal.js';
export type QualityTier = 'low' | 'medium' | 'high';
export interface QualityOptions {
    /** Starting level `0…1`, or `'auto'` to estimate from device hints. Default `'auto'`. */
    initial?: number | 'auto';
    /** Lowest allowed level. Default `0`. */
    min?: number;
    /** Highest allowed level. Default `1`. */
    max?: number;
    /** Frames per evaluation window. Default `30`. */
    window?: number;
    /** Target as a fraction of the frame rate aimed for. Default `0.86`. */
    targetRatio?: number;
    /**
     * Lowest refresh rate assumed, in Hz. Frame times can't tell a 30 Hz
     * screen from a device that only manages 30 fps on a 60 Hz one, so the
     * governor never settles for less than this. Default `60`.
     */
    minRefreshRate?: number;
    /**
     * Highest frame rate the governor trades quality for, in fps. A 120 or
     * 144 Hz screen still runs as fast as the device draws, but quality isn't
     * lowered to get past this. Default `60`.
     */
    maxTargetFps?: number;
    /** Device-pixel-ratio range mapped from level. Default `[1, 2]`. */
    dprRange?: [number, number];
    /** Disable adaptation (level stays at `initial`). Default `true`. */
    adaptive?: boolean;
    /**
     * Once slow frames push the level down into a lower tier, the tier it left
     * stays out of reach (it still rises within its tier, and with it the
     * pixel ratio): what a page swaps by tier swaps once, not back and forth.
     * It may come back once, after `reentryWindows` windows of steady
     * headroom (a hitch while loading isn't a slow device); leaving it a
     * second time keeps it out for the session. Default `true`.
     */
    steadyTier?: boolean;
    /** Fast windows in a row before a tier left for slow frames may be re-entered (see `steadyTier`). Default `20` (about 10 s). */
    reentryWindows?: number;
}
/**
 * Estimates a starting level from hardware hints. Phones and tablets
 * (a coarse pointer) start in the middle: their GPUs are far weaker than
 * desktops' and their screens dense, and an octa-core CPU says little about
 * either. The governor climbs from there when frames have headroom.
 */
export declare function estimateQuality(): number;
export declare class QualityGovernor {
    /** Continuous quality level, `0…1`. */
    readonly level: Signal<number>;
    /** Coarse tier derived from `level`. */
    readonly tier: Signal<QualityTier>;
    /** Recommended canvas pixel ratio. */
    readonly dpr: Signal<number>;
    /** Detected display refresh rate (Hz), refined over the first second. */
    refreshRate: number;
    private readonly opts;
    private samples;
    private warmup;
    private badWindows;
    private goodWindows;
    private cooldown;
    private stalls;
    /** Tiers out of reach after slow frames pushed the level out of them (see `steadyTier`). */
    private readonly fenced;
    /** How often sustained slow frames pushed the level out of each tier. */
    private readonly exits;
    /** Fast windows in a row spent against a fence that may still open. */
    private patience;
    private holds;
    /** Seconds of frames until a timed `hold()` lets go. */
    private heldFor;
    constructor(options?: QualityOptions);
    /** Target frames per second given the refresh rate. */
    get target(): number;
    /** True while a `hold()` keeps frames from being judged. */
    get held(): boolean;
    /** The highest level the governor may climb to (see `steadyTier`). */
    private get ceiling();
    /** Forces a level (e.g. from a user setting); the governor may climb to it again. */
    set(level: number): void;
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
    hold(work?: PromiseLike<unknown> | number): () => void;
    /** Re-reads the device pixel ratio (a window moved to another screen, a zoom). The stage calls it on resize. */
    syncDpr(): void;
    /** Feeds one frame's real duration in seconds. Called by the stage every frame. */
    sample(rawDelta: number): void;
    /** How far to step down at `fps`, far below target: further the slower it is. */
    private drop;
    /** Steps down after sustained slow frames; with `steadyTier`, the tier left behind is fenced off. */
    private slowDown;
    /**
     * A fast window: if the level is held against a fence that may still open
     * (its tier was left only once), count it; enough in a row open it.
     */
    private openFence;
    private step;
    /** After a hold: start a fresh window, and let the first frames after the work settle first. */
    private resumeJudging;
    private toTier;
    private toDpr;
}
//# sourceMappingURL=governor.d.ts.map