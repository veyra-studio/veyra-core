import { type SpringConfig } from '../motion/spring.js';
import type { StagePlugin } from '../stage.js';
export interface MagneticOptions {
    /** Share of the pointer's offset from the center that the element follows, `0…1`. Default `0.35`. */
    strength?: number;
    /** How far outside the element (px) the pull starts. Default `48`. */
    radius?: number;
    /** Selector of an inner element that moves further. */
    inner?: string;
    /** Share of the pointer offset applied to the inner element. Default `strength × 1.6`. */
    innerStrength?: number;
    /** Default: lively with a light overshoot. */
    spring?: SpringConfig;
    /** Re-measure every frame — for elements inside sticky or moving containers. */
    live?: boolean;
}
export interface Magnetic {
    readonly el: HTMLElement;
    /** The pointer is within reach. */
    readonly active: boolean;
    destroy(): void;
}
export declare function magnetic(target: Element | string, options?: MagneticOptions): StagePlugin<Magnetic>;
//# sourceMappingURL=magnetic.d.ts.map