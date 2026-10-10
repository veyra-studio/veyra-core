/**
 * Meshes for procedural terrain (`heightfield` from `@veyra/core`): a grid
 * that samples the field, optionally laid out unevenly — dense near the
 * camera, sparse toward the horizon — with smooth normals and any baked
 * per-sample data (sunlight, occlusion, masks) carried as vertex attributes.
 *
 * ```ts
 * const geometry = heightfieldGeometry(field, {
 *   segments: [256, 256],
 *   layout: (u, v) => [(u - 0.5) * 8000, -4000 + 8000 * v ** 2],   // dense at v = 0
 *   attributes: { aSun: bakeSunlight(field, sun), aOcclusion: bakeOcclusion(field) },
 * })
 * ```
 *
 * Heavy bakes can run in a worker with `heightfieldMesh` (core) and come
 * back as typed arrays: `meshGeometry(data)` turns them into geometry.
 */
import * as THREE from 'three';
import { heightfieldMesh } from '../core/terrain.js';
/** Builds a `BufferGeometry` from mesh arrays (from `heightfieldMesh`, possibly made in a worker). */
export function meshGeometry(mesh) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(mesh.uvs, 2));
    for (const [name, data] of Object.entries(mesh.attributes))
        geometry.setAttribute(name, new THREE.BufferAttribute(data, 1));
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    geometry.computeBoundingSphere();
    return geometry;
}
export function heightfieldGeometry(field, options = {}) {
    return meshGeometry(heightfieldMesh(field, options));
}
//# sourceMappingURL=terrain.js.map