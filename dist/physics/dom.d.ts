import type { StagePlugin } from '../stage.js';
import type { Body, PhysicsWorld } from './world.js';
export interface DomCollidersOptions {
    /** Thickness of the boxes along z, in world units. Default `400`. */
    depth?: number;
    /** z of the boxes' centers. Default `0`. */
    z?: number;
    /** The world's viewport (pass the layer: with `stableHeight` it differs from the window). Default: the stage's viewport. */
    size?: () => {
        width: number;
        height: number;
    };
    /** Re-measure every frame — for elements in sticky or transformed containers. */
    live?: boolean;
    /** Bounciness of the boxes. Default `0.5`. */
    restitution?: number;
    friction?: number;
    group?: number;
    mask?: number;
}
export interface DomColliders {
    readonly bodies: readonly Body<Element>[];
    /** Moves the boxes to their elements (runs every frame before the default phase). */
    update(dt?: number): void;
    destroy(): void;
}
export declare function domColliders(world: PhysicsWorld, targets: string | Element | Iterable<Element>, options?: DomCollidersOptions): StagePlugin<DomColliders>;
//# sourceMappingURL=dom.d.ts.map