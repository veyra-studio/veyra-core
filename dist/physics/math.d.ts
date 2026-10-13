/**
 * Small, allocation-free vector math for the physics: plain `{x, y, z}`
 * objects (so bodies can be read straight into any renderer's types) and
 * row-major 3×3 matrices in a `Float64Array`.
 */
export interface Vec3 {
    x: number;
    y: number;
    z: number;
}
export interface Quat {
    x: number;
    y: number;
    z: number;
    w: number;
}
export declare const vec3: (x?: number, y?: number, z?: number) => Vec3;
export declare const quat: (x?: number, y?: number, z?: number, w?: number) => Quat;
/** @internal */
export declare function set(out: Vec3, x: number, y: number, z: number): Vec3;
/** @internal */
export declare const copy: (out: Vec3, a: Vec3) => Vec3;
/** @internal */
export declare const add: (out: Vec3, a: Vec3, b: Vec3) => Vec3;
/** @internal */
export declare const sub: (out: Vec3, a: Vec3, b: Vec3) => Vec3;
/** @internal */
export declare const scale: (out: Vec3, a: Vec3, s: number) => Vec3;
/** `a + b·s` @internal */
export declare const addScaled: (out: Vec3, a: Vec3, b: Vec3, s: number) => Vec3;
/** @internal */
export declare const dot: (a: Vec3, b: Vec3) => number;
/** @internal */
export declare const length: (a: Vec3) => number;
/** `a × b` (safe when `out` is `a` or `b`). @internal */
export declare function cross(out: Vec3, a: Vec3, b: Vec3): Vec3;
/** Unit vector; `fallback` (default +y) for a zero vector. @internal */
export declare function normalize(out: Vec3, a: Vec3, fallback?: Vec3): Vec3;
/** Two unit vectors perpendicular to unit `n` and to each other. @internal */
export declare function tangents(n: Vec3, t1: Vec3, t2: Vec3): void;
/** @internal */
export type Mat3 = Float64Array;
/** @internal */
export declare const mat3: () => Mat3;
/** Rotation matrix of a unit quaternion: its columns are the body's axes in world space. @internal */
export declare function mat3FromQuat(out: Mat3, q: Quat): Mat3;
/** `m · v` @internal */
export declare function mulMat3(out: Vec3, m: Mat3, v: Vec3): Vec3;
/** `mᵀ · v` (world to local for a rotation). @internal */
export declare function mulMat3T(out: Vec3, m: Mat3, v: Vec3): Vec3;
/** Column `i` of `m` (a body axis). @internal */
export declare const column: (out: Vec3, m: Mat3, i: number) => Vec3;
/** `R · diag(d) · Rᵀ`: a world-space inverse inertia from principal values. @internal */
export declare function rotateDiagonal(out: Mat3, r: Mat3, d: Vec3): Mat3;
/** Integrates an orientation by angular velocity `w` over `h` seconds, then renormalizes. @internal */
export declare function integrateQuat(q: Quat, w: Vec3, h: number): Quat;
//# sourceMappingURL=math.d.ts.map