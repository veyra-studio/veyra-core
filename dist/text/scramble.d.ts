/**
 * Decode effect: letters cycle through random glyphs and settle into the
 * real text, from the start of the line to its end (the right edge in
 * Persian). Glyphs come from the script of each letter — Persian letters
 * for Persian, Latin for English — and the text stays one shaped run, so
 * Arabic-script letters keep joining while they flicker.
 *
 * Returns a timeline: play it, or scrub it with a scroll scene.
 */
import { type EaseLike } from '../core/ease.js';
import type { Ticker } from '../core/ticker.js';
import { Timeline } from '../motion/timeline.js';
export interface ScrambleOptions {
    /** Seconds. Default `1.2`. */
    duration?: number;
    /** Seconds before it starts. Default `0`. */
    delay?: number;
    /**
     * Glyph pool. `'auto'` (default) chooses per letter: Persian letters,
     * Persian digits, Latin upper/lower case or digits.
     */
    chars?: 'auto' | string;
    /** Share of the duration over which letters settle one after another. Default `0.75`. */
    spread?: number;
    /** Glyph changes per second. Default `24`. */
    rate?: number;
    /** Shapes the settle schedule. Default linear. */
    ease?: EaseLike;
    /** Seed for the glyph sequence (the same seed always flickers the same way). */
    seed?: number;
    /** Create without playing (for scrubbing). Default `false`. */
    paused?: boolean;
    ticker?: Ticker;
}
export declare function scrambleText(target: Element | string, options?: ScrambleOptions): Timeline;
//# sourceMappingURL=scramble.d.ts.map