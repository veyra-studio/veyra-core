import { type SpringConfig } from '../motion/spring.js';
import type { StagePlugin } from '../stage.js';
export interface TiltOptions {
    /** Maximum rotation in degrees. Default `8`. */
    max?: number;
    /** Perspective distance (px). Default `900`. */
    perspective?: number;
    /** Scale while hovered. Default `1`. */
    scale?: number;
    /** Write `--tilt-x`, `--tilt-y` and `--tilt-active` for highlights. Default `false`. */
    glare?: boolean;
    spring?: SpringConfig;
}
export interface Tilt {
    readonly el: HTMLElement;
    readonly hovered: boolean;
    destroy(): void;
}
export declare function tilt(target: Element | string, options?: TiltOptions): StagePlugin<Tilt>;
//# sourceMappingURL=tilt.d.ts.map