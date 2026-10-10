/**
 * FLIP layout transitions — First, Last, Invert, Play. Record where
 * elements are, change the layout any way you like (classes, reordering,
 * a different container), and Veyra animates every element from its old
 * box to its new one using transforms only.
 *
 * ```ts
 * flip('.card', () => grid.classList.toggle('is-list'), { stagger: 0.02 })
 *
 * // Or in two steps, around asynchronous work:
 * const before = captureLayout('.card')
 * await renderResults()
 * flipFrom(before, { duration: 0.6 })
 * ```
 *
 * Interrupting a running flip starts the next one from where elements are
 * on screen. Elements should not carry other rotate/scale transforms.
 */
import type { EaseLike } from '../core/ease.js';
import type { Ticker } from '../core/ticker.js';
import { Timeline, type Stagger, type Targets } from './timeline.js';
export interface FlipOptions {
    /** Seconds. Default `0.7`. */
    duration?: number;
    /** Default `'glide'`. */
    ease?: EaseLike;
    stagger?: Stagger;
    /** Animate size changes with scale. Default `true`; turn off when content must not stretch. */
    scale?: boolean;
    /** Fade in elements that had no box before (new or previously hidden). Default `true`. */
    fadeIn?: boolean;
    /** Jump to the new layout without animating (e.g. `stage.reducedMotion.value`). */
    immediate?: boolean;
    ticker?: Ticker;
    onComplete?: () => void;
}
export interface LayoutState {
    readonly elements: readonly Element[];
    readonly rects: ReadonlyMap<Element, DOMRect>;
}
/** Records the on-screen boxes of `targets` (the "First" of FLIP). */
export declare function captureLayout(targets: Targets): LayoutState;
/**
 * Animates elements from a captured layout to where they are now. Pass
 * `targets` to include elements that appeared since the capture.
 */
export declare function flipFrom(state: LayoutState, options?: FlipOptions, targets?: Targets): Timeline;
/** Captures `targets`, runs `mutate`, and animates the change. */
export declare function flip(targets: Targets, mutate: () => void, options?: FlipOptions): Timeline;
//# sourceMappingURL=flip.d.ts.map