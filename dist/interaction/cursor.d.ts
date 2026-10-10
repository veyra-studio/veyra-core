import type { StagePlugin } from '../stage.js';
export interface CursorOptions {
    /** Use an existing element. Default: creates `<div class="veyra-cursor"><span class="veyra-cursor-label">`. */
    el?: HTMLElement | string;
    /** Class of the created element. Default `'veyra-cursor'`. */
    className?: string;
    /** Elements that activate the cursor. Default `'a, button, [data-cursor]'`. */
    targets?: string;
    /** Follow speed (per second). Default `20`; `0` follows exactly. */
    smoothing?: number;
    /** Hide the system cursor while the custom one is visible. Default `false`. */
    hideNative?: boolean;
}
export interface Cursor {
    readonly el: HTMLElement;
    readonly x: number;
    readonly y: number;
    /** The interactive element under the pointer. */
    readonly target: Element | null;
    /** The current label (from `data-cursor`). */
    readonly label: string;
    destroy(): void;
}
export declare function cursor(options?: CursorOptions): StagePlugin<Cursor>;
//# sourceMappingURL=cursor.d.ts.map