export interface HeightfieldOptions {
    /** World size `[width (x), depth (z)]`, centered on the origin. */
    size: readonly [number, number];
    /** Samples per side (or `[x, z]`). */
    resolution: number | readonly [number, number];
    /** Height at a world position. */
    height?: (x: number, z: number) => number;
    /** Precomputed heights (row-major), e.g. from a worker, instead of `height`. */
    heights?: Float32Array;
}
export interface Heightfield {
    readonly size: readonly [number, number];
    readonly nx: number;
    readonly nz: number;
    /** Heights, row-major (z rows of x samples). */
    readonly heights: Float32Array;
    readonly min: number;
    readonly max: number;
    /** Bilinear height at a world position (clamped at the edges). */
    sample(x: number, z: number): number;
    /** Bilinear lookup of any per-sample data (baked light, masks) at a world position. */
    bilinear(data: ArrayLike<number>, x: number, z: number): number;
    /** Surface normal at a world position (central differences). */
    normal(x: number, z: number, out?: [number, number, number]): [number, number, number];
    /** World position of grid sample `(i, j)`. */
    position(i: number, j: number): [x: number, z: number];
}
/** Samples a height function on a regular grid. */
export declare function heightfield(options: HeightfieldOptions): Heightfield;
/**
 * Value noise with analytic derivatives, layered so that steep places get
 * less fine detail — the look of erosion (after Iñigo Quilez's terrain).
 * Returns roughly `[0, 1]`.
 */
export declare function erodedNoise(x: number, z: number, options?: {
    octaves?: number;
    seed?: number;
    sharpness?: number;
}): number;
/** Ridged multifractal noise in `[0, 1]`: sharp crests, soft valleys. */
export declare function ridgedNoise(x: number, z: number, options?: {
    octaves?: number;
    seed?: number;
}): number;
/** 2D value noise in `[0, 1]` with its derivatives `[n, dn/dx, dn/dz]`. */
export declare function valueNoiseD(x: number, z: number, seed?: number): [number, number, number];
/**
 * Sunlight per sample `0…1`: 0 where the sun is below the horizon seen from
 * that point (a mountain is in the way), softened near shadow edges.
 * `sun` is a direction toward the sun (any length); y is up.
 */
export declare function bakeSunlight(field: Heightfield, sun: readonly [number, number, number], options?: {
    steps?: number;
    softness?: number;
}): Float32Array;
/**
 * Ambient occlusion per sample `0…1`: how open the sky is, from the
 * horizon angle in several directions.
 */
export declare function bakeOcclusion(field: Heightfield, options?: {
    directions?: number;
    steps?: number;
    radius?: number;
}): Float32Array;
export interface HeightfieldMeshOptions {
    /** Grid segments `[x, z]` (or one number for both). Default: one per field sample. */
    segments?: number | readonly [number, number];
    /** Maps the unit grid (`u`, `v` in `0…1`) to world `[x, z]`. Default: the field's full extent. */
    layout?: (u: number, v: number) => readonly [x: number, z: number];
    /** Per-sample arrays (same length as the field) to resample at the mesh's vertices. */
    attributes?: Readonly<Record<string, ArrayLike<number>>>;
}
export interface HeightfieldMesh {
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    indices: Uint32Array;
    /** The resampled `attributes`, one value per vertex. */
    attributes: Record<string, Float32Array>;
}
/**
 * Vertex data for a grid that samples a height field — plain typed arrays,
 * so it can be built in a worker and transferred. `@veyra/core/three` wraps
 * it as `heightfieldGeometry`.
 */
export declare function heightfieldMesh(field: Heightfield, options?: HeightfieldMeshOptions): HeightfieldMesh;
//# sourceMappingURL=terrain.d.ts.map