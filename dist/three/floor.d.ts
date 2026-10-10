/**
 * A glossy floor — black acrylic, polished stone, a wet table — that
 * reflects what stands on it. The scene is rendered once more from a camera
 * mirrored in the floor (only the layers you choose). The floor shows that
 * image fading and blurring with the height of what it reflects, the way a
 * real glossy surface does: sharp at the contact, gone a little higher up.
 * Height is reconstructed from the mirror render's depth, so the look holds
 * at any camera angle, grazing ones included.
 *
 * ```ts
 * const floor = new ReflectiveFloor({ width: 3000, depth: 3000, fade: [0, 300] })
 * scene.add(floor.mesh)                      // horizontal, facing +y
 * stage.onFrame(() => floor.update(renderer, scene, camera), Phase.render - 1)
 * ```
 */
import * as THREE from 'three';
export interface ReflectiveFloorOptions {
    /** Width (x) of the floor in world units. */
    width: number;
    /** Depth (z) of the floor in world units. */
    depth: number;
    /** Reflection buffer size relative to the drawing buffer. Default `0.5`. */
    resolution?: number;
    /** Reflection strength `0…1` (a dark floor reflects little). Default `0.35`. */
    strength?: number;
    /** Tint of the reflection. Default white. */
    tint?: THREE.ColorRepresentation;
    /** Heights above the floor where reflected objects start fading and are gone. */
    fade?: readonly [start: number, end: number];
    /** Blur (mip level) reached at the fade end. Default `4`. */
    blur?: number;
    /** Only objects on this layer are reflected. Default: the camera's layers. */
    layer?: number;
}
export declare class ReflectiveFloor {
    /** The floor. Add it to the scene; it lies in the XZ plane at its position's y. */
    readonly mesh: THREE.Mesh;
    private readonly target;
    private readonly material;
    private readonly mirror;
    private readonly textureMatrix;
    private readonly scale;
    private readonly layer;
    private readonly plane;
    private readonly normal;
    private readonly floorPos;
    private readonly camPos;
    private readonly rotation;
    private readonly lookAt;
    private readonly view;
    private readonly look;
    private readonly clip;
    private readonly q;
    private readonly size;
    private readonly mirrorInverse;
    constructor(options: ReflectiveFloorOptions);
    /** Sets the heights above the floor where reflected objects start fading and are gone. */
    setFade(start: number, end: number): void;
    /** Reflection strength, adjustable at any time. */
    get strength(): number;
    set strength(v: number);
    /** Renders the reflection for `camera`. Call before rendering the scene with it. */
    update(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void;
    dispose(): void;
}
//# sourceMappingURL=floor.d.ts.map