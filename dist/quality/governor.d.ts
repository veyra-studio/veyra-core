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
    /** Target as a fraction of the detected refresh rate. Default `0.86`. */
    targetRatio?: number;
    /**
     * Lowest refresh rate assumed, in Hz. Frame times can't tell a 30 Hz
     * screen from a device that only manages 30 fps on a 60 Hz one, so the
     * governor never settles for less than this. Default `60`.
     */
    minRefreshRate?: number;
    /** Device-pixel-ratio range mapped from level. Default `[1, 2]`. */
    dprRange?: [number, number];
    /** Disable adaptation (level stays at `initial`). Default `true`. */
    adaptive?: boolean;
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
    constructor(options?: QualityOptions);
    /** Target frames per second given the refresh rate. */
    get target(): number;
    /** Forces a level (e.g. from a user setting). */
    set(level: number): void;
    /** Feeds one frame's real duration in seconds. Called by the stage every frame. */
    sample(rawDelta: number): void;
    /** How far to step down at `fps`, far below target: further the slower it is. */
    private drop;
    private step;
    private toTier;
    private toDpr;
}
//# sourceMappingURL=governor.d.ts.map