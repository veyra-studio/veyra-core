/**
 * Contact shadows: the soft, dense shadow where an object meets the floor —
 * the cue that makes a product stand on something instead of floating.
 * Casters are rendered from below as depth, blurred, and shown on a plane.
 *
 * ```ts
 * const shadow = new ContactShadow({ width: 400, depth: 400, far: 300 })
 * shadow.cast(bottle)                // bottle and its children cast
 * scene.add(shadow.object)           // place it at the floor, under the bottle
 * stage.onFrame(() => shadow.update(renderer, scene))
 * ```
 *
 * Move it with `object.position`; change its size with `resize()` — don't
 * scale `object` (the capture camera would be culled wrongly).
 */
import * as THREE from 'three';
export interface ContactShadowOptions {
    /** Plane width (x) in world units. */
    width: number;
    /** Plane depth (z) in world units. */
    depth: number;
    /** Height above the plane at which a caster stops darkening it. */
    far: number;
    /** Render target size in pixels. Default `512`. */
    resolution?: number;
    /** Blur radius in texels. Default `3`. */
    blur?: number;
    /** Darkness of the closest parts `0…1+`. Default `1`. */
    darkness?: number;
    /** Plane opacity. Default `0.8`. */
    opacity?: number;
    /** Shadow color. Default black. */
    color?: THREE.ColorRepresentation;
    /** Render layer that marks casters. Default `5`. */
    layer?: number;
}
export declare class ContactShadow {
    /** Add this to the scene and place it at floor level. */
    readonly object: THREE.Group<THREE.Object3DEventMap>;
    readonly layer: number;
    /** Plane opacity, adjustable at any time. */
    get opacity(): number;
    set opacity(v: number);
    private readonly target;
    private readonly blurTarget;
    private readonly camera;
    private readonly depthMaterial;
    private readonly blurMaterial;
    private readonly planeMaterial;
    private readonly plane;
    private readonly quad;
    private readonly quadScene;
    private readonly quadCamera;
    private readonly blur;
    constructor(options: ContactShadowOptions);
    /** Resizes the plane (`width` × `depth`) and how high above it casters count (`far`), in world units. */
    resize(width: number, depth: number, far: number): void;
    /** Marks `object` and its descendants as shadow casters. */
    cast(object: THREE.Object3D): void;
    /** Re-renders the shadow. Call when casters move (every frame while animating). */
    update(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void;
    dispose(): void;
}
//# sourceMappingURL=shadow.d.ts.map