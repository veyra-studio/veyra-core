export interface FbmOptions {
    /** Number of layered octaves. Default `4`. */
    octaves?: number;
    /** Frequency multiplier per octave. Default `2`. */
    lacunarity?: number;
    /** Amplitude multiplier per octave. Default `0.5`. */
    gain?: number;
}
export interface Noise {
    noise2(x: number, y: number): number;
    noise3(x: number, y: number, z: number): number;
    /** Fractal (layered) 2D noise, normalized to `[-1, 1]`. */
    fbm2(x: number, y: number, options?: FbmOptions): number;
    /** Fractal (layered) 3D noise, normalized to `[-1, 1]`. */
    fbm3(x: number, y: number, z: number, options?: FbmOptions): number;
}
/** Creates a noise generator with its own permutation table. */
export declare function createNoise(seed?: number): Noise;
/** 2D gradient noise from the shared generator (seed `1`). */
export declare function noise2(x: number, y: number): number;
/** 3D gradient noise from the shared generator (seed `1`). */
export declare function noise3(x: number, y: number, z: number): number;
/** Fractal 2D noise from the shared generator. */
export declare function fbm2(x: number, y: number, options?: FbmOptions): number;
/** Fractal 3D noise from the shared generator. */
export declare function fbm3(x: number, y: number, z: number, options?: FbmOptions): number;
//# sourceMappingURL=noise.d.ts.map