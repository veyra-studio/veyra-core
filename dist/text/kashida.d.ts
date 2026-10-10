export declare const TATWEEL = "\u0640";
/**
 * String indices in `word` where a tatweel may be inserted, best first.
 * An index `i` means "insert before `word[i]`".
 */
export declare function kashidaPoints(word: string): number[];
export interface ElongateOptions {
    /**
     * `'single'` (default) puts every tatweel of a word on its best
     * connection — one long, calligraphic stroke. `'spread'` shares them
     * across connections in rank order.
     */
    mode?: 'single' | 'spread';
}
/** Inserts `level` tatweels into every Arabic-script word of `text`. */
export declare function elongate(text: string, level: number, options?: ElongateOptions): string;
export interface KashidaOptions extends ElongateOptions {
    /** Initial level. Default `0`. */
    level?: number;
}
export interface Kashida {
    readonly el: HTMLElement;
    /**
     * Tatweels per word. Fractional values are floored, so the property can
     * be tweened or scrubbed: `tl.to(k, { level: 8 })`.
     */
    level: number;
    /** Restores the original text. */
    revert(): void;
}
/**
 * Makes an element's Arabic-script text stretchable. While stretched, the
 * original text is exposed to assistive tech through `aria-label`.
 */
export declare function kashida(target: Element | string, options?: KashidaOptions): Kashida;
//# sourceMappingURL=kashida.d.ts.map