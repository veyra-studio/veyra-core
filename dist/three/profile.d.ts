/**
 * Turned shapes from measured silhouettes: bottles, glasses, plates, bowls,
 * caps. A profile is a list of `[radius, height]` points from the bottom up,
 * the way you read them off a photograph. `Profile` smooths the outline,
 * samples it, offsets it (glass walls, liquids), measures volume, builds the
 * lathe geometry and builds bands for labels whose artwork keeps its
 * proportions on cones.
 *
 * ```ts
 * const outer = new Profile([[0, 0], [0.15, 0.01], [0.15, 0.5], [0.07, 0.9], [0.07, 1]], { corners: [1] })
 * const glass = new THREE.Mesh(outer.geometry(96), glassMaterial)
 * const liquid = outer.offset(0.01).clip(0.02, 0.85)
 * const label = outer.band({ from: 0.55, to: 0.72, arc: Math.PI * 0.8, lift: 0.001 })
 * ```
 */
import * as THREE from 'three';
export type ProfilePoint = readonly [radius: number, height: number];
export interface ProfileOptions {
    /** Interpolated points per input segment (centripetal Catmull-Rom). Default `6`; `1` keeps the polyline. */
    samples?: number;
    /** Indices of input points kept as sharp corners: a rim, a base edge. The first and last points always are. */
    corners?: readonly number[];
}
export interface BandOptions {
    /** Bottom of the band (height). */
    from: number;
    /** Top of the band (height). */
    to: number;
    /** Angle covered around the axis, in radians. Default `2π`. */
    arc?: number;
    /** Angle of the band's center line, in radians; `0` faces +z. Default `0`. */
    center?: number;
    /** Outward offset along the surface normal (a label's thickness). Default `0`. */
    lift?: number;
    /** Segments `[around, along]`. Default `[64, 24]`. */
    segments?: readonly [number, number];
}
export interface Band {
    /** The band's surface. `u` runs around the axis and is proportional to arc length; `v` runs up the outline. */
    geometry: THREE.BufferGeometry;
    /** Artwork width in profile units: the arc length of the band's widest row. */
    width: number;
    /** Artwork height in profile units: the outline length between `from` and `to`. */
    height: number;
    /**
     * Half the band's width at `v` (0 bottom … 1 top), in `u` units (`0…0.5`).
     * On a cone the band narrows where the radius shrinks; draw edge rules
     * along this line so they follow the cut edge of a real label.
     */
    halfWidthAt(v: number): number;
}
export declare class Profile {
    /** Smoothed outline, bottom up (`x` = radius, `y` = height). */
    readonly points: THREE.Vector2[];
    /** Outline length from the first point to each point. */
    private readonly lengths;
    constructor(points: readonly ProfilePoint[] | readonly THREE.Vector2[], options?: ProfileOptions);
    /** Lowest and highest point of the outline. */
    get bounds(): {
        min: number;
        max: number;
        radius: number;
    };
    /** Total outline length. */
    get length(): number;
    /**
     * Index of the first segment, from the bottom, that spans height `h` going
     * up, and the interpolation factor within it. `null` when no rising
     * segment reaches `h`.
     */
    private locate;
    /** Radius at height `h` on the first rising span from the bottom. `0` outside the outline. */
    radiusAt(h: number): number;
    /** `dr/dh` at height `h` (negative where the outline narrows going up). */
    slopeAt(h: number): number;
    /** Outline length from the bottom to height `h` (on the first rising span). */
    lengthAt(h: number): number;
    /**
     * The outline moved along its normal: positive `distance` moves inward
     * (a glass wall's inside, a liquid inside the glass). Radii are clamped
     * at the axis.
     */
    offset(distance: number): Profile;
    /**
     * The part of the outline between two heights, closed to the axis at both
     * ends — the solid a liquid fills, for instance. Follows the first rising
     * spans from the bottom.
     */
    clip(from: number, to: number, options?: {
        closeBottom?: boolean;
        closeTop?: boolean;
    }): Profile;
    /**
     * Volume of the solid of revolution between two heights, in cubed profile
     * units, using the first rising spans (an inner profile gives capacity).
     */
    volume(from?: number, to?: number): number;
    /** The lathe geometry of the outline. */
    geometry(segments?: number, phiStart?: number, phiLength?: number): THREE.LatheGeometry;
    /**
     * A band of the surface between two heights, for labels and sleeves.
     * Texture coordinates are proportional to arc length around the axis and
     * to outline length along it, so artwork drawn at `width × height` keeps
     * its proportions even on a cone, while the band's edges follow the axis
     * (the cut of a real label on a tapered bottle).
     */
    band(options: BandOptions): Band;
}
//# sourceMappingURL=profile.d.ts.map