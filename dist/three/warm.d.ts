/**
 * Prepares a scene before it is first shown, so the frame that first shows
 * it doesn't stall: its shader programs compile in parallel where the
 * browser allows (`KHR_parallel_shader_compile`), then it is drawn once
 * into a single pixel of the canvas — uploading its textures and geometry,
 * and building what three.js only builds while drawing (shadow maps and
 * their depth programs, the transmission target). The next frame redraws
 * the canvas.
 *
 * ```ts
 * const table = await createTable(renderer)
 * await warmUp(renderer, table.scene, table.camera)   // while the visitor reads the page above
 * ```
 */
import * as THREE from 'three';
export declare function warmUp(renderer: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera): Promise<void>;
//# sourceMappingURL=warm.d.ts.map