/**
 * Inertia: a value coasting to rest under exponential friction — what a
 * flicked list or a thrown card does. Solved analytically like the springs,
 * so the motion is identical at any frame rate.
 *
 * With velocity `v₀` and time constant `τ`, the value travels
 * `v₀·τ·(1 − e^(−t/τ))` and comes to rest `v₀·τ` away.
 */
export interface DecayConfig {
    /** Seconds for the velocity to fall to ~37 %. Default `0.325` (the iOS scroll feel). */
    timeConstant?: number;
    /** Speed (units per second) under which the motion is considered at rest. Default `0.5`. */
    precision?: number;
}
export declare class Decay {
    value: number;
    velocity: number;
    timeConstant: number;
    precision: number;
    constructor(initial?: number, config?: DecayConfig);
    /** Where the value will come to rest with the current velocity. */
    get target(): number;
    get settled(): boolean;
    /** Starts coasting from `value` with `velocity` (units per second). */
    start(value: number, velocity: number): this;
    /** Stops immediately where it is. */
    stop(): this;
    /** Advances by `dt` seconds. Returns the new value. */
    step(dt: number): number;
}
/** Resting position of a throw: `value + velocity · timeConstant`. */
export declare function projectDecay(value: number, velocity: number, timeConstant?: number): number;
//# sourceMappingURL=decay.d.ts.map