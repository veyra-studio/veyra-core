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
export async function warmUp(renderer, scene, camera) {
    await renderer.compileAsync(scene, camera);
    const target = renderer.getRenderTarget();
    const viewport = renderer.getViewport(new THREE.Vector4());
    const scissor = renderer.getScissor(new THREE.Vector4());
    const scissorTest = renderer.getScissorTest();
    const shadowsPending = renderer.shadowMap.needsUpdate;
    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, 1, 1);
    renderer.setScissor(0, 0, 1, 1);
    renderer.setScissorTest(true);
    renderer.shadowMap.needsUpdate = true;
    try {
        renderer.render(scene, camera);
    }
    finally {
        renderer.shadowMap.needsUpdate = shadowsPending;
        renderer.setScissorTest(scissorTest);
        renderer.setScissor(scissor);
        renderer.setViewport(viewport);
        renderer.setRenderTarget(target);
    }
}
//# sourceMappingURL=warm.js.map