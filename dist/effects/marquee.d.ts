import type { StagePlugin } from '../stage.js';
export interface MarqueeOptions {
    /** Pixels per second. Default `60`. */
    speed?: number;
    /** `'auto'` (default) follows the reading direction; `-1` runs against it. */
    direction?: 'auto' | 1 | -1;
    /** Extra speed per unit of scroll velocity (px/s per px/s). Default `0.3`. */
    scrollFactor?: number;
    /** Run backwards while the page scrolls up. Default `false`. */
    followScroll?: boolean;
    /** Speed multiplier while hovered — `0` pauses. Default `1`. */
    hoverSpeed?: number;
}
export interface Marquee {
    readonly el: HTMLElement;
    /** Base speed in px/s. */
    speed: number;
    /** Current offset of the band (px). */
    readonly offset: number;
    /** Re-measures (called automatically on resize). */
    refresh(): void;
    /** Restores the original markup. */
    destroy(): void;
}
export declare function marquee(target: Element | string, options?: MarqueeOptions): StagePlugin<Marquee>;
//# sourceMappingURL=marquee.d.ts.map