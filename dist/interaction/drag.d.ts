import { type SpringConfig } from '../motion/spring.js';
import type { StagePlugin } from '../stage.js';
export interface DragBounds {
    minX?: number;
    maxX?: number;
    minY?: number;
    maxY?: number;
}
/** Snap points: a list of positions, a step size, or a function returning the snapped value. */
export type DragSnap = readonly number[] | number | ((value: number, axis: 'x' | 'y') => number);
export interface DraggableOptions {
    /** Default `'x'`. */
    axis?: 'x' | 'y' | 'both';
    /** Limits, `'parent'` (stay within / cover the parent), or a function re-evaluated on each drag. */
    bounds?: DragBounds | 'parent' | (() => DragBounds);
    snap?: DragSnap;
    /** Keep moving after release. Default `true`. */
    inertia?: boolean;
    /** Inertia time constant in seconds. Default `0.325`. */
    timeConstant?: number;
    /** Rubber-band stiffness past the bounds, `0…1`. Default `0.55`; `0` locks to the bounds. */
    resistance?: number;
    /** Spring used for snapping and returning inside the bounds. */
    spring?: SpringConfig;
    /** Write `x` / `y` transforms. Default `true`; turn off to drive something else from `onUpdate`. */
    apply?: boolean;
    /** Pixels the pointer must travel before a drag starts. Default `4`. */
    threshold?: number;
    /**
     * Arrow keys step between snap points while the element has focus.
     * `true` moves the element in the arrow's direction; `'content'` moves it
     * the other way, like scrolling a carousel.
     */
    keyboard?: boolean | 'content';
    onDragStart?: (drag: Draggable) => void;
    onDrag?: (drag: Draggable) => void;
    onDragEnd?: (drag: Draggable) => void;
    /** Called once motion has fully stopped after a release. */
    onRest?: (drag: Draggable) => void;
    /** Called after every position change. */
    onUpdate?: (drag: Draggable) => void;
}
export interface Draggable {
    readonly el: HTMLElement;
    readonly x: number;
    readonly y: number;
    readonly velocityX: number;
    readonly velocityY: number;
    readonly dragging: boolean;
    /** Coasting or springing after a release. */
    readonly moving: boolean;
    readonly enabled: boolean;
    /** Moves to a position, springing there unless `animate` is `false`. */
    setPosition(x: number, y: number, options?: {
        animate?: boolean;
    }): void;
    /** Moves `steps` snap points (positive = towards larger values), on one axis or all. */
    step(steps: number, axis?: 'x' | 'y'): void;
    enable(): void;
    disable(): void;
    destroy(): void;
}
export declare function draggable(target: Element | string, options?: DraggableOptions): StagePlugin<Draggable>;
//# sourceMappingURL=drag.d.ts.map