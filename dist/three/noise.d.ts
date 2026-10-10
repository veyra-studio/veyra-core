/**
 * Noise baked into a texture. A shader that reads noise from a texture does a
 * few cached texture reads where per-pixel noise does dozens of hashes — the
 * difference between a full-screen terrain at 15 and at 60 frames per second
 * — and mipmaps filter distant detail instead of letting it shimmer. The
 * texture stores the noise's analytic gradient too, so bump mapping from it
 * stays smooth even where a texel covers several pixels. Sample it with
 * `tfbm` / `tfbmd` from `glslNoiseTexture` in `@veyra/core/glsl`.
 */
import * as THREE from 'three';
export interface TilingNoiseOptions {
    /** Texels per side, a power of two. Default `256`. */
    size?: number;
    /** Noise cells per side: how many features one tile holds. Default `8`. */
    cells?: number;
    /** Default `1`. */
    seed?: number;
}
export interface TilingNoise {
    size: number;
    cells: number;
    /**
     * RGBA, row-major; row 0 lies at texture coordinate v = 0. R: gradient (Perlin) noise in
     * `[-1, 1]`; G, B: its derivatives along x and y per tile (one tile = 1);
     * A: a second, independent noise in `[-1, 1]`.
     */
    data: Float32Array;
}
/**
 * Seamlessly tiling gradient noise with its analytic gradient, plus a second
 * independent layer. The lattice wraps every `cells` cells, so the right edge
 * continues into the left and the bottom into the top. Pure: runs in
 * workers and tests.
 */
export declare function tilingNoise(options?: TilingNoiseOptions): TilingNoise;
/**
 * A tiling noise texture for shaders: `tilingNoise` as half floats,
 * repeat-wrapped, with a box-filtered mip chain. `texture.userData.cells`
 * holds the cells per side, which `tfbm` needs.
 */
export declare function noiseTexture(options?: TilingNoiseOptions): THREE.DataTexture;
//# sourceMappingURL=noise.d.ts.map