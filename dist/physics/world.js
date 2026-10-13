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
import { addScaled, column, copy, cross, dot, integrateQuat, mat3, mat3FromQuat, mulMat3, quat, rotateDiagonal, scale, set, sub, tangents, vec3, } from './math.js';
import { boxBox, boxSphere, planeBox, planeSphere, sphereSphere } from './collide.js';
let ids = 0;
export class Body {
    id = ++ids;
    kind;
    shapes;
    position;
    quaternion;
    velocity;
    angularVelocity;
    mass;
    restitution;
    friction;
    linearDamping;
    angularDamping;
    inertia;
    group;
    mask;
    /** Left out of the simulation while `false`. */
    enabled = true;
    userData;
    /** @internal */ force = vec3();
    /** @internal */ torque = vec3();
    /** @internal */ rotation = mat3();
    /** @internal */ invInertia = vec3();
    /** @internal */ invInertiaWorld = mat3();
    /** @internal */ invMass = 0;
    /** @internal */ boxes = [];
    /** @internal */ spheres = [];
    /** @internal */ min = vec3();
    /** @internal */ max = vec3();
    constructor(options) {
        this.shapes = options.shapes ?? (options.shape ? [options.shape] : []);
        if (this.shapes.length === 0)
            throw new Error('[veyra] a body needs a shape');
        this.kind = options.kind ?? 'dynamic';
        this.mass = options.mass ?? 1;
        this.position = options.position ?? vec3();
        this.quaternion = options.quaternion ?? quat();
        this.velocity = options.velocity ?? vec3();
        this.angularVelocity = options.angularVelocity ?? vec3();
        this.restitution = options.restitution ?? 0.3;
        this.friction = options.friction ?? 0.4;
        this.linearDamping = options.linearDamping ?? 0;
        this.angularDamping = options.angularDamping ?? 0;
        this.inertia = options.inertia ?? null;
        this.group = options.group ?? 1;
        this.mask = options.mask ?? 0xffffffff;
        this.userData = options.userData;
        for (const s of this.shapes) {
            if (s.type === 'box')
                this.boxes.push({ c: vec3(), u: [vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1)], e: [0, 0, 0] });
            else
                this.spheres.push({ c: vec3(), r: 0 });
        }
        this.update();
    }
    get dynamic() {
        return this.kind === 'dynamic' && this.mass > 0;
    }
    /** Adds a force (and its torque about the center when applied at a world `point`) for the next step. */
    applyForce(f, point) {
        addScaled(this.force, this.force, f, 1);
        if (point) {
            sub(T1, point, this.position);
            addScaled(this.torque, this.torque, cross(T1, T1, f), 1);
        }
        return this;
    }
    applyTorque(t) {
        addScaled(this.torque, this.torque, t, 1);
        return this;
    }
    /** Changes the velocity right away, as a blow at a world `point` (or at the center). */
    applyImpulse(j, point) {
        if (!this.dynamic)
            return this;
        this.update();
        addScaled(this.velocity, this.velocity, j, this.invMass);
        if (point) {
            sub(T1, point, this.position);
            cross(T1, T1, j);
            addScaled(this.angularVelocity, this.angularVelocity, mulMat3(T1, this.invInertiaWorld, T1), 1);
        }
        return this;
    }
    /** @internal Rotation, mass properties, world shapes and bounds from the current state. */
    update() {
        const r = mat3FromQuat(this.rotation, this.quaternion);
        if (this.dynamic) {
            this.invMass = 1 / this.mass;
            const i = this.inertia ?? shapeInertia(this.shapes, this.mass, T2);
            set(this.invInertia, i.x > 0 ? 1 / i.x : 0, i.y > 0 ? 1 / i.y : 0, i.z > 0 ? 1 / i.z : 0);
            rotateDiagonal(this.invInertiaWorld, r, this.invInertia);
        }
        else {
            this.invMass = 0;
            set(this.invInertia, 0, 0, 0);
            this.invInertiaWorld.fill(0);
        }
        set(this.min, Infinity, Infinity, Infinity);
        set(this.max, -Infinity, -Infinity, -Infinity);
        let bi = 0;
        let si = 0;
        for (const shape of this.shapes) {
            const c = shape.type === 'box' ? this.boxes[bi].c : this.spheres[si].c;
            if (shape.offset)
                addScaled(c, this.position, mulMat3(c, r, shape.offset), 1);
            else
                copy(c, this.position);
            let ex;
            let ey;
            let ez;
            if (shape.type === 'box') {
                const box = this.boxes[bi++];
                column(box.u[0], r, 0);
                column(box.u[1], r, 1);
                column(box.u[2], r, 2);
                const h = shape.half;
                box.e[0] = h.x;
                box.e[1] = h.y;
                box.e[2] = h.z;
                ex = Math.abs(r[0]) * h.x + Math.abs(r[1]) * h.y + Math.abs(r[2]) * h.z;
                ey = Math.abs(r[3]) * h.x + Math.abs(r[4]) * h.y + Math.abs(r[5]) * h.z;
                ez = Math.abs(r[6]) * h.x + Math.abs(r[7]) * h.y + Math.abs(r[8]) * h.z;
            }
            else {
                const sphere = this.spheres[si++];
                sphere.r = shape.radius;
                ex = ey = ez = shape.radius;
            }
            this.min.x = Math.min(this.min.x, c.x - ex);
            this.min.y = Math.min(this.min.y, c.y - ey);
            this.min.z = Math.min(this.min.z, c.z - ez);
            this.max.x = Math.max(this.max.x, c.x + ex);
            this.max.y = Math.max(this.max.y, c.y + ey);
            this.max.z = Math.max(this.max.z, c.z + ez);
        }
    }
}
/** Principal moments of a compound of solid shapes sharing `mass` by volume (offsets by the parallel axis rule). */
function shapeInertia(shapes, mass, out) {
    let volume = 0;
    for (const s of shapes)
        volume += s.type === 'box' ? 8 * s.half.x * s.half.y * s.half.z : (4 / 3) * Math.PI * s.radius ** 3;
    set(out, 0, 0, 0);
    for (const s of shapes) {
        const v = s.type === 'box' ? 8 * s.half.x * s.half.y * s.half.z : (4 / 3) * Math.PI * s.radius ** 3;
        const m = volume > 0 ? (mass * v) / volume : mass / shapes.length;
        if (s.type === 'box') {
            const { x, y, z } = s.half;
            out.x += (m * (y * y + z * z)) / 3;
            out.y += (m * (x * x + z * z)) / 3;
            out.z += (m * (x * x + y * y)) / 3;
        }
        else {
            const i = 0.4 * m * s.radius * s.radius;
            out.x += i;
            out.y += i;
            out.z += i;
        }
        const o = s.offset;
        if (o) {
            out.x += m * (o.y * o.y + o.z * o.z);
            out.y += m * (o.x * o.x + o.z * o.z);
            out.z += m * (o.x * o.x + o.y * o.y);
        }
    }
    return out;
}
const T1 = vec3();
const T2 = vec3();
const T3 = vec3();
const V = vec3();
export class PhysicsWorld {
    bodies = [];
    planes = [];
    gravity;
    substeps;
    iterations;
    slop;
    correction;
    maxCorrection;
    bounceThreshold;
    pool = [];
    count = 0;
    listeners = new Set();
    touches = new Map();
    touching = new Set();
    planeIds = 0;
    h = 1 / 60;
    event = { a: null, b: null, impulse: 0, speed: 0, point: vec3(), normal: vec3(), began: false };
    constructor(options = {}) {
        this.gravity = options.gravity ?? vec3();
        this.substeps = options.substeps ?? 2;
        this.iterations = options.iterations ?? 8;
        this.slop = options.slop ?? 0.01;
        this.correction = options.correction ?? 0.2;
        this.maxCorrection = options.maxCorrection ?? Infinity;
        this.bounceThreshold = options.bounceThreshold ?? 1;
    }
    add(options) {
        const body = new Body(options);
        this.bodies.push(body);
        return body;
    }
    remove(body) {
        const i = this.bodies.indexOf(body);
        if (i >= 0)
            this.bodies.splice(i, 1);
    }
    addPlane(normal, offset, options = {}) {
        const n = vec3();
        const l = Math.hypot(normal.x, normal.y, normal.z) || 1;
        scale(n, normal, 1 / l);
        const plane = {
            id: ++this.planeIds,
            normal: n,
            offset,
            restitution: options.restitution ?? 0.3,
            friction: options.friction ?? 0.4,
            group: options.group ?? 1,
            mask: options.mask ?? 0xffffffff,
            enabled: options.enabled ?? true,
            userData: options.userData,
        };
        this.planes.push(plane);
        return plane;
    }
    removePlane(plane) {
        const i = this.planes.indexOf(plane);
        if (i >= 0)
            this.planes.splice(i, 1);
    }
    /** Called after each step for every pair in contact. Returns an unsubscribe function. */
    onContact(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    /**
     * Advances by `dt` seconds in `substeps` equal steps. `forces(h)` runs
     * before each of them: apply forces that depend on where bodies are
     * (springs, fields) there; forces applied outside last one substep.
     */
    step(dt, forces) {
        if (!(dt > 0))
            return;
        const steps = Math.max(1, Math.round(this.substeps));
        const h = (this.h = dt / steps);
        this.touches.clear();
        for (let s = 0; s < steps; s++) {
            forces?.(h);
            for (const body of this.bodies) {
                if (!body.enabled)
                    continue;
                body.update();
                if (body.dynamic) {
                    addScaled(body.velocity, body.velocity, this.gravity, h);
                    addScaled(body.velocity, body.velocity, body.force, h * body.invMass);
                    addScaled(body.angularVelocity, body.angularVelocity, mulMat3(T1, body.invInertiaWorld, body.torque), h);
                    if (body.linearDamping > 0)
                        scale(body.velocity, body.velocity, Math.exp(-body.linearDamping * h));
                    if (body.angularDamping > 0)
                        scale(body.angularVelocity, body.angularVelocity, Math.exp(-body.angularDamping * h));
                }
                set(body.force, 0, 0, 0);
                set(body.torque, 0, 0, 0);
            }
            this.collide();
            for (let it = 0; it < this.iterations; it++)
                for (let i = 0; i < this.count; i++)
                    this.solve(this.pool[i]);
            this.gather();
            for (const body of this.bodies) {
                if (!body.enabled || !body.dynamic)
                    continue;
                addScaled(body.position, body.position, body.velocity, h);
                integrateQuat(body.quaternion, body.angularVelocity, h);
            }
        }
        this.emit();
    }
    collide() {
        this.count = 0;
        const bodies = this.bodies;
        for (let i = 0; i < bodies.length; i++) {
            const a = bodies[i];
            if (!a.enabled)
                continue;
            for (let j = i + 1; j < bodies.length; j++) {
                const b = bodies[j];
                if (!b.enabled || (!a.dynamic && !b.dynamic))
                    continue;
                if (!(a.group & b.mask) || !(b.group & a.mask))
                    continue;
                if (a.max.x < b.min.x || b.max.x < a.min.x || a.max.y < b.min.y || b.max.y < a.min.y || a.max.z < b.min.z || b.max.z < a.min.z)
                    continue;
                const emit = (p, n, d) => this.addConstraint(a, b, null, p, n, d);
                for (const ba of a.boxes) {
                    for (const bb of b.boxes)
                        boxBox(ba, bb, emit);
                    for (const sb of b.spheres)
                        boxSphere(ba, sb, emit);
                }
                for (const sa of a.spheres) {
                    for (const bb of b.boxes)
                        boxSphere(bb, sa, emit, true);
                    for (const sb of b.spheres)
                        sphereSphere(sa, sb, emit);
                }
            }
        }
        for (const plane of this.planes) {
            if (!plane.enabled)
                continue;
            const n = plane.normal;
            for (const b of bodies) {
                if (!b.enabled || !b.dynamic || !(plane.group & b.mask) || !(b.group & plane.mask))
                    continue;
                // The bounds' lowest corner along the normal.
                const low = (n.x > 0 ? b.min.x : b.max.x) * n.x + (n.y > 0 ? b.min.y : b.max.y) * n.y + (n.z > 0 ? b.min.z : b.max.z) * n.z;
                if (low > plane.offset)
                    continue;
                const emit = (p, nn, d) => this.addConstraint(null, b, plane, p, nn, d);
                for (const box of b.boxes)
                    planeBox(n, plane.offset, box, emit);
                for (const sphere of b.spheres)
                    planeSphere(n, plane.offset, sphere, emit);
            }
        }
    }
    addConstraint(a, b, plane, point, normal, depth) {
        let c = this.pool[this.count];
        if (!c) {
            c = { a, b, plane, key: 0, point: vec3(), normal: vec3(), rA: vec3(), rB: vec3(), t1: vec3(), t2: vec3(), depth: 0, massN: 0, massT1: 0, massT2: 0, target: 0, bias: 0, friction: 0, jn: 0, jt1: 0, jt2: 0, approach: 0 };
            this.pool.push(c);
        }
        this.count++;
        c.a = a;
        c.b = b;
        c.plane = plane;
        c.key = a ? a.id * 1048576 + b.id : -(plane.id * 1048576 + b.id);
        copy(c.point, point);
        copy(c.normal, normal);
        if (a)
            sub(c.rA, point, a.position);
        else
            set(c.rA, 0, 0, 0);
        sub(c.rB, point, b.position);
        tangents(c.normal, c.t1, c.t2);
        c.depth = depth;
        c.massN = this.effectiveMass(c, c.normal);
        c.massT1 = this.effectiveMass(c, c.t1);
        c.massT2 = this.effectiveMass(c, c.t2);
        const vn = dot(this.relativeVelocity(c), c.normal);
        c.approach = Math.max(0, -vn);
        const restitution = Math.max(a ? a.restitution : plane.restitution, b.restitution);
        c.target = vn < -this.bounceThreshold ? -restitution * vn : 0;
        c.bias = Math.min(this.maxCorrection, (this.correction / this.h) * Math.max(0, depth - this.slop));
        c.friction = Math.sqrt(Math.max(0, (a ? a.friction : plane.friction) * b.friction));
        c.jn = c.jt1 = c.jt2 = 0;
    }
    effectiveMass(c, dir) {
        let k = c.b.invMass;
        cross(T2, c.rB, dir);
        k += dot(T2, mulMat3(T3, c.b.invInertiaWorld, T2));
        if (c.a) {
            k += c.a.invMass;
            cross(T2, c.rA, dir);
            k += dot(T2, mulMat3(T3, c.a.invInertiaWorld, T2));
        }
        return k > 1e-12 ? 1 / k : 0;
    }
    /** Velocity of b's contact point relative to a's. */
    relativeVelocity(c) {
        cross(V, c.b.angularVelocity, c.rB);
        addScaled(V, V, c.b.velocity, 1);
        if (c.a) {
            cross(T1, c.a.angularVelocity, c.rA);
            addScaled(T1, T1, c.a.velocity, 1);
            sub(V, V, T1);
        }
        return V;
    }
    applyImpulse(c, dir, j) {
        const b = c.b;
        if (b.invMass > 0) {
            addScaled(b.velocity, b.velocity, dir, j * b.invMass);
            cross(T2, c.rB, dir);
            addScaled(b.angularVelocity, b.angularVelocity, mulMat3(T3, b.invInertiaWorld, T2), j);
        }
        const a = c.a;
        if (a && a.invMass > 0) {
            addScaled(a.velocity, a.velocity, dir, -j * a.invMass);
            cross(T2, c.rA, dir);
            addScaled(a.angularVelocity, a.angularVelocity, mulMat3(T3, a.invInertiaWorld, T2), -j);
        }
    }
    solve(c) {
        if (c.friction > 0 && c.jn > 0) {
            const limit = c.friction * c.jn;
            let old = c.jt1;
            c.jt1 = Math.max(-limit, Math.min(limit, old - c.massT1 * dot(this.relativeVelocity(c), c.t1)));
            this.applyImpulse(c, c.t1, c.jt1 - old);
            old = c.jt2;
            c.jt2 = Math.max(-limit, Math.min(limit, old - c.massT2 * dot(this.relativeVelocity(c), c.t2)));
            this.applyImpulse(c, c.t2, c.jt2 - old);
        }
        const vn = dot(this.relativeVelocity(c), c.normal);
        const old = c.jn;
        c.jn = Math.max(0, old + c.massN * (Math.max(c.target, c.bias) - vn));
        this.applyImpulse(c, c.normal, c.jn - old);
    }
    /** Sums each pair's impulses over the step and keeps its deepest point. */
    gather() {
        for (let i = 0; i < this.count; i++) {
            const c = this.pool[i];
            let touch = this.touches.get(c.key);
            if (!touch) {
                touch = { a: c.a ?? c.plane, b: c.b, impulse: 0, speed: 0, depth: -Infinity, point: vec3(), normal: vec3() };
                this.touches.set(c.key, touch);
            }
            touch.impulse += c.jn;
            touch.speed = Math.max(touch.speed, c.approach);
            if (c.depth > touch.depth) {
                touch.depth = c.depth;
                copy(touch.point, c.point);
                copy(touch.normal, c.normal);
            }
        }
    }
    emit() {
        const touching = new Set();
        const e = this.event;
        for (const [key, touch] of this.touches) {
            touching.add(key);
            if (this.listeners.size === 0)
                continue;
            e.a = touch.a;
            e.b = touch.b;
            e.impulse = touch.impulse;
            e.speed = touch.speed;
            copy(e.point, touch.point);
            copy(e.normal, touch.normal);
            e.began = !this.touching.has(key);
            for (const listener of this.listeners)
                listener(e);
        }
        this.touching = touching;
    }
}
//# sourceMappingURL=world.js.map