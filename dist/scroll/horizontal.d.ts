import type { Scene } from '../scene/scene.js';
import type { StagePlugin } from '../stage.js';
export interface HorizontalOptions {
    /** The sticky element. Default: the target's first element child. */
    pin?: Element | string;
    /** The moving row. Default: the pin's widest child. */
    track?: Element | string;
    /** Selector for panels inside the track. Default: the track's element children. */
    panels?: string;
    /** Vertical scroll per horizontal pixel. Default `1`; `1.5` makes the section 50 % longer. */
    speed?: number;
    /** Smoothing of the row's motion (per second). Default `0` (follows scroll exactly). */
    smooth?: number;
    /** Settle on the nearest panel when scrolling stops. */
    snap?: boolean | {
        delay?: number;
        duration?: number;
    };
    /** CSS variable receiving each panel's `0…1` progress across the viewport. Default `'--panel-progress'`. */
    panelVar?: string | false;
    onProgress?: (progress: number, section: Horizontal) => void;
    /** Called when the panel under the viewport's center line changes. */
    onPanel?: (index: number, section: Horizontal) => void;
}
export interface Horizontal {
    readonly el: HTMLElement;
    readonly scene: Scene;
    readonly direction: 'ltr' | 'rtl';
    readonly progress: number;
    /** Horizontal distance travelled so far (px, along the reading direction). */
    readonly travel: number;
    /** Total horizontal travel (px). */
    readonly distance: number;
    readonly panels: readonly HTMLElement[];
    /** Index of the panel under the viewport's center line. */
    readonly active: number;
    /** `0` as panel `index` enters at the line end, `1` once it has left at the line start. */
    panelProgress(index: number): number;
    /** Scrolls the page so that panel `index` sits where the first panel rests. */
    scrollToPanel(index: number, options?: {
        duration?: number;
        immediate?: boolean;
    }): Promise<void>;
    /** Re-measures on the next frame (automatic on resize and font loading). */
    refresh(): void;
    destroy(): void;
}
export declare function horizontal(target: Element | string, options?: HorizontalOptions): StagePlugin<Horizontal>;
//# sourceMappingURL=horizontal.d.ts.map