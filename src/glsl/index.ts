/**
 * GLSL building blocks for WebGL2 and three.js shaders (GLSL ES 3.00).
 * Each export is a string of function definitions wrapped in an include
 * guard, so chunks can be combined freely — dependencies are bundled.
 *
 * ```ts
 * import { glslNoise, glslSdf, glslColor } from '@veyra/core/glsl'
 *
 * const fragmentShader = `
 * ${glslNoise}
 * ${glslSdf}
 * void main() {
 *   float d = sdCircle(vUv - 0.5, 0.3 + 0.03 * gnoise(vec3(vUv * 4.0, uTime)));
 *   …
 * }`
 * ```
 */

/**
 * Integer hashes (PCG family). `pcg(uint)`, `pcg2d(uvec2)`, `pcg3d(uvec3)`,
 * and float wrappers returning `[0, 1)`: `hash11(float)`, `hash12(vec2)`,
 * `hash22(vec2)`, `hash13(vec3)`, `hash33(vec3)`.
 */
export const glslHash = /* glsl */ `
#ifndef VEYRA_HASH
#define VEYRA_HASH
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
uvec2 pcg2d(uvec2 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * 1664525u;
  v.y += v.x * 1664525u;
  v ^= v >> 16u;
  v.x += v.y * 1664525u;
  v.y += v.x * 1664525u;
  v ^= v >> 16u;
  return v;
}
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return v;
}
const float VEYRA_U32_TO_UNIT = 1.0 / 4294967296.0;
float hash11(float p) { return float(pcg(floatBitsToUint(p))) * VEYRA_U32_TO_UNIT; }
float hash12(vec2 p) { return float(pcg2d(floatBitsToUint(p)).x) * VEYRA_U32_TO_UNIT; }
vec2 hash22(vec2 p) { return vec2(pcg2d(floatBitsToUint(p))) * VEYRA_U32_TO_UNIT; }
float hash13(vec3 p) { return float(pcg3d(floatBitsToUint(p)).x) * VEYRA_U32_TO_UNIT; }
vec3 hash33(vec3 p) { return vec3(pcg3d(floatBitsToUint(p))) * VEYRA_U32_TO_UNIT; }
#endif
`

/**
 * Gradient noise `gnoise(vec2)` / `gnoise(vec3)` in about `[-1, 1]`, and
 * fractal noise `fbm(vec2, int octaves)` / `fbm(vec3, int octaves)`
 * (up to 8 octaves).
 */
export const glslNoise = /* glsl */ `
${glslHash}
#ifndef VEYRA_NOISE
#define VEYRA_NOISE
vec2 veyraGradient(ivec2 cell) {
  float a = float(pcg2d(uvec2(cell)).x) * (6.28318530718 * VEYRA_U32_TO_UNIT);
  return vec2(cos(a), sin(a));
}
vec3 veyraGradient(ivec3 cell) {
  uvec3 h = pcg3d(uvec3(cell));
  float z = float(h.x) * (2.0 * VEYRA_U32_TO_UNIT) - 1.0;
  float a = float(h.y) * (6.28318530718 * VEYRA_U32_TO_UNIT);
  float r = sqrt(max(0.0, 1.0 - z * z));
  return vec3(r * cos(a), r * sin(a), z);
}
float gnoise(vec2 p) {
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(veyraGradient(i), f);
  float b = dot(veyraGradient(i + ivec2(1, 0)), f - vec2(1.0, 0.0));
  float c = dot(veyraGradient(i + ivec2(0, 1)), f - vec2(0.0, 1.0));
  float d = dot(veyraGradient(i + ivec2(1, 1)), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.41421356;
}
float gnoise(vec3 p) {
  ivec3 i = ivec3(floor(p));
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(veyraGradient(i), f);
  float n100 = dot(veyraGradient(i + ivec3(1, 0, 0)), f - vec3(1.0, 0.0, 0.0));
  float n010 = dot(veyraGradient(i + ivec3(0, 1, 0)), f - vec3(0.0, 1.0, 0.0));
  float n110 = dot(veyraGradient(i + ivec3(1, 1, 0)), f - vec3(1.0, 1.0, 0.0));
  float n001 = dot(veyraGradient(i + ivec3(0, 0, 1)), f - vec3(0.0, 0.0, 1.0));
  float n101 = dot(veyraGradient(i + ivec3(1, 0, 1)), f - vec3(1.0, 0.0, 1.0));
  float n011 = dot(veyraGradient(i + ivec3(0, 1, 1)), f - vec3(0.0, 1.0, 1.0));
  float n111 = dot(veyraGradient(i + ivec3(1, 1, 1)), f - vec3(1.0, 1.0, 1.0));
  float x00 = mix(n000, n100, u.x);
  float x10 = mix(n010, n110, u.x);
  float x01 = mix(n001, n101, u.x);
  float x11 = mix(n011, n111, u.x);
  return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z) * 1.1547;
}
float fbm(vec2 p, int octaves) {
  float sum = 0.0, amp = 0.5, norm = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += amp * gnoise(p);
    norm += amp;
    p = p * 2.0 + vec2(19.7, 7.3);
    amp *= 0.5;
  }
  return sum / max(norm, 1e-6);
}
float fbm(vec3 p, int octaves) {
  float sum = 0.0, amp = 0.5, norm = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += amp * gnoise(p);
    norm += amp;
    p = p * 2.0 + vec3(19.7, 7.3, 3.1);
    amp *= 0.5;
  }
  return sum / max(norm, 1e-6);
}
#endif
`

/**
 * 2D signed distance functions and operators: `sdCircle`, `sdBox`,
 * `sdRoundBox`, `sdSegment`, `sdRing`, `opUnion`, `opSmoothUnion`,
 * `opSubtract`, `opSmoothSubtract`, `opIntersect`, and `fillAA(d, aa)` for an
 * antialiased coverage value (pass `fwidth(d)` as `aa` in a fragment shader).
 */
export const glslSdf = /* glsl */ `
#ifndef VEYRA_SDF
#define VEYRA_SDF
float sdCircle(vec2 p, float r) { return length(p) - r; }
float sdBox(vec2 p, vec2 halfSize) {
  vec2 d = abs(p) - halfSize;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float sdRoundBox(vec2 p, vec2 halfSize, float radius) { return sdBox(p, halfSize - radius) - radius; }
float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
float sdRing(vec2 p, float radius, float halfWidth) { return abs(length(p) - radius) - halfWidth; }
float opUnion(float a, float b) { return min(a, b); }
float opSubtract(float a, float b) { return max(a, -b); }
float opIntersect(float a, float b) { return max(a, b); }
float opSmoothUnion(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float opSmoothSubtract(float a, float b, float k) {
  float h = clamp(0.5 - 0.5 * (a + b) / k, 0.0, 1.0);
  return mix(a, -b, h) + k * h * (1.0 - h);
}
float fillAA(float d, float aa) {
  float w = max(aa, 1e-5);
  return 1.0 - smoothstep(-w, w, d);
}
#endif
`

/**
 * Color: `srgbToLinear`, `linearToSrgb`, `linearToOklab`, `oklabToLinear`,
 * `mixOklab(a, b, t)` (perceptual blend of linear colors) and
 * `cosinePalette(t, a, b, c, d)`.
 */
export const glslColor = /* glsl */ `
#ifndef VEYRA_COLOR
#define VEYRA_COLOR
vec3 srgbToLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 linearToSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 linearToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  vec3 lms = sign(vec3(l, m, s)) * pow(abs(vec3(l, m, s)), vec3(1.0 / 3.0));
  return vec3(
    0.2104542553 * lms.x + 0.7936177850 * lms.y - 0.0040720468 * lms.z,
    1.9779984951 * lms.x - 2.4285922050 * lms.y + 0.4505937099 * lms.z,
    0.0259040371 * lms.x + 0.7827717662 * lms.y - 0.8086757660 * lms.z
  );
}
vec3 oklabToLinear(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}
vec3 mixOklab(vec3 a, vec3 b, float t) { return oklabToLinear(mix(linearToOklab(a), linearToOklab(b), t)); }
vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) { return a + b * cos(6.28318530718 * (c * t + d)); }
#endif
`

/** Math helpers: `remap`, `remapClamped`, `smootherstep`, `rotate2d(angle)`. */
export const glslMath = /* glsl */ `
#ifndef VEYRA_MATH
#define VEYRA_MATH
float remap(float x, float a, float b, float c, float d) { return c + (x - a) * (d - c) / (b - a); }
float remapClamped(float x, float a, float b, float c, float d) { return c + clamp((x - a) / (b - a), 0.0, 1.0) * (d - c); }
float smootherstep(float e0, float e1, float x) {
  float t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}
mat2 rotate2d(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, s, -s, c);
}
#endif
`

/**
 * Fractal noise read from a `noiseTexture()` (`@veyra/core/three`) instead of
 * computed per pixel: one texture read per octave in place of dozens of
 * hashes, filtered by mipmaps in the distance. The texture holds the noise's
 * analytic gradient, so `tfbmd` needs no extra reads and its bump stays
 * smooth up close. Fragment shaders only (mip selection uses screen
 * derivatives). `p` is in noise cells, as for `fbm`; `cells` is the
 * texture's cells per side (`texture.userData.cells`).
 *
 * - `tfbm(tex, cells, vec2 p, octaves)` — about `[-1, 1]`.
 * - `tfbmd(tex, cells, vec2 p, octaves)` — `vec3(value, d/dx, d/dy)`, for bump mapping.
 * - `tfbm(tex, cells, vec3 p, vec3 n, octaves)` and `tfbmd(…)` → `vec4(value, gradient)` —
 *   triplanar, for world-space surfaces: no stretching on steep faces (`n` is the surface normal).
 */
export const glslNoiseTexture = /* glsl */ `
#ifndef VEYRA_NOISE_TEXTURE
#define VEYRA_NOISE_TEXTURE
// Each octave reads at twice the frequency, turned by about 37 degrees and
// shifted, so neither the octaves nor the tiles line up.
const mat2 VEYRA_TURN = mat2(0.8, 0.6, -0.6, 0.8);
const vec2 VEYRA_SHIFT = vec2(0.137, 0.291);
float tfbm(sampler2D tex, float cells, vec2 p, int octaves) {
  vec2 q = p / cells;
  vec2 dx = dFdx(q), dy = dFdy(q);
  float sum = 0.0, amp = 0.5, norm = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += amp * textureGrad(tex, q, dx, dy).r;
    norm += amp;
    q = VEYRA_TURN * q * 2.0 + VEYRA_SHIFT;
    dx = VEYRA_TURN * dx * 2.0;
    dy = VEYRA_TURN * dy * 2.0;
    amp *= 0.5;
  }
  return sum / max(norm, 1e-6);
}
vec3 tfbmd(sampler2D tex, float cells, vec2 p, int octaves) {
  vec2 q = p / cells;
  vec2 dx = dFdx(q), dy = dFdy(q);
  // q = m p: gradients read per tile map back to p through m's transpose.
  mat2 m = mat2(1.0 / cells);
  float sum = 0.0, amp = 0.5, norm = 0.0;
  vec2 grad = vec2(0.0);
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    vec3 s = textureGrad(tex, q, dx, dy).rgb;
    sum += amp * s.x;
    grad += amp * (transpose(m) * s.yz);
    norm += amp;
    q = VEYRA_TURN * q * 2.0 + VEYRA_SHIFT;
    dx = VEYRA_TURN * dx * 2.0;
    dy = VEYRA_TURN * dy * 2.0;
    m = VEYRA_TURN * m * 2.0;
    amp *= 0.5;
  }
  return vec3(sum, grad) / max(norm, 1e-6);
}
vec3 veyraTriplanar(vec3 n) {
  vec3 w = n * n;
  w *= w;
  return w / (w.x + w.y + w.z);
}
float tfbm(sampler2D tex, float cells, vec3 p, vec3 n, int octaves) {
  vec3 w = veyraTriplanar(n);
  return w.x * tfbm(tex, cells, p.zy, octaves) + w.y * tfbm(tex, cells, p.xz, octaves) + w.z * tfbm(tex, cells, p.xy, octaves);
}
vec4 tfbmd(sampler2D tex, float cells, vec3 p, vec3 n, int octaves) {
  vec3 w = veyraTriplanar(n);
  vec3 a = tfbmd(tex, cells, p.zy, octaves);
  vec3 b = tfbmd(tex, cells, p.xz, octaves);
  vec3 c = tfbmd(tex, cells, p.xy, octaves);
  return w.x * vec4(a.x, 0.0, a.z, a.y) + w.y * vec4(b.x, b.y, 0.0, b.z) + w.z * vec4(c.x, c.y, c.z, 0.0);
}
#endif
`
