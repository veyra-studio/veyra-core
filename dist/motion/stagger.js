/**
 * Stagger patterns for timelines: waves that start from the center, the
 * edges, a given element, at random, or travel across a grid.
 *
 * ```ts
 * tl.to(cards, { opacity: 1 }, { stagger: stagger(0.06, { from: 'center' }) })
 * tl.to(cells, { scale: 1 }, { stagger: stagger(0.04, { grid: [6, 10], from: 'start', rtl: true }) })
 * ```
 */
import { resolveEase } from '../core/ease.js';
import { seededRandom } from '../core/math.js';
/** Returns a stagger function for `TweenOptions.stagger`. */
export function stagger(each, options = {}) {
    const from = options.from ?? 'start';
    const shape = resolveEase(options.ease, (t) => t);
    const cache = new Map();
    const distances = (count) => {
        if (from === 'random') {
            // A seeded shuffle: each target gets a distinct rank.
            const order = Array.from({ length: count }, (_, i) => i);
            const rand = seededRandom(options.seed ?? 1);
            for (let i = count - 1; i > 0; i--) {
                const j = Math.floor(rand() * (i + 1));
                [order[i], order[j]] = [order[j], order[i]];
            }
            const rank = new Array(count);
            order.forEach((target, position) => (rank[target] = position));
            return rank;
        }
        if (options.grid) {
            const [rows, cols] = options.grid;
            const cell = (i) => {
                const c = i % cols;
                return [Math.floor(i / cols), options.rtl ? cols - 1 - c : c];
            };
            const lastRow = rows - 1;
            const lastCol = cols - 1;
            const origin = from === 'end' ? [lastRow, lastCol] : from === 'center' || from === 'edges' ? [lastRow / 2, lastCol / 2] : typeof from === 'number' ? cell(from) : [0, 0];
            const out = [];
            for (let i = 0; i < count; i++) {
                const [r, c] = cell(i);
                let d;
                if (from === 'edges')
                    d = Math.min(r, lastRow - r, c, lastCol - c);
                else if (options.axis === 'x')
                    d = Math.abs(c - origin[1]);
                else if (options.axis === 'y')
                    d = Math.abs(r - origin[0]);
                else
                    d = Math.hypot(r - origin[0], c - origin[1]);
                out.push(d);
            }
            return out;
        }
        const last = count - 1;
        return Array.from({ length: count }, (_, i) => {
            if (from === 'end')
                return last - i;
            if (from === 'center')
                return Math.abs(i - last / 2);
            if (from === 'edges')
                return Math.min(i, last - i);
            if (typeof from === 'number')
                return Math.abs(i - from);
            return i;
        });
    };
    return (index, count) => {
        let delays = cache.get(count);
        if (!delays) {
            const d = distances(count);
            const max = Math.max(0, ...d);
            delays = d.map((value) => {
                const t = max === 0 ? 0 : shape(value / max);
                return options.total !== undefined ? t * options.total : t * max * each;
            });
            cache.set(count, delays);
        }
        return delays[index] ?? 0;
    };
}
//# sourceMappingURL=stagger.js.map