export interface CondensationOptions {
    /** Texture size in pixels (square, tileable). Default `512`. */
    size?: number;
    /** Seed. Default `1`. */
    seed?: number;
    /** Visible drops per texture. Default `size² / 900`. */
    droplets?: number;
    /** Drop radius range in pixels. Default `[size / 256, size / 36]`. */
    radius?: readonly [number, number];
    /** Share of large drops that ran down, clearing a track. Default `0.08`. */
    runs?: number;
    /** Mist density `0…1`: the frosting between drops. Default `0.6`. */
    mist?: number;
}
export interface CondensationField {
    size: number;
    /** Surface height `0…1` per pixel (row-major, y down): drops are lenses. */
    height: Float32Array;
    /** Mist `0…1` per pixel: 0 on drops and run tracks (clear), `mist` elsewhere. */
    mist: Float32Array;
}
export interface CondensationMaps {
    /** Tangent-space normal map (OpenGL convention, +y up). */
    normal: HTMLCanvasElement;
    /**
     * Roughness map: smooth on drops and tracks, rough in the mist. Values
     * are written to every channel (three.js reads green for roughness).
     */
    roughness: HTMLCanvasElement;
}
/** Computes the condensation height and mist fields. */
export declare function condensationField(options?: CondensationOptions): CondensationField;
/** Draws condensation into a normal map and a roughness map. */
export declare function condensationMaps(options?: CondensationOptions & {
    /** Normal strength. Default `3`. */
    strength?: number;
    /** Roughness on drops and tracks, and in full mist. Default `[0.04, 0.5]`. */
    roughness?: readonly [clear: number, mist: number];
}): CondensationMaps;
//# sourceMappingURL=condensation.d.ts.map