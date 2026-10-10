/**
 * Noise baked into a texture. A shader that reads noise from a texture does a
 * few cached texture reads where per-pixel noise does dozens of hashes — the
 * difference between a full-screen terrain at 15 and at 60 frames per second
 * — and mipmaps filter distant detail instead of letting it shimmer. The
 * texture stores the noise's analytic gradient too, so bump mapping from it
 * stays smooth even where a texel covers several pixels. Sample it with
 * `tfbm` / `tfbmd` from `glslNoiseTexture` in `@veyra/core/glsl`.
 */
import * as THREE from 'three';
import { seededRandom } from '../core/math.js';
/**
 * Seamlessly tiling gradient noise with its analytic gradient, plus a second
 * independent layer. The lattice wraps every `cells` cells, so the right edge
 * continues into the left and the bottom into the top. Pure: runs in
 * workers and tests.
 */
export function tilingNoise(options = {}) {
    const size = options.size ?? 256;
    const cells = options.cells ?? 8;
    if (!Number.isInteger(size) || size < 1 || (size & (size - 1)) !== 0)
        throw new Error('tilingNoise: size must be a power of two');
    if (!Number.isInteger(cells) || cells < 1 || cells > size)
        throw new Error('tilingNoise: cells must be a whole number from 1 to size');
    const rand = seededRandom(options.seed ?? 1);
    // A random unit gradient per lattice point, for each of the two layers.
    const grads = new Float32Array(cells * cells * 2 * 2);
    for (let i = 0; i < cells * cells * 2; i++) {
        const a = rand() * Math.PI * 2;
        grads[i * 2] = Math.cos(a);
        grads[i * 2 + 1] = Math.sin(a);
    }
    const gx = (x, y, layer) => grads[((y * cells + x) * 2 + layer) * 2];
    const gy = (x, y, layer) => grads[((y * cells + x) * 2 + layer) * 2 + 1];
    const data = new Float32Array(size * size * 4);
    // 2D gradient noise peaks at ±√½; scale into [-1, 1].
    const k = Math.SQRT2;
    for (let y = 0; y < size; y++) {
        const py = ((y + 0.5) / size) * cells;
        const iy = Math.floor(py);
        const fy = py - iy;
        const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
        const dv = 30 * fy * fy * (fy - 1) * (fy - 1);
        const y0 = iy % cells;
        const y1 = (iy + 1) % cells;
        for (let x = 0; x < size; x++) {
            const px = ((x + 0.5) / size) * cells;
            const ix = Math.floor(px);
            const fx = px - ix;
            const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
            const du = 30 * fx * fx * (fx - 1) * (fx - 1);
            const x0 = ix % cells;
            const x1 = (ix + 1) % cells;
            const o = (y * size + x) * 4;
            for (let layer = 0; layer < 2; layer++) {
                // Corner values a (0,0), b (1,0), c (0,1), d (1,1) and their gradients.
                const ga = [gx(x0, y0, layer), gy(x0, y0, layer)];
                const gb = [gx(x1, y0, layer), gy(x1, y0, layer)];
                const gc = [gx(x0, y1, layer), gy(x0, y1, layer)];
                const gd = [gx(x1, y1, layer), gy(x1, y1, layer)];
                const va = ga[0] * fx + ga[1] * fy;
                const vb = gb[0] * (fx - 1) + gb[1] * fy;
                const vc = gc[0] * fx + gc[1] * (fy - 1);
                const vd = gd[0] * (fx - 1) + gd[1] * (fy - 1);
                const k0 = va - vb - vc + vd;
                const value = va + u * (vb - va) + v * (vc - va) + u * v * k0;
                if (layer === 1) {
                    data[o + 3] = value * k;
                    continue;
                }
                // Analytic derivatives per cell, then per tile (× cells).
                const dx = ga[0] + u * (gb[0] - ga[0]) + v * (gc[0] - ga[0]) + u * v * (ga[0] - gb[0] - gc[0] + gd[0]) + du * (vb - va + v * k0);
                const dy = ga[1] + u * (gb[1] - ga[1]) + v * (gc[1] - ga[1]) + u * v * (ga[1] - gb[1] - gc[1] + gd[1]) + dv * (vc - va + u * k0);
                data[o] = value * k;
                data[o + 1] = dx * k * cells;
                data[o + 2] = dy * k * cells;
            }
        }
    }
    return { size, cells, data };
}
/**
 * A tiling noise texture for shaders: `tilingNoise` as half floats,
 * repeat-wrapped, with a box-filtered mip chain. `texture.userData.cells`
 * holds the cells per side, which `tfbm` needs.
 */
export function noiseTexture(options = {}) {
    const { size, cells, data } = tilingNoise(options);
    const mipmaps = [];
    let level = data;
    let w = size;
    for (;;) {
        const half = new Uint16Array(level.length);
        for (let i = 0; i < level.length; i++)
            half[i] = THREE.DataUtils.toHalfFloat(level[i]);
        mipmaps.push({ data: half, width: w, height: w });
        if (w === 1)
            break;
        const n = w / 2;
        const next = new Float32Array(n * n * 4);
        for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
                for (let c = 0; c < 4; c++) {
                    const at = (xx, yy) => level[(yy * w + xx) * 4 + c];
                    next[(y * n + x) * 4 + c] = (at(2 * x, 2 * y) + at(2 * x + 1, 2 * y) + at(2 * x, 2 * y + 1) + at(2 * x + 1, 2 * y + 1)) / 4;
                }
            }
        }
        level = next;
        w = n;
    }
    const texture = new THREE.DataTexture(mipmaps[0].data, size, size, THREE.RGBAFormat, THREE.HalfFloatType);
    // Half-float mipmaps can't be generated on every GPU: upload our own.
    texture.mipmaps = mipmaps;
    texture.generateMipmaps = false;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.colorSpace = THREE.NoColorSpace;
    texture.userData.cells = cells;
    texture.needsUpdate = true;
    return texture;
}
//# sourceMappingURL=noise.js.map