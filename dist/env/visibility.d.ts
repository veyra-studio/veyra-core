/**
 * Viewport visibility, for doing expensive work only when it can be seen:
 * initialize a WebGL scene, decode a video, start a demo.
 */
export interface VisibilityOptions {
    /** Grows (or shrinks) the viewport used for the test, e.g. `'200px'` to start early. Default `'0px'`. */
    rootMargin?: string;
    /** Fraction of the element that must be visible. Default `0`. */
    threshold?: number;
    /** Run once and stop observing. Default `true`. */
    once?: boolean;
}
/**
 * Calls `callback` when `target` enters the viewport. With `once: false` it
 * runs on every entry, and a function it returns runs on exit. Returns a
 * function that stops observing (and runs a pending exit cleanup).
 *
 * Without `IntersectionObserver` (old browsers, tests) the callback runs
 * immediately.
 */
export declare function whenVisible(target: Element | string, callback: () => void | (() => void), options?: VisibilityOptions): () => void;
//# sourceMappingURL=visibility.d.ts.map