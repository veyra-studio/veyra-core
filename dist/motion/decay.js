/**
 * Inertia: a value coasting to rest under exponential friction — what a
 * flicked list or a thrown card does. Solved analytically like the springs,
 * so the motion is identical at any frame rate.
 *
 * With velocity `v₀` and time constant `τ`, the value travels
 * `v₀·τ·(1 − e^(−t/τ))` and comes to rest `v₀·τ` away.
 */
export class Decay {
    value;
    velocity = 0;
    timeConstant;
    precision;
    constructor(initial = 0, config = {}) {
        this.value = initial;
        this.timeConstant = config.timeConstant ?? 0.325;
        this.precision = config.precision ?? 0.5;
    }
    /** Where the value will come to rest with the current velocity. */
    get target() {
        return this.value + this.velocity * this.timeConstant;
    }
    get settled() {
        return Math.abs(this.velocity) <= this.precision;
    }
    /** Starts coasting from `value` with `velocity` (units per second). */
    start(value, velocity) {
        this.value = value;
        this.velocity = velocity;
        return this;
    }
    /** Stops immediately where it is. */
    stop() {
        this.velocity = 0;
        return this;
    }
    /** Advances by `dt` seconds. Returns the new value. */
    step(dt) {
        if (dt <= 0 || this.settled) {
            this.velocity = 0;
            return this.value;
        }
        const e = Math.exp(-dt / this.timeConstant);
        this.value += this.velocity * this.timeConstant * (1 - e);
        this.velocity *= e;
        if (this.settled)
            this.velocity = 0;
        return this.value;
    }
}
/** Resting position of a throw: `value + velocity · timeConstant`. */
export function projectDecay(value, velocity, timeConstant = 0.325) {
    return value + velocity * timeConstant;
}
//# sourceMappingURL=decay.js.map