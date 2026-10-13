export function holdable(target, options = {}) {
    return (stage, onDestroy) => {
        const el = typeof target === 'string' ? document.querySelector(target) : target;
        if (!el)
            throw new Error(`[veyra] holdable: nothing matches ${String(target)}`);
        const keys = options.keys ?? [' ', 'Enter'];
        let held = false;
        let duration = 0;
        let source = null;
        let enabled = true;
        let pointer = -1;
        const start = (from) => {
            if (!enabled || held)
                return;
            held = true;
            duration = 0;
            source = from;
            el.dataset.held = '';
            options.onStart?.(hold);
        };
        const end = () => {
            if (!held)
                return;
            held = false;
            delete el.dataset.held;
            if (pointer >= 0 && el.hasPointerCapture?.(pointer))
                el.releasePointerCapture(pointer);
            pointer = -1;
            options.onEnd?.(hold);
            source = null;
        };
        const onPointerDown = (e) => {
            if (e.button !== 0 || !e.isPrimary || held)
                return;
            pointer = e.pointerId;
            el.setPointerCapture?.(e.pointerId);
            start('pointer');
        };
        const onPointerUp = (e) => {
            if (source === 'pointer' && e.pointerId === pointer)
                end();
        };
        const onKeyDown = (e) => {
            if (!keys.includes(e.key))
                return;
            // Space would scroll the page; a held key repeats.
            e.preventDefault();
            if (!e.repeat)
                start('key');
        };
        const onKeyUp = (e) => {
            if (source === 'key' && keys.includes(e.key))
                end();
        };
        // A long press on touch screens opens a menu.
        const onContextMenu = (e) => {
            if (held)
                e.preventDefault();
        };
        el.addEventListener('pointerdown', onPointerDown);
        el.addEventListener('pointerup', onPointerUp);
        el.addEventListener('pointercancel', onPointerUp);
        el.addEventListener('lostpointercapture', onPointerUp);
        el.addEventListener('keydown', onKeyDown);
        el.addEventListener('keyup', onKeyUp);
        el.addEventListener('blur', end);
        el.addEventListener('contextmenu', onContextMenu);
        const stopFrame = stage.onFrame((frame) => {
            if (!held)
                return;
            duration += frame.delta;
            options.onHold?.(hold, frame.delta);
        });
        let destroyed = false;
        const destroy = () => {
            if (destroyed)
                return;
            destroyed = true;
            end();
            stopFrame();
            el.removeEventListener('pointerdown', onPointerDown);
            el.removeEventListener('pointerup', onPointerUp);
            el.removeEventListener('pointercancel', onPointerUp);
            el.removeEventListener('lostpointercapture', onPointerUp);
            el.removeEventListener('keydown', onKeyDown);
            el.removeEventListener('keyup', onKeyUp);
            el.removeEventListener('blur', end);
            el.removeEventListener('contextmenu', onContextMenu);
        };
        const hold = {
            el,
            get held() {
                return held;
            },
            get duration() {
                return duration;
            },
            get source() {
                return source;
            },
            get enabled() {
                return enabled;
            },
            enable() {
                enabled = true;
            },
            disable() {
                enabled = false;
                end();
            },
            destroy,
        };
        onDestroy(destroy);
        return hold;
    };
}
//# sourceMappingURL=hold.js.map