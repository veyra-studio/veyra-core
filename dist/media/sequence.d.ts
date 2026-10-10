import type { Scene, SceneOptions } from '../scene/scene.js';
import type { StagePlugin } from '../stage.js';
export interface ImageSequenceOptions {
    /** Number of frames. */
    count: number;
    /** URL of frame `index` (0-based). */
    src: (index: number) => string;
    /** Scrub with a scroll scene over this element (or with full scene options). Otherwise set `progress` yourself. */
    scene?: Element | string | SequenceSceneOptions;
    /** How frames fill the canvas. Default `'cover'`. */
    fit?: 'cover' | 'contain';
    /** `'progressive'` (default) loads a coarse set first; `'sequential'` loads in order. */
    load?: 'progressive' | 'sequential';
    /** Parallel requests. Default `6`. */
    concurrency?: number;
    /** Called as frames arrive. */
    onLoad?: (loaded: number, total: number) => void;
}
/** Scene options with a selector or element as the trigger. */
export type SequenceSceneOptions = Omit<SceneOptions, 'trigger'> & {
    trigger: Element | string;
};
export interface ImageSequence {
    readonly canvas: HTMLCanvasElement;
    /** `0…1`. Settable when no scene drives it. */
    progress: number;
    /** Index of the frame on the canvas (`-1` before the first one loads). */
    readonly frame: number;
    /** Frames loaded so far. */
    readonly loaded: number;
    /** Resolves once every frame has been requested and settled. */
    readonly ready: Promise<void>;
    readonly scene: Scene | null;
    destroy(): void;
}
/**
 * Load order that covers the whole range early: the ends, then every
 * `coarsest`-th frame, then halving the step down to 1.
 */
export declare function progressiveOrder(count: number, coarsest?: number): number[];
/** Nearest index with a truthy entry in `loaded` (ties go to the earlier frame), or `-1`. */
export declare function nearestLoaded(index: number, loaded: ArrayLike<boolean | number>): number;
export declare function imageSequence(target: HTMLCanvasElement | string, options: ImageSequenceOptions): StagePlugin<ImageSequence>;
//# sourceMappingURL=sequence.d.ts.map