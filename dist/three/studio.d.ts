/**
 * Product-photography lighting without image files: softboxes, strip lights
 * and reflectors placed in a dark room, baked once into a prefiltered
 * environment map (PMREM). Glass, metal and liquids read their highlights
 * from it, the way they do from the real thing in a studio.
 *
 * ```ts
 * scene.environment = studioEnvironment(renderer)                 // the 'product' setup
 * scene.environment = studioEnvironment(renderer, { lights: studioLights.soft })
 * ```
 */
import * as THREE from 'three';
export interface StudioLight {
    /** Panel size `[width, height]` in room units (the room is about 20 units across). */
    size: readonly [number, number];
    /** Panel center. The subject sits at the origin; +z faces the camera, +y is up. */
    position: readonly [number, number, number];
    /** Radiance multiplier (1 = the color itself). */
    intensity: number;
    /** Default white. */
    color?: THREE.ColorRepresentation;
    /** Point the panel faces. Default: the origin. */
    target?: readonly [number, number, number];
    /** `'rect'` (softbox, strip) or `'disc'` (beauty dish, sun). Default `'rect'`. */
    shape?: 'rect' | 'disc';
}
export interface StudioOptions {
    /** The lights. Default `studioLights.product`. */
    lights?: readonly StudioLight[];
    /** Wall color at the top and bottom of the room. Default near-black. */
    walls?: readonly [top: THREE.ColorRepresentation, bottom: THREE.ColorRepresentation];
    /** Prefilter blur (radians). Default `0.02`. */
    blur?: number;
}
/** Ready-made setups. */
export declare const studioLights: Record<'product' | 'soft', readonly StudioLight[]>;
/** Bakes a studio into a PMREM environment texture. Dispose it with the renderer's other textures. */
export declare function studioEnvironment(renderer: THREE.WebGLRenderer, options?: StudioOptions): THREE.Texture;
//# sourceMappingURL=studio.d.ts.map