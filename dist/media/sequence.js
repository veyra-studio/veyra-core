/**
 * Image sequences: a run of frames — a product turning, a liquid pouring —
 * drawn to a canvas and scrubbed by scroll or by hand. Frames load
 * progressively (a coarse set first, then the gaps), so scrubbing works
 * almost at once and sharpens as the rest arrives; until a frame is in,
 * the nearest loaded one stands in. Canvas resolution follows the adaptive
 * quality governor.
 *
 * ```ts
 * stage.use(imageSequence('#turn', {
 *   count: 120,
 *   src: (i) => `/frames/turn-${String(i + 1).padStart(3, '0')}.webp`,
 *   scene: { trigger: '#product', start: 'top top', end: 'bottom bottom' },
 * }))
 * ```
 *
 * The canvas is an image: give it `role="img"` and an `aria-label`.
 */
import { clamp } from '../core/math.js';
import { Phase } from '../core/ticker.js';
/**
 * Load order that covers the whole range early: the ends, then every
 * `coarsest`-th frame, then halving the step down to 1.
 */
export function progressiveOrder(count, coarsest = 2 ** Math.floor(Math.log2(Math.max(1, count / 8)))) {
    const seen = new Uint8Array(count);
    const order = [];
    const push = (i) => {
        if (i >= 0 && i < count && !seen[i]) {
            seen[i] = 1;
            order.push(i);
        }
    };
    push(0);
    push(count - 1);
    for (let step = Math.max(1, coarsest);; step = Math.max(1, Math.floor(step / 2))) {
        for (let i = 0; i < count; i += step)
            push(i);
        if (step === 1)
            break;
    }
    return order;
}
/** Nearest index with a truthy entry in `loaded` (ties go to the earlier frame), or `-1`. */
export function nearestLoaded(index, loaded) {
    if (loaded[index])
        return index;
    for (let d = 1; d < loaded.length; d++) {
        if (index - d >= 0 && loaded[index - d])
            return index - d;
        if (index + d < loaded.length && loaded[index + d])
            return index + d;
    }
    return -1;
}
export function imageSequence(target, options) {
    return (stage, onDestroy) => {
        const canvas = (typeof target === 'string' ? document.querySelector(target) : target);
        if (!canvas || typeof canvas.getContext !== 'function')
            throw new Error(`[veyra] imageSequence: no canvas for ${String(target)}`);
        const count = Math.floor(options.count);
        if (!(count > 0))
            throw new Error('[veyra] imageSequence: count must be positive');
        const ctx = canvas.getContext('2d');
        const images = new Array(count).fill(null);
        const loaded = new Uint8Array(count);
        const order = options.load === 'sequential' ? Array.from({ length: count }, (_, i) => i) : progressiveOrder(count);
        const concurrency = Math.max(1, options.concurrency ?? 6);
        let next = 0;
        let inflight = 0;
        let settled = 0;
        let loadedCount = 0;
        let progress = 0;
        let drawn = -1;
        /** The frame to show may have changed (progress moved, a frame arrived). */
        let dirty = true;
        /** The canvas content is invalid (it was resized). */
        let stale = true;
        let destroyed = false;
        let resolveReady = () => { };
        const ready = new Promise((resolve) => (resolveReady = resolve));
        const pump = () => {
            while (!destroyed && inflight < concurrency && next < order.length) {
                const index = order[next++];
                inflight++;
                const img = new Image();
                img.decoding = 'async';
                img.src = options.src(index);
                const done = (ok) => {
                    inflight--;
                    if (destroyed)
                        return;
                    settled++;
                    if (ok) {
                        images[index] = img;
                        loaded[index] = 1;
                        loadedCount++;
                        dirty = true;
                        options.onLoad?.(loadedCount, count);
                    }
                    if (settled === count)
                        resolveReady();
                    pump();
                };
                const decoded = typeof img.decode === 'function' ? img.decode() : new Promise((res, rej) => ((img.onload = () => res()), (img.onerror = rej)));
                decoded.then(() => done(true), () => done(false));
            }
        };
        pump();
        // Canvas backing size follows its CSS box and the quality governor.
        let cssWidth = 0;
        let cssHeight = 0;
        const resize = () => {
            const r = canvas.getBoundingClientRect();
            cssWidth = r.width;
            cssHeight = r.height;
            const dpr = Math.min(window.devicePixelRatio || 1, stage.quality?.dpr.value ?? Infinity);
            const w = Math.max(1, Math.round(cssWidth * dpr));
            const h = Math.max(1, Math.round(cssHeight * dpr));
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
                stale = true;
            }
        };
        resize();
        const stopLayout = stage.onRefresh(resize);
        const stopDpr = stage.quality?.dpr.subscribe(resize) ?? (() => { });
        let scene = null;
        if (options.scene) {
            const spec = options.scene;
            const isElementRef = typeof spec === 'string' || (typeof Element !== 'undefined' && spec instanceof Element);
            const triggerRef = isElementRef ? spec : spec.trigger;
            const trigger = typeof triggerRef === 'string' ? document.querySelector(triggerRef) : triggerRef;
            if (!trigger)
                throw new Error(`[veyra] imageSequence: no scene trigger ${String(triggerRef)}`);
            const { trigger: _, ...sceneOptions } = isElementRef ? {} : spec;
            scene = stage.scene(trigger, {
                ...sceneOptions,
                onProgress: (p, s) => {
                    progress = p;
                    dirty = true;
                    sceneOptions.onProgress?.(p, s);
                },
            });
        }
        const draw = () => {
            if ((!dirty && !stale) || !ctx)
                return;
            const wanted = Math.round(progress * (count - 1));
            const index = nearestLoaded(wanted, loaded);
            if (index < 0)
                return;
            // Showing a stand-in keeps `dirty` set until the wanted frame arrives.
            if (index === wanted)
                dirty = false;
            if (index === drawn && !stale)
                return;
            const img = images[index];
            const iw = img.naturalWidth || img.width;
            const ih = img.naturalHeight || img.height;
            if (!iw || !ih)
                return;
            const cw = canvas.width;
            const ch = canvas.height;
            const scale = options.fit === 'contain' ? Math.min(cw / iw, ch / ih) : Math.max(cw / iw, ch / ih);
            const w = iw * scale;
            const h = ih * scale;
            ctx.clearRect(0, 0, cw, ch);
            ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
            drawn = index;
            stale = false;
        };
        const removeFrame = stage.onFrame(draw, Phase.render);
        const destroy = () => {
            if (destroyed)
                return;
            destroyed = true;
            removeFrame();
            stopLayout();
            stopDpr();
            scene?.destroy();
            images.fill(null);
        };
        onDestroy(destroy);
        return {
            canvas,
            get progress() {
                return progress;
            },
            set progress(value) {
                progress = clamp(value);
                dirty = true;
            },
            get frame() {
                return drawn;
            },
            get loaded() {
                return loadedCount;
            },
            ready,
            get scene() {
                return scene;
            },
            destroy,
        };
    };
}
//# sourceMappingURL=sequence.js.map