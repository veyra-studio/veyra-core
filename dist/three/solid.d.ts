/**
 * Clear solids — ice, glass blocks, crystal — ray-traced from the inside.
 *
 * Patches a `MeshPhysicalMaterial` so the light that passes through the
 * mesh is traced through a solid described by a signed distance function:
 * the view ray refracts at the surface, runs to the far side (found by
 * bisection on the SDF), refracts out — or reflects back in past the
 * critical angle, which is what draws the bright and dark edges of real
 * glass and ice — and samples what lies beyond: the scene's environment
 * map, or a world of your own (`outside`). The surface reflects that same
 * world. Nothing depends on what the canvas shows behind the mesh, and
 * there is no transmission pass.
 *
 * ```ts
 * // A glass block with rounded edges (half extents 1, 0.6, 1; radius 0.15).
 * const material = new THREE.MeshPhysicalMaterial({ color: 0x000000, specularIntensity: 0, transparent: true })
 * refractiveSolid(material, {
 *   sdf: `float solidSdf(vec3 p) {
 *     vec3 d = abs(p) - (vec3(1.0, 0.6, 1.0) - 0.15);
 *     return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0) - 0.15;
 *   }`,
 *   bounds: new THREE.Vector3(1, 0.6, 1),
 *   inner: new THREE.Vector3(0.93, 0.53, 0.93),
 *   ior: 1.5,
 * })
 * scene.add(new THREE.Mesh(roundedBoxGeometry, material))   // the mesh gives the entry point and normal
 * ```
 *
 * Keep the material's `color` black and its `specularIntensity` 0 (the
 * traced light replaces its shading), and consider `transparent: true`:
 * the solid still writes depth and covers what's behind it, but three.js
 * then leaves it out of the transmission pre-pass other glass triggers,
 * so it isn't traced twice a frame.
 */
import * as THREE from 'three';
export interface SolidOptions {
    /**
     * GLSL defining `float solidSdf(vec3 p)`: the solid's signed distance in
     * object space (negative inside). It should match the mesh, which gives
     * the entry point and normal. Convex solids (or nearly): each exit is
     * found by bisection between a point inside and the far side of `bounds`.
     */
    sdf: string;
    /** Half extents of a box about the object-space origin that holds the solid. */
    bounds: THREE.Vector3;
    /**
     * Half extents of a box about the origin that lies wholly inside the
     * solid. Optional; it narrows the search for each exit, so fewer `steps` do.
     */
    inner?: THREE.Vector3;
    /** Index of refraction. Default 1.5. */
    ior?: number;
    /** Beer–Lambert absorption per object-space unit, per channel. Default none. */
    absorption?: readonly [number, number, number];
    /** Internal reflections followed before a ray is let out. Default 3. */
    bounces?: number;
    /** Bisection steps for each exit. Default 10, or 6 with `inner`. */
    steps?: number;
    /** Environment blur (roughness) for the light seen through the solid. Default 0. */
    blur?: number;
    /** Reflect `solidOutside` at the surface too (Fresnel-weighted). Default true. */
    reflection?: boolean;
    /**
     * GLSL defining `vec3 solidNormal(vec3 p)`: the outward unit normal at a
     * surface point. Default: the SDF's gradient (four more evaluations).
     */
    normal?: string;
    /**
     * GLSL defining `vec3 solidBump(vec3 p, vec3 n)`: the normal at `p` given
     * the smooth one `n` — waves, hammered or melting surfaces too fine for
     * the mesh. Default `n`.
     */
    bump?: string;
    /**
     * GLSL defining `void solidInside(vec3 p, vec3 d, float len, int bounce, inout vec3 light, inout vec3 through)`,
     * called for each straight run inside (object space, from `p` along `d`
     * for `len`; `bounce` 0 is the run straight from the eye): add scattered
     * light, dim `through` — mist, bubbles, cracks.
     */
    inside?: string;
    /**
     * GLSL defining `vec3 solidOutside(vec3 position, vec3 direction)`: what a
     * ray sees once it leaves, in world space. Default
     * `solidEnvironment(direction, solidBlur)` (the material's environment map).
     * Also available: `vSolidOrigin` (the object's world position) and
     * `vSolidBasis` (object to world, with scale).
     */
    outside?: string;
    /** Uniforms the GLSL above declares. */
    uniforms?: Record<string, THREE.IUniform>;
}
export interface Solid {
    /** The solid's uniforms (`solidBounds`, `solidInner`, `solidIor`, `solidAbsorption`, `solidBlur`) and yours. */
    uniforms: Record<string, THREE.IUniform>;
}
export declare function refractiveSolid(material: THREE.MeshPhysicalMaterial, options: SolidOptions): Solid;
//# sourceMappingURL=solid.d.ts.map