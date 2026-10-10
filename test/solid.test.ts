import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { refractiveSolid, type SolidOptions } from '../src/three/solid'

const sdf = `float solidSdf(vec3 p) {
  vec3 d = abs(p) - vec3(0.8);
  return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0) - 0.2;
}`
const bounds = new THREE.Vector3(1, 1, 1)

// Runs the material's patch over three.js's own physical shader, as the renderer would.
function compile(options: Partial<SolidOptions> = {}) {
  const material = new THREE.MeshPhysicalMaterial()
  const solid = refractiveSolid(material, { sdf, bounds, ...options })
  const shader = {
    uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms),
    vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader: THREE.ShaderLib.physical.fragmentShader,
  }
  material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, undefined as unknown as THREE.WebGLRenderer)
  return { material, solid, shader, key: material.customProgramCacheKey() }
}

describe('refractive solid', () => {
  it("finds its hooks in three.js's physical shader", () => {
    const { shader } = compile()
    expect(shader.vertexShader).toContain('vSolidEye = isOrthographic')
    expect(shader.vertexShader).toContain('varying mat3 vSolidBasis;')
    const f = shader.fragmentShader
    expect(f).toContain('vec3 solidTrace(vec3 p, vec3 v, vec3 n)')
    expect(f.indexOf('vec3 solidTrace(')).toBeLessThan(f.indexOf('void main()'))
    expect(f).toContain('outgoingLight += (1.0 - solidF) * solidTrace(vSolidPos, solidV, solidN);')
    expect(f.indexOf('solidTrace(vSolidPos')).toBeLessThan(f.indexOf('#include <opaque_fragment>'))
  })

  it('fills in the hooks you leave out, and uses the ones you give', () => {
    const plain = compile().shader.fragmentShader
    expect(plain).toContain('void solidInside(vec3 p, vec3 d, float len, int bounce, inout vec3 light, inout vec3 through) {}')
    expect(plain).toContain('vec3 solidOutside(vec3 position, vec3 direction) { return solidEnvironment(direction, solidBlur); }')
    expect(plain).toContain('vec3 solidBump(vec3 p, vec3 n) { return n; }')
    expect(plain).toContain('k.xyy * solidSdf(p + k.xyy * e)')
    const outside = 'vec3 solidOutside(vec3 position, vec3 direction) { return vec3(1.0, 0.0, 0.0); }'
    const normal = 'vec3 solidNormal(vec3 p) { return normalize(p); }'
    const custom = compile({ outside, normal }).shader.fragmentShader
    expect(custom).toContain(outside)
    expect(custom).toContain(normal)
    expect(custom).not.toContain('k.xyy * solidSdf(p + k.xyy * e)')
  })

  it('reflects the same world at the surface unless told not to', () => {
    expect(compile().shader.fragmentShader).toContain('outgoingLight += solidF * solidOutside(')
    expect(compile({ reflection: false }).shader.fragmentShader).not.toContain('outgoingLight += solidF * solidOutside(')
  })

  it('shares its uniforms with the program, yours included', () => {
    const extra = { uTint: { value: new THREE.Color('#ff0000') } }
    const { solid, shader } = compile({ ior: 1.31, absorption: [1, 2, 3], uniforms: extra })
    expect(shader.uniforms.solidIor).toBe(solid.uniforms.solidIor)
    expect(solid.uniforms.solidIor!.value).toBe(1.31)
    expect((solid.uniforms.solidAbsorption!.value as THREE.Vector3).toArray()).toEqual([1, 2, 3])
    expect((shader.uniforms as Record<string, THREE.IUniform>).uTint).toBe(extra.uTint)
    // No inner box: zero, which the exit search skips.
    expect((solid.uniforms.solidInner!.value as THREE.Vector3).toArray()).toEqual([0, 0, 0])
  })

  it('searches each exit in 10 steps, 6 with an inner box; follows 3 bounces', () => {
    expect(compile().shader.fragmentShader).toContain('for (int i = 0; i < 10; i++)')
    const inner = compile({ inner: new THREE.Vector3(0.9, 0.9, 0.9) }).shader.fragmentShader
    expect(inner).toContain('for (int i = 0; i < 6; i++)')
    expect(inner).toContain('for (int i = 0; i < 3; i++)')
    expect(compile({ bounces: 1, steps: 4 }).shader.fragmentShader).toContain('bool last = i == 0;')
  })

  it('keys the program by everything compiled into it', () => {
    const a = compile().key
    expect(compile().key).toBe(a)
    expect(compile({ bounces: 2 }).key).not.toBe(a)
    expect(compile({ reflection: false }).key).not.toBe(a)
    expect(compile({ inside: 'void solidInside(vec3 p, vec3 d, float len, int bounce, inout vec3 light, inout vec3 through) { light += 0.1; }' }).key).not.toBe(a)
    // Uniform values don't change the program.
    expect(compile({ ior: 1.2, bounds: new THREE.Vector3(2, 2, 2) }).key).toBe(a)
  })
})
