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
import { type Heightfield, type HeightfieldMesh, type HeightfieldMeshOptions } from '../core/terrain.js';
export type HeightfieldGeometryOptions = HeightfieldMeshOptions;
/** Builds a `BufferGeometry` from mesh arrays (from `heightfieldMesh`, possibly made in a worker). */
export declare function meshGeometry(mesh: HeightfieldMesh): THREE.BufferGeometry;
export declare function heightfieldGeometry(field: Heightfield, options?: HeightfieldGeometryOptions): THREE.BufferGeometry;
//# sourceMappingURL=terrain.d.ts.map