/**
 * Light rigid-body physics: boxes and spheres (alone or as a compound),
 * planes, gravity or none, sub-stepped sequential impulses with friction and
 * bounce. Made for a page's worth of bodies — floating packets that knock
 * into each other, a balloon bouncing off the headlines — not thousands.
 * Units are yours: CSS pixels through a pixel camera work as well as metres.
 *
 * ```ts
 * const physics = new PhysicsWorld({ gravity: vec3(0, -1800, 0), slop: 0.5 })
 * const card = physics.add({ shape: { type: 'box', half: vec3(80, 50, 4) }, position: vec3(0, 300, 0) })
 * physics.addPlane(vec3(0, 1, 0), -400) // a floor at y = -400
 * stage.onFrame((frame) => physics.step(frame.delta))
 * ```
 */
import { type Mat3, type Quat, type Vec3 } from './math.js';
import { type WorldBox, type WorldSphere } from './collide.js';
export type BodyKind = 'dynamic' | 'kinematic' | 'static';
/** A collision shape; `offset` places it in the body's frame (the body's origin is its center of mass). */
export type Shape = {
    type: 'box';
    half: Vec3;
    offset?: Vec3;
} | {
    type: 'sphere';
    radius: number;
    offset?: Vec3;
};
export interface BodyOptions<T = unknown> {
    /** One shape, or `shapes` for a compound body. Shapes can be resized later (mutate them). */
    shape?: Shape;
    shapes?: Shape[];
    /**
     * Default `'dynamic'`. Kinematic bodies move only as you set them — give
     * them a `velocity` so what they hit responds to it; static ones never move.
     */
    kind?: BodyKind;
    /** Default `1`. */
    mass?: number;
    position?: Vec3;
    quaternion?: Quat;
    velocity?: Vec3;
    angularVelocity?: Vec3;
    /** Bounciness `0…1`; a contact uses the larger of its two. Default `0.3`. */
    restitution?: number;
    /** Coulomb friction; a contact uses the geometric mean. Default `0.4`. */
    friction?: number;
    /** Velocity lost per second, as an exponential rate. Default `0`. */
    linearDamping?: number;
    /** Default `0`. */
    angularDamping?: number;
    /** Principal moments of inertia; by default derived from the shapes (and kept in step as they resize). */
    inertia?: Vec3;
    /** Bodies collide when each one's `group` is in the other's `mask`. Defaults: `1`, every group. */
    group?: number;
    mask?: number;
    userData?: T;
}
export declare class Body<T = unknown> {
    readonly id: number;
    kind: BodyKind;
    readonly shapes: Shape[];
    readonly position: Vec3;
    readonly quaternion: Quat;
    readonly velocity: Vec3;
    readonly angularVelocity: Vec3;
    mass: number;
    restitution: number;
    friction: number;
    linearDamping: number;
    angularDamping: number;
    inertia: Vec3 | null;
    group: number;
    mask: number;
    /** Left out of the simulation while `false`. */
    enabled: boolean;
    userData: T;
    /** @internal */ readonly force: Vec3;
    /** @internal */ readonly torque: Vec3;
    /** @internal */ readonly rotation: Mat3;
    /** @internal */ readonly invInertia: Vec3;
    /** @internal */ readonly invInertiaWorld: Mat3;
    /** @internal */ invMass: number;
    /** @internal */ readonly boxes: WorldBox[];
    /** @internal */ readonly spheres: WorldSphere[];
    /** @internal */ readonly min: Vec3;
    /** @internal */ readonly max: Vec3;
    constructor(options: BodyOptions<T>);
    get dynamic(): boolean;
    /** Adds a force (and its torque about the center when applied at a world `point`) for the next step. */
    applyForce(f: Vec3, point?: Vec3): this;
    applyTorque(t: Vec3): this;
    /** Changes the velocity right away, as a blow at a world `point` (or at the center). */
    applyImpulse(j: Vec3, point?: Vec3): this;
    /** @internal Rotation, mass properties, world shapes and bounds from the current state. */
    update(): void;
}
/** A static boundary `normal · x = offset`; bodies are kept on the side the normal points to. */
export interface Plane<T = unknown> {
    readonly id: number;
    /** Unit normal, pointing to the free side. */
    readonly normal: Vec3;
    offset: number;
    restitution: number;
    friction: number;
    group: number;
    mask: number;
    enabled: boolean;
    userData: T;
}
export interface ContactEvent {
    /** The first body, or the plane. */
    a: Body | Plane;
    b: Body;
    /** Normal impulse over the step (mass × speed): how hard they met. */
    impulse: number;
    /** Speed at which they closed in along the normal. */
    speed: number;
    /** The deepest contact point and the normal (from `a` to `b`), in world space. Scratch: copy to keep. */
    point: Vec3;
    normal: Vec3;
    /** The first step of this touch. */
    began: boolean;
}
export interface PhysicsOptions {
    /** Default: none (zero gravity). */
    gravity?: Vec3;
    /** Steps per `step(dt)`: more keeps fast, thin bodies from passing through each other. Default `2`. */
    substeps?: number;
    /** Solver passes per substep. Default `8`. */
    iterations?: number;
    /** Penetration left alone (world units) so resting contacts don't jitter. Default `0.01`. */
    slop?: number;
    /** Share of the remaining penetration pushed out per substep. Default `0.2`. */
    correction?: number;
    /** Fastest positional correction (units per second). Default: no limit. */
    maxCorrection?: number;
    /** Contacts closing slower than this don't bounce (units per second). Default `1`. */
    bounceThreshold?: number;
}
export declare class PhysicsWorld {
    readonly bodies: Body<any>[];
    readonly planes: Plane<any>[];
    gravity: Vec3;
    substeps: number;
    iterations: number;
    slop: number;
    correction: number;
    maxCorrection: number;
    bounceThreshold: number;
    private readonly pool;
    private count;
    private readonly listeners;
    private touches;
    private touching;
    private planeIds;
    private h;
    private readonly event;
    constructor(options?: PhysicsOptions);
    add<T = unknown>(options: BodyOptions<T>): Body<T>;
    remove(body: Body<any>): void;
    addPlane<T = unknown>(normal: Vec3, offset: number, options?: Partial<Omit<Plane<T>, 'id' | 'normal' | 'offset'>>): Plane<T>;
    removePlane(plane: Plane<any>): void;
    /** Called after each step for every pair in contact. Returns an unsubscribe function. */
    onContact(listener: (contact: ContactEvent) => void): () => void;
    /**
     * Advances by `dt` seconds in `substeps` equal steps. `forces(h)` runs
     * before each of them: apply forces that depend on where bodies are
     * (springs, fields) there; forces applied outside last one substep.
     */
    step(dt: number, forces?: (h: number) => void): void;
    private collide;
    private addConstraint;
    private effectiveMass;
    /** Velocity of b's contact point relative to a's. */
    private relativeVelocity;
    private applyImpulse;
    private solve;
    /** Sums each pair's impulses over the step and keeps its deepest point. */
    private gather;
    private emit;
}
//# sourceMappingURL=world.d.ts.map