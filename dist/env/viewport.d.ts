/**
 * Viewport state as signals, with a resize policy suited to mobile: a
 * height-only change smaller than `heightThreshold` (the URL bar showing or
 * hiding while scrolling) does not trigger a layout refresh.
 */
import { type ReadonlySignal, type Signal } from '../core/signal.js';
export interface ViewportOptions {
    /** Height changes below this (px) are ignored for layout on touch devices. Default `160`. */
    heightThreshold?: number;
}
export declare class Viewport {
    readonly width: Signal<number>;
    readonly height: Signal<number>;
    readonly dpr: Signal<number>;
    /** Coarse primary pointer (most phones and tablets). */
    readonly touch: Signal<boolean>;
    /** Last width/height used for layout. Changes trigger `onLayout`. */
    readonly layoutSize: Signal<{
        width: number;
        height: number;
    }>;
    private readonly heightThreshold;
    private readonly cleanups;
    private stable;
    private probe;
    constructor(options?: ViewportOptions);
    get w(): number;
    get h(): number;
    get aspect(): number;
    /**
     * The large viewport height (px, CSS `100lvh`): the page's height with a
     * phone's toolbars hidden. It holds still while the address bar slides in
     * and out, and is measured again only when the layout size changes
     * (rotation, a resized window). On desktops it equals `height`. Created on
     * first use.
     */
    get stableHeight(): ReadonlySignal<number>;
    /** Re-reads window metrics. Called on `resize`; call manually if needed. */
    read(): void;
    /** Subscribes to layout-relevant resizes. */
    onLayout(fn: (size: {
        width: number;
        height: number;
    }) => void): () => void;
    destroy(): void;
    /** The height of a fixed `100lvh` box (`100vh` where `lvh` isn't supported: mobile browsers size `vh` to the large viewport too). */
    private measureStable;
}
//# sourceMappingURL=viewport.d.ts.map