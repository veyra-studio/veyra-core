/**
 * Capability detection that needs no renderer.
 */
/** True when a WebGL2 context can be created (checked once, then cached). */
export declare function supportsWebGL2(): boolean;
/**
 * True when a WebGL context is rendered in software — SwiftShader, llvmpipe,
 * the Microsoft Basic Render Driver: no GPU, so a heavy shader takes seconds
 * per frame. Reads the unmasked renderer name only where the plain one is
 * hidden (Chrome, Safari); Firefox reports it directly.
 */
export declare function isSoftwareRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean;
//# sourceMappingURL=capabilities.d.ts.map