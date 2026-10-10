/**
 * Gradient noise (improved Perlin) for organic motion: wandering cameras,
 * breathing shapes, wind in a field of lines. Deterministic per seed, smooth
 * everywhere, zero at integer lattice points, output within `[-1, 1]`.
 *
 * ```ts
 * const { noise2, fbm3 } = createNoise(7)
 * el.style.translate = `${noise2(t * 0.3, 0) * 20}px 0`
 * ```
 */
import { seededRandom } from './math.js';
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const mix = (a, b, t) => a + (b - a) * t;
// Gradients: the 12 cube edges (3D) and 8 compass directions (2D).
function grad3(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return (h & 1 ? -u : u) + (h & 2 ? -v : v);
}
function grad2(hash, x, y) {
    switch (hash & 7) {
        case 0: return x + y;
        case 1: return -x + y;
        case 2: return x - y;
        case 3: return -x - y;
        case 4: return x;
        case 5: return -x;
        case 6: return y;
        default: return -y;
    }
}
const clampUnit = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);
/** Creates a noise generator with its own permutation table. */
export function createNoise(seed = 1) {
    const rand = seededRandom(seed);
    const perm = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    const p = new Uint8Array(512);
    for (let i = 0; i < 512; i++)
        p[i] = perm[i & 255];
    const noise2 = (x, y) => {
        const xi = Math.floor(x);
        const yi = Math.floor(y);
        const X = xi & 255;
        const Y = yi & 255;
        const xf = x - xi;
        const yf = y - yi;
        const u = fade(xf);
        const v = fade(yf);
        const aa = p[p[X] + Y];
        const ab = p[p[X] + Y + 1];
        const ba = p[p[X + 1] + Y];
        const bb = p[p[X + 1] + Y + 1];
        const value = mix(mix(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u), mix(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u), v);
        // The diagonal gradients reach ±√2·½·2 at most; scale into [-1, 1].
        return clampUnit(value * 0.7071);
    };
    const noise3 = (x, y, z) => {
        const xi = Math.floor(x);
        const yi = Math.floor(y);
        const zi = Math.floor(z);
        const X = xi & 255;
        const Y = yi & 255;
        const Z = zi & 255;
        const xf = x - xi;
        const yf = y - yi;
        const zf = z - zi;
        const u = fade(xf);
        const v = fade(yf);
        const w = fade(zf);
        const A = p[X] + Y;
        const AA = p[A] + Z;
        const AB = p[A + 1] + Z;
        const B = p[X + 1] + Y;
        const BA = p[B] + Z;
        const BB = p[B + 1] + Z;
        const value = mix(mix(mix(grad3(p[AA], xf, yf, zf), grad3(p[BA], xf - 1, yf, zf), u), mix(grad3(p[AB], xf, yf - 1, zf), grad3(p[BB], xf - 1, yf - 1, zf), u), v), mix(mix(grad3(p[AA + 1], xf, yf, zf - 1), grad3(p[BA + 1], xf - 1, yf, zf - 1), u), mix(grad3(p[AB + 1], xf, yf - 1, zf - 1), grad3(p[BB + 1], xf - 1, yf - 1, zf - 1), u), v), w);
        return clampUnit(value);
    };
    const fbm = (sample, options = {}) => {
        const octaves = Math.max(1, Math.floor(options.octaves ?? 4));
        const lacunarity = options.lacunarity ?? 2;
        const gain = options.gain ?? 0.5;
        let amplitude = 1;
        let frequency = 1;
        let sum = 0;
        let norm = 0;
        for (let i = 0; i < octaves; i++) {
            sum += amplitude * sample(frequency);
            norm += amplitude;
            amplitude *= gain;
            frequency *= lacunarity;
        }
        return sum / norm;
    };
    return {
        noise2,
        noise3,
        fbm2: (x, y, options) => fbm((f) => noise2(x * f, y * f), options),
        fbm3: (x, y, z, options) => fbm((f) => noise3(x * f, y * f, z * f), options),
    };
}
let shared = null;
const defaultNoise = () => (shared ??= createNoise(1));
/** 2D gradient noise from the shared generator (seed `1`). */
export function noise2(x, y) {
    return defaultNoise().noise2(x, y);
}
/** 3D gradient noise from the shared generator (seed `1`). */
export function noise3(x, y, z) {
    return defaultNoise().noise3(x, y, z);
}
/** Fractal 2D noise from the shared generator. */
export function fbm2(x, y, options) {
    return defaultNoise().fbm2(x, y, options);
}
/** Fractal 3D noise from the shared generator. */
export function fbm3(x, y, z, options) {
    return defaultNoise().fbm3(x, y, z, options);
}
//# sourceMappingURL=noise.js.map