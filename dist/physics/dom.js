/**
 * Elements of the page as boxes in a pixel-camera world (origin at the
 * viewport's center, y up, CSS pixels — `threeLayer`'s): a balloon let go
 * can bounce off the headlines. Boxes follow their elements as the page
 * scrolls, with a velocity, so a passing headline bats what it meets; rects
 * come from the stage's cache, so nothing reads layout per frame.
 *
 * ```ts
 * const walls = stage.use(domColliders(physics, '.chapter h2', { size: () => layer }))
 * physics.onContact((c) => c.a.userData instanceof Element && wobble(c.a.userData))
 * ```
 */
import { Phase } from '../core/ticker.js';
import { set, vec3 } from './math.js';
export function domColliders(world, targets, options = {}) {
    return (stage, onDestroy) => {
        const els = typeof targets === 'string' ? [...document.querySelectorAll(targets)] : targets instanceof Element ? [targets] : [...targets];
        const untrack = els.map((el) => stage.rects.track(el, { live: options.live }));
        const half = (options.depth ?? 400) / 2;
        const z = options.z ?? 0;
        const bodies = els.map((el) => world.add({
            kind: 'kinematic',
            shape: { type: 'box', half: vec3(0, 0, half) },
            position: vec3(0, 0, z),
            restitution: options.restitution ?? 0.5,
            friction: options.friction ?? 0.3,
            group: options.group,
            mask: options.mask,
            userData: el,
        }));
        let placed = false;
        const update = (dt = 0) => {
            const size = options.size?.() ?? { width: stage.viewport.width.value, height: stage.viewport.height.value };
            for (let i = 0; i < els.length; i++) {
                const r = stage.rects.view(els[i]);
                const b = bodies[i];
                const x = r.left + r.width / 2 - size.width / 2;
                const y = size.height / 2 - (r.top + r.height / 2);
                if (placed && dt > 0)
                    set(b.velocity, (x - b.position.x) / dt, (y - b.position.y) / dt, 0);
                set(b.position, x, y, z);
                const box = b.shapes[0];
                if (box.type === 'box')
                    set(box.half, r.width / 2, r.height / 2, half);
            }
            placed = true;
        };
        const stopFrame = stage.onFrame((frame) => update(frame.delta), Phase.update - 1);
        update();
        let destroyed = false;
        const destroy = () => {
            if (destroyed)
                return;
            destroyed = true;
            stopFrame();
            for (const stop of untrack)
                stop();
            for (const b of bodies)
                world.remove(b);
        };
        onDestroy(destroy);
        return { bodies, update, destroy };
    };
}
//# sourceMappingURL=dom.js.map