/**
 * Layout measurement cache. Reading layout every frame is the classic
 * source of scroll jank, so element rects are measured once (and again
 * after layout changes) in document coordinates; viewport positions are
 * derived from the scroll offset.
 *
 * Elements inside sticky or transformed containers move independently of
 * scroll — track those as `live`, which re-measures them once per frame
 * during the measure phase (all reads batched, no interleaved writes).
 */
const readScrollX = () => (typeof window === 'undefined' ? 0 : window.scrollX);
export class RectCache {
    scrollY;
    entries = new Map();
    /**
     * Horizontal scroll offset, read with the measurements (in the measure
     * phase): reading `window.scrollX` makes the browser bring layout up to
     * date, so `view()` must not read it after the frame's writes.
     */
    scrollX = readScrollX();
    constructor(scrollY = () => (typeof window === 'undefined' ? 0 : window.scrollY)) {
        this.scrollY = scrollY;
    }
    /** Measures an element right now (document coordinates). */
    measure(el) {
        const r = el.getBoundingClientRect();
        // Layout is up to date after the rect read: the offset costs nothing now.
        this.scrollX = readScrollX();
        return { top: r.top + this.scrollY(), left: r.left + this.scrollX, width: r.width, height: r.height };
    }
    /**
     * Starts tracking `el`. With `live`, it is re-measured every frame.
     * Returns a function that stops tracking.
     */
    track(el, options = {}) {
        const existing = this.entries.get(el);
        if (existing) {
            existing.refs++;
            existing.live ||= !!options.live;
        }
        else {
            this.entries.set(el, { rect: this.measure(el), live: !!options.live, stale: false, refs: 1 });
        }
        let released = false;
        return () => {
            if (released)
                return;
            released = true;
            const entry = this.entries.get(el);
            if (entry && --entry.refs <= 0)
                this.entries.delete(el);
        };
    }
    /** Cached document rect (measures on first use or when stale). */
    get(el) {
        const entry = this.entries.get(el);
        if (!entry)
            return this.measure(el);
        if (entry.stale) {
            entry.rect = this.measure(el);
            entry.stale = false;
        }
        return entry.rect;
    }
    /**
     * Viewport-relative rect derived from the cache and the scroll offset. No
     * layout reads for tracked, fresh entries: safe to call every frame.
     */
    view(el, scrollY = this.scrollY()) {
        const r = this.get(el);
        const top = r.top - scrollY;
        const left = r.left - this.scrollX;
        return { top, left, width: r.width, height: r.height, bottom: top + r.height, right: left + r.width };
    }
    /** Marks every cached rect stale; they re-measure lazily. */
    invalidate() {
        for (const entry of this.entries.values())
            entry.stale = true;
    }
    /** Re-measures live entries (and the scroll offset). Called once per frame in the measure phase. */
    updateLive() {
        if (this.entries.size === 0)
            return;
        let measured = false;
        for (const [el, entry] of this.entries) {
            if (entry.live || entry.stale) {
                entry.rect = this.measure(el);
                entry.stale = false;
                measured = true;
            }
        }
        // Measuring read the offset already; otherwise read it here, once.
        if (!measured)
            this.scrollX = readScrollX();
    }
    get size() {
        return this.entries.size;
    }
}
//# sourceMappingURL=rects.js.map