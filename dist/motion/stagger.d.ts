/**
 * Stagger patterns for timelines: waves that start from the center, the
 * edges, a given element, at random, or travel across a grid.
 *
 * ```ts
 * tl.to(cards, { opacity: 1 }, { stagger: stagger(0.06, { from: 'center' }) })
 * tl.to(cells, { scale: 1 }, { stagger: stagger(0.04, { grid: [6, 10], from: 'start', rtl: true }) })
 * ```
 */
import { type EaseLike } from '../core/ease.js';
import type { StaggerFn } from './timeline.js';
export interface StaggerOptions {
    /** Where the wave starts. Default `'start'`. A number is an element index. */
    from?: 'start' | 'end' | 'center' | 'edges' | 'random' | number;
    /** Treats targets as a row-major grid of `[rows, columns]` and staggers by distance. */
    grid?: readonly [rows: number, columns: number];
    /** On a grid, measure distance along one axis only. */
    axis?: 'x' | 'y';
    /** Mirrors the grid so `'start'` is the top-right cell (right-to-left layouts). */
    rtl?: boolean;
    /** Shapes the distribution of delays. Default linear. */
    ease?: EaseLike;
    /** Spreads all delays over this many seconds instead of `each` per step. */
    total?: number;
    /** Seed for `from: 'random'`. Default `1`. */
    seed?: number;
}
/** Returns a stagger function for `TweenOptions.stagger`. */
export declare function stagger(each: number, options?: StaggerOptions): StaggerFn;
//# sourceMappingURL=stagger.d.ts.map