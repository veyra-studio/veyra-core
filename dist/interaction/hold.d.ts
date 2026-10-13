/**
 * Press and hold — a mouse, a finger, or a key — for pumping, charging,
 * revealing. Every frame while held, `onHold` gets the time held so far and
 * the frame's delta; the element carries `data-held` meanwhile, for CSS.
 *
 * ```ts
 * stage.use(holdable('.pump', { onHold: (hold, dt) => (air += dt * 6), onEnd: () => letGo() }))
 * ```
 *
 * Space and Enter hold while the element has focus: make it a `<button>`.
 * On touch screens give it `touch-action: none` and `user-select: none`, so
 * a long press neither scrolls nor selects.
 */
import type { StagePlugin } from '../stage.js';
export interface HoldOptions {
    /** Keys that hold while the element has focus. Default `[' ', 'Enter']`. */
    keys?: readonly string[];
    onStart?: (hold: Hold) => void;
    /** Every frame while held, with the frame's delta in seconds. */
    onHold?: (hold: Hold, dt: number) => void;
    /** Let go — or interrupted (focus lost, pointer cancelled, disabled). */
    onEnd?: (hold: Hold) => void;
}
export interface Hold {
    readonly el: HTMLElement;
    readonly held: boolean;
    /** Seconds held: the current hold's, or the last one's after release. */
    readonly duration: number;
    /** What is holding: a pointer or a key (`null` when not held). */
    readonly source: 'pointer' | 'key' | null;
    readonly enabled: boolean;
    enable(): void;
    /** Stops listening (ending a hold under way). */
    disable(): void;
    destroy(): void;
}
export declare function holdable(target: string | HTMLElement, options?: HoldOptions): StagePlugin<Hold>;
//# sourceMappingURL=hold.d.ts.map