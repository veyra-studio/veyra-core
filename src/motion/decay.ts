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
  timeConstant?: number
  /** Speed (units per second) under which the motion is considered at rest. Default `0.5`. */
  precision?: number
}

export class Decay {
  value: number
  velocity = 0
  timeConstant: number
  precision: number

  constructor(initial = 0, config: DecayConfig = {}) {
    this.value = initial
    this.timeConstant = config.timeConstant ?? 0.325
    this.precision = config.precision ?? 0.5
  }

  /** Where the value will come to rest with the current velocity. */
  get target(): number {
    return this.value + this.velocity * this.timeConstant
  }

  get settled(): boolean {
    return Math.abs(this.velocity) <= this.precision
  }

  /** Starts coasting from `value` with `velocity` (units per second). */
  start(value: number, velocity: number): this {
    this.value = value
    this.velocity = velocity
    return this
  }

  /** Stops immediately where it is. */
  stop(): this {
    this.velocity = 0
    return this
  }

  /** Advances by `dt` seconds. Returns the new value. */
  step(dt: number): number {
    if (dt <= 0 || this.settled) {
      this.velocity = 0
      return this.value
    }
    const e = Math.exp(-dt / this.timeConstant)
    this.value += this.velocity * this.timeConstant * (1 - e)
    this.velocity *= e
    if (this.settled) this.velocity = 0
    return this.value
  }
}

/** Resting position of a throw: `value + velocity · timeConstant`. */
export function projectDecay(value: number, velocity: number, timeConstant = 0.325): number {
  return value + velocity * timeConstant
}
