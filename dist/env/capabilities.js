/**
 * Capability detection that needs no renderer.
 */
let webgl2 = null;
/** True when a WebGL2 context can be created (checked once, then cached). */
export function supportsWebGL2() {
    if (webgl2 !== null)
        return webgl2;
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2');
        webgl2 = !!gl;
        // Release the probe context right away.
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
    }
    catch {
        webgl2 = false;
    }
    return webgl2;
}
/**
 * True when a WebGL context is rendered in software — SwiftShader, llvmpipe,
 * the Microsoft Basic Render Driver: no GPU, so a heavy shader takes seconds
 * per frame. Reads the unmasked renderer name only where the plain one is
 * hidden (Chrome, Safari); Firefox reports it directly.
 */
export function isSoftwareRenderer(gl) {
    try {
        let name = String(gl.getParameter(gl.RENDERER) ?? '');
        if (/^webkit webgl$/i.test(name)) {
            const info = gl.getExtension('WEBGL_debug_renderer_info');
            if (info)
                name = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '');
        }
        return /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen/i.test(name);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=capabilities.js.map