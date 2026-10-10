/**
 * Clear solids — ice, glass blocks, crystal — ray-traced from the inside.
 *
 * Patches a `MeshPhysicalMaterial` so the light that passes through the
 * mesh is traced through a solid described by a signed distance function:
 * the view ray refracts at the surface, runs to the far side (found by
 * bisection on the SDF), refracts out — or reflects back in past the
 * critical angle, which is what draws the bright and dark edges of real
 * glass and ice — and samples what lies beyond: the scene's environment
 * map, or a world of your own (`outside`). The surface reflects that same
 * world. Nothing depends on what the canvas shows behind the mesh, and
 * there is no transmission pass.
 *
 * ```ts
 * // A glass block with rounded edges (half extents 1, 0.6, 1; radius 0.15).
 * const material = new THREE.MeshPhysicalMaterial({ color: 0x000000, specularIntensity: 0, transparent: true })
 * refractiveSolid(material, {
 *   sdf: `float solidSdf(vec3 p) {
 *     vec3 d = abs(p) - (vec3(1.0, 0.6, 1.0) - 0.15);
 *     return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0) - 0.15;
 *   }`,
 *   bounds: new THREE.Vector3(1, 0.6, 1),
 *   inner: new THREE.Vector3(0.93, 0.53, 0.93),
 *   ior: 1.5,
 * })
 * scene.add(new THREE.Mesh(roundedBoxGeometry, material))   // the mesh gives the entry point and normal
 * ```
 *
 * Keep the material's `color` black and its `specularIntensity` 0 (the
 * traced light replaces its shading), and consider `transparent: true`:
 * the solid still writes depth and covers what's behind it, but three.js
 * then leaves it out of the transmission pre-pass other glass triggers,
 * so it isn't traced twice a frame.
 */
import * as THREE from 'three';
const varyings = /* glsl */ `
varying vec3 vSolidPos;
varying vec3 vSolidNormal;
varying vec3 vSolidEye;
varying mat3 vSolidBasis;
varying vec3 vSolidOrigin;
`;
export function refractiveSolid(material, options) {
    const uniforms = {
        solidBounds: { value: options.bounds.clone() },
        solidInner: { value: options.inner?.clone() ?? new THREE.Vector3() },
        solidIor: { value: options.ior ?? 1.5 },
        solidAbsorption: { value: new THREE.Vector3(...(options.absorption ?? [0, 0, 0])) },
        solidBlur: { value: options.blur ?? 0 },
        ...options.uniforms,
    };
    const bounces = Math.max(1, Math.round(options.bounces ?? 3));
    const steps = Math.max(3, Math.round(options.steps ?? (options.inner ? 6 : 10)));
    const reflection = options.reflection ?? true;
    const fragment = /* glsl */ `
${varyings}
uniform vec3 solidBounds;
uniform vec3 solidInner;
uniform float solidIor;
uniform vec3 solidAbsorption;
uniform float solidBlur;

// The environment map in a world-space direction.
vec3 solidEnvironment(vec3 direction, float roughness) {
#ifdef USE_ENVMAP
  return textureCubeUV(envMap, envMapRotation * direction, roughness).rgb * envMapIntensity;
#else
  return vec3(0.0);
#endif
}

${options.sdf}
${options.normal ??
        /* glsl */ `vec3 solidNormal(vec3 p) {
  float e = 0.002 * max(solidBounds.x, max(solidBounds.y, solidBounds.z));
  const vec2 k = vec2(1.0, -1.0);
  return normalize(
    k.xyy * solidSdf(p + k.xyy * e) + k.yyx * solidSdf(p + k.yyx * e) +
    k.yxy * solidSdf(p + k.yxy * e) + k.xxx * solidSdf(p + k.xxx * e));
}`}
${options.bump ?? 'vec3 solidBump(vec3 p, vec3 n) { return n; }'}
${options.inside ?? 'void solidInside(vec3 p, vec3 d, float len, int bounce, inout vec3 light, inout vec3 through) {}'}
${options.outside ?? 'vec3 solidOutside(vec3 position, vec3 direction) { return solidEnvironment(direction, solidBlur); }'}

// From p (inside) along d to the surface: bracketed by the inner box (if the
// ray crosses it, its exit from there is still inside) and the bounds, then bisection.
float solidExit(vec3 p, vec3 d) {
  vec3 s = mix(vec3(-1.0), vec3(1.0), step(0.0, d));
  vec3 inv = 1.0 / (s * max(abs(d), vec3(1e-5)));
  vec3 far = (s * solidBounds - p) * inv;
  float b = max(min(far.x, min(far.y, far.z)), 0.0);
  float a = 0.0;
  vec3 farIn = (s * solidInner - p) * inv;
  vec3 nearIn = (-s * solidInner - p) * inv;
  float tFar = min(farIn.x, min(farIn.y, farIn.z));
  if (solidInner.x > 0.0 && max(nearIn.x, max(nearIn.y, nearIn.z)) <= tFar && tFar > 0.0) a = min(tFar, b);
  for (int i = 0; i < ${steps}; i++) {
    float m = 0.5 * (a + b);
    if (solidSdf(p + d * m) < 0.0) a = m; else b = m;
  }
  return 0.5 * (a + b);
}

// Light arriving along the view ray v at the surface point p (outward normal n), minus the surface reflection.
vec3 solidTrace(vec3 p, vec3 v, vec3 n) {
  float e = 0.002 * max(solidBounds.x, max(solidBounds.y, solidBounds.z));
  float f0 = pow((solidIor - 1.0) / (solidIor + 1.0), 2.0);
  vec3 d = refract(v, n, 1.0 / solidIor);
  vec3 light = vec3(0.0);
  vec3 through = vec3(1.0);
  p -= n * e;
  for (int i = 0; i < ${bounces}; i++) {
    float len = solidExit(p, d);
    solidInside(p, d, len, i, light, through);
    through *= exp(-solidAbsorption * len);
    p += d * len;
    vec3 m = solidBump(p, solidNormal(p));
    vec3 o = refract(d, -m, solidIor);
    bool last = i == ${bounces - 1};
    if (dot(o, o) > 0.0) {
      // Out into the air; part of it reflects back in.
      float c = 1.0 - clamp(dot(o, m), 0.0, 1.0);
      float f = last ? 0.0 : f0 + (1.0 - f0) * c * c * c * c * c;
      light += through * (1.0 - f) * solidOutside(vSolidBasis * p + vSolidOrigin, normalize(vSolidBasis * o));
      through *= f;
    } else if (last) {
      // Still caught inside: let it out unbent.
      light += through * solidOutside(vSolidBasis * p + vSolidOrigin, normalize(vSolidBasis * d));
    }
    if (max(through.r, max(through.g, through.b)) < 0.004) break;
    d = reflect(d, m);
    p -= m * e;
  }
  return light;
}
`;
    // three.js builds a program's cache key whenever a material may need
    // another program (e.g. every frame it draws both to the screen and to a
    // render target): keep this part short — a hash of the source.
    const key = `veyra-solid:${hash([bounces, steps, reflection, options.sdf, options.normal, options.bump, options.inside, options.outside].join('|'))}`;
    material.customProgramCacheKey = () => key;
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>\n${varyings}`)
            .replace('#include <worldpos_vertex>', 
        /* glsl */ `#include <worldpos_vertex>
        vSolidPos = transformed;
        vSolidNormal = objectNormal;
        mat4 solidInverse = inverse(modelViewMatrix);
        vSolidEye = isOrthographic
          ? transformed + 1e4 * normalize((solidInverse * vec4(0.0, 0.0, 1.0, 0.0)).xyz)
          : (solidInverse * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vSolidBasis = mat3(modelMatrix);
        vSolidOrigin = modelMatrix[3].xyz;`);
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <clipping_planes_pars_fragment>', `#include <clipping_planes_pars_fragment>\n${fragment}`)
            .replace('#include <opaque_fragment>', 
        /* glsl */ `{
          vec3 solidN = normalize(solidBump(vSolidPos, normalize(vSolidNormal)));
          vec3 solidV = normalize(vSolidPos - vSolidEye);
          float solidF0 = pow((solidIor - 1.0) / (solidIor + 1.0), 2.0);
          float solidF = solidF0 + (1.0 - solidF0) * pow(1.0 - clamp(dot(-solidV, solidN), 0.0, 1.0), 5.0);
          outgoingLight += (1.0 - solidF) * solidTrace(vSolidPos, solidV, solidN);
          ${reflection ? 'outgoingLight += solidF * solidOutside(vSolidBasis * vSolidPos + vSolidOrigin, normalize(vSolidBasis * reflect(solidV, solidN)));' : ''}
          diffuseColor.a = 1.0;
        }
        #include <opaque_fragment>`);
    };
    material.needsUpdate = true;
    return { uniforms };
}
/** A 53-bit string hash (cyrb53), in base 36. */
function hash(text) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 2654435761);
        h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
//# sourceMappingURL=solid.js.map