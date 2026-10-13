/**
 * Narrow phase: contact points between boxes, spheres and planes. Every
 * function reports contacts through `emit(point, normal, depth)` with the
 * normal pointing from the first shape to the second and a positive
 * penetration depth; the receiver copies the values (they are scratch).
 *
 * Box–box contacts come from the separating axis test (15 axes) and, for a
 * face, from clipping the other box's most opposed face against it — so a
 * packet landing flat gets four contacts and rests, one hitting with a
 * corner gets one and spins.
 */
import { type Vec3 } from './math.js';
/** A box in world space: center, unit axes and half extents. */
export interface WorldBox {
    c: Vec3;
    u: [Vec3, Vec3, Vec3];
    e: [number, number, number];
}
export interface WorldSphere {
    c: Vec3;
    r: number;
}
export type Emit = (point: Vec3, normal: Vec3, depth: number) => void;
export declare function sphereSphere(a: WorldSphere, b: WorldSphere, emit: Emit): void;
/** Box against sphere; the normal points from the box to the sphere (or the other way with `flip`). */
export declare function boxSphere(box: WorldBox, s: WorldSphere, emit: Emit, flip?: boolean): void;
/** Plane `normal · x = offset` (free side along the normal) against a sphere. */
export declare function planeSphere(normal: Vec3, offset: number, s: WorldSphere, emit: Emit): void;
/** Plane against a box: its corners below the plane (up to four, spread out). */
export declare function planeBox(normal: Vec3, offset: number, b: WorldBox, emit: Emit): void;
export declare function boxBox(a: WorldBox, b: WorldBox, emit: Emit): void;
//# sourceMappingURL=collide.d.ts.map