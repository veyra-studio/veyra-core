/**
 * Condensation on a cold surface — a fine mist of micro-droplets, beads of
 * every size, and a few drops that ran and wiped a clear track through the
 * mist — as tileable maps for physically based materials:
 *
 * ```ts
 * const maps = condensationMaps({ size: 512, seed: 3 })
 * glass.normalMap = new THREE.CanvasTexture(maps.normal)
 * glass.roughnessMap = new THREE.CanvasTexture(maps.roughness)
 * ```
 *
 * `condensationField` returns the raw height and mist fields so other
 * renderers (or tests) can use them without a canvas.
 */
import { seededRandom } from '../core/math.js';
/** Computes the condensation height and mist fields. */
export function condensationField(options = {}) {
    const size = Math.max(8, Math.round(options.size ?? 512));
    const rand = seededRandom(options.seed ?? 1);
    const count = Math.round(options.droplets ?? (size * size) / 900);
    const [rMin, rMax] = options.radius ?? [size / 256, size / 36];
    const runs = options.runs ?? 0.08;
    const mistLevel = Math.min(1, Math.max(0, options.mist ?? 0.6));
    const height = new Float32Array(size * size);
    const mist = new Float32Array(size * size).fill(mistLevel);
    const wrap = (v) => ((v % size) + size) % size;
    /** A drop: a lens with a finite contact angle, sagging a little under gravity. */
    const drop = (cx, cy, r, peak) => {
        const sag = 1 + Math.min(0.35, r / (size / 24)) * 0.35;
        const x0 = Math.floor(cx - r - 1);
        const x1 = Math.ceil(cx + r + 1);
        const y0 = Math.floor(cy - r - 1);
        const y1 = Math.ceil(cy + r * sag + 1);
        for (let py = y0; py <= y1; py++) {
            for (let px = x0; px <= x1; px++) {
                const dx = (px - cx) / r;
                const dy = (py - cy) / (py < cy ? r : r * sag);
                const dd = dx * dx + dy * dy;
                const i = wrap(py) * size + wrap(px);
                // A dry ring around each drop: it gathered the mist around it.
                if (dd < 2.1)
                    mist[i] = Math.min(mist[i], mistLevel * Math.max(0, (dd - 1) / 1.1));
                if (dd >= 1)
                    continue;
                const h = (1 - dd) * peak;
                if (h > height[i])
                    height[i] = h;
            }
        }
    };
    /** A run: a clear, slightly wet track wiped through the mist above a drop. */
    const track = (cx, cy, width, length) => {
        let x = cx;
        for (let t = 0; t < length; t += 0.5) {
            x += (rand() - 0.5) * 0.35;
            const y = cy - t;
            const w = width * (1 - (t / length) * 0.5);
            for (let px = Math.floor(x - w - 1); px <= Math.ceil(x + w + 1); px++) {
                const d = Math.abs(px - x) / w;
                if (d >= 1.25)
                    continue;
                const i = wrap(Math.round(y)) * size + wrap(px);
                mist[i] = Math.min(mist[i], d < 1 ? 0 : mistLevel * (d - 1) * 4);
                if (d < 1)
                    height[i] = Math.max(height[i], (1 - d * d) * 0.06);
            }
        }
    };
    for (let d = 0; d < count; d++) {
        const x = rand() * size;
        const y = rand() * size;
        // Power law: many small drops, few big ones.
        const k = rand() ** 2.6;
        const r = rMin + (rMax - rMin) * k;
        if (k > 0.35 && rand() < runs) {
            const length = r * (3 + rand() * 8);
            track(x, y - r * 0.6, r * 0.55, length);
            // Beads left behind on the way down.
            const beads = 1 + Math.floor(rand() * 3);
            for (let b = 0; b < beads; b++)
                drop(x + (rand() - 0.5) * r * 0.4, y - r - rand() * length, r * (0.2 + rand() * 0.25), 0.8);
        }
        drop(x, y, r, 0.75 + k * 0.25);
    }
    // Mist: micro-droplets too small to see one by one, felt as roughness and sparkle.
    const micro = Math.round(size * size * 0.06 * mistLevel);
    for (let m = 0; m < micro; m++) {
        const i = Math.floor(rand() * size) * size + Math.floor(rand() * size);
        if (height[i] === 0 && mist[i] > 0)
            height[i] = 0.12 + rand() * 0.12;
    }
    return { size, height, mist };
}
/** Draws condensation into a normal map and a roughness map. */
export function condensationMaps(options = {}) {
    const { size, height, mist } = condensationField(options);
    const strength = options.strength ?? 3;
    const [clear, misted] = options.roughness ?? [0.04, 0.5];
    const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
    const make = () => {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        return c;
    };
    const normal = make();
    const rough = make();
    const nctx = normal.getContext('2d');
    const rctx = rough.getContext('2d');
    const nimg = nctx.createImageData(size, size);
    const rimg = rctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
            const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
            const len = Math.hypot(dx, dy, 1);
            const i = (y * size + x) * 4;
            nimg.data[i] = (-dx / len) * 127.5 + 127.5;
            nimg.data[i + 1] = (dy / len) * 127.5 + 127.5; // canvas y runs down; normal maps' +y runs up
            nimg.data[i + 2] = (1 / len) * 127.5 + 127.5;
            nimg.data[i + 3] = 255;
            const p = y * size + x;
            const onDrop = height[p] > 0.3;
            const r = onDrop ? clear : clear + (misted - clear) * mist[p];
            rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = Math.round(r * 255);
            rimg.data[i + 3] = 255;
        }
    }
    nctx.putImageData(nimg, 0, 0);
    rctx.putImageData(rimg, 0, 0);
    return { normal, roughness: rough };
}
//# sourceMappingURL=condensation.js.map