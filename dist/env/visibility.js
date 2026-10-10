/**
 * Viewport visibility, for doing expensive work only when it can be seen:
 * initialize a WebGL scene, decode a video, start a demo.
 */
/**
 * Calls `callback` when `target` enters the viewport. With `once: false` it
 * runs on every entry, and a function it returns runs on exit. Returns a
 * function that stops observing (and runs a pending exit cleanup).
 *
 * Without `IntersectionObserver` (old browsers, tests) the callback runs
 * immediately.
 */
export function whenVisible(target, callback, options = {}) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el)
        throw new Error(`[veyra] whenVisible: no element for ${String(target)}`);
    const once = options.once ?? true;
    let exit = null;
    let inside = false;
    let stopped = false;
    const enter = () => {
        inside = true;
        const result = callback();
        if (typeof result === 'function')
            exit = result;
    };
    const leave = () => {
        inside = false;
        exit?.();
        exit = null;
    };
    if (typeof IntersectionObserver === 'undefined') {
        enter();
        return () => {
            if (stopped)
                return;
            stopped = true;
            leave();
        };
    }
    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                if (inside)
                    continue;
                enter();
                if (once)
                    observer.disconnect();
            }
            else if (!once && inside) {
                leave();
            }
        }
    }, { rootMargin: options.rootMargin ?? '0px', threshold: options.threshold ?? 0 });
    observer.observe(el);
    return () => {
        if (stopped)
            return;
        stopped = true;
        observer.disconnect();
        leave();
    };
}
//# sourceMappingURL=visibility.js.map