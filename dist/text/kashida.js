/**
 * Kashida (tatweel, U+0640): stretching the connection between two joined
 * Arabic-script letters, the calligrapher's way of lengthening a word —
 * «کشیده» → «کشـــیده». Veyra finds the connections where a kashida may go
 * (from Unicode joining types, never inside a lam-alef ligature or across a
 * ZWNJ) and ranks them the way calligraphers usually do: after seen-family
 * letters first, then the word's last connection, then later connections.
 *
 * Best with Naskh-style and display typefaces (Vazirmatn, Estedad, Lalezar).
 * Nastaliq does not stretch with tatweel.
 */
import { clusterJoiningType, graphemes, hasArabicScript } from './script.js';
export const TATWEEL = 'ـ';
const LAM = 0x0644;
const ALEFS = new Set([0x0622, 0x0623, 0x0625, 0x0627, 0x0671, 0x0672, 0x0673]);
/** Seen, sheen, sad, dad: the classic kashida bearers. */
const SEEN_FAMILY = new Set([0x0633, 0x0634, 0x0635, 0x0636]);
const SPACE = /(\s+)/;
/**
 * String indices in `word` where a tatweel may be inserted, best first.
 * An index `i` means "insert before `word[i]`".
 */
export function kashidaPoints(word) {
    const clusters = graphemes(word);
    const joins = clusters.map((cluster) => {
        const type = clusterJoiningType(cluster);
        const last = cluster.codePointAt(cluster.length - 1);
        return {
            forward: last === 0x200c ? false : last === 0x200d || type === 'D' || type === 'C',
            back: type === 'D' || type === 'R' || type === 'C',
            base: [...cluster].find((ch) => clusterJoiningType(ch) !== 'T')?.codePointAt(0) ?? 0,
        };
    });
    const points = [];
    let offset = 0;
    let lastJoint = -1;
    for (let i = 0; i < clusters.length - 1; i++) {
        offset += clusters[i].length;
        const a = joins[i];
        const b = joins[i + 1];
        if (!a.forward || !b.back)
            continue;
        if (a.base === LAM && ALEFS.has(b.base))
            continue; // keep the lam-alef ligature
        if (a.base === 0x0640 || b.base === 0x0640)
            continue; // already stretched here
        points.push({ index: offset, priority: SEEN_FAMILY.has(a.base) ? 3 : 1 });
        lastJoint = points.length - 1;
    }
    if (lastJoint >= 0 && points[lastJoint].priority < 2)
        points[lastJoint].priority = 2;
    return points.sort((p, q) => q.priority - p.priority || q.index - p.index).map((p) => p.index);
}
/** Inserts `level` tatweels into every Arabic-script word of `text`. */
export function elongate(text, level, options = {}) {
    const count = Math.max(0, Math.floor(level));
    if (count === 0)
        return text;
    const spread = options.mode === 'spread';
    return text
        .split(SPACE)
        .map((part) => {
        if (!part || SPACE.test(part) || !hasArabicScript(part))
            return part;
        const points = kashidaPoints(part);
        if (!points.length)
            return part;
        const extra = new Map();
        for (let k = 0; k < count; k++) {
            const at = spread ? points[k % points.length] : points[0];
            extra.set(at, (extra.get(at) ?? 0) + 1);
        }
        let out = '';
        for (let i = 0; i < part.length; i++)
            out += TATWEEL.repeat(extra.get(i) ?? 0) + part[i];
        return out;
    })
        .join('');
}
/**
 * Makes an element's Arabic-script text stretchable. While stretched, the
 * original text is exposed to assistive tech through `aria-label`.
 */
export function kashida(target, options = {}) {
    const el = (typeof target === 'string' ? document.querySelector(target) : target);
    if (!el)
        throw new Error(`[veyra] kashida: no element for ${String(target)}`);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = n;
        if (text.parentElement?.closest('[data-veyra-sr]'))
            continue;
        nodes.push({ node: text, original: text.data });
    }
    const label = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    const hadLabel = el.hasAttribute('aria-label');
    let level = 0;
    let applied = 0;
    const apply = (next) => {
        const whole = Math.max(0, Math.floor(next));
        if (whole === applied)
            return;
        applied = whole;
        for (const { node, original } of nodes)
            node.data = elongate(original, whole, options);
        if (!hadLabel) {
            if (whole > 0)
                el.setAttribute('aria-label', label);
            else
                el.removeAttribute('aria-label');
        }
    };
    const controller = {
        el,
        get level() {
            return level;
        },
        set level(value) {
            level = value;
            apply(value);
        },
        revert() {
            level = 0;
            apply(0);
        },
    };
    if (options.level)
        controller.level = options.level;
    return controller;
}
//# sourceMappingURL=kashida.js.map