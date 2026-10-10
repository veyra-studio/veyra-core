/**
 * Product-photography lighting without image files: softboxes, strip lights
 * and reflectors placed in a dark room, baked once into a prefiltered
 * environment map (PMREM). Glass, metal and liquids read their highlights
 * from it, the way they do from the real thing in a studio.
 *
 * ```ts
 * scene.environment = studioEnvironment(renderer)                 // the 'product' setup
 * scene.environment = studioEnvironment(renderer, { lights: studioLights.soft })
 * ```
 */
import * as THREE from 'three'

export interface StudioLight {
  /** Panel size `[width, height]` in room units (the room is about 20 units across). */
  size: readonly [number, number]
  /** Panel center. The subject sits at the origin; +z faces the camera, +y is up. */
  position: readonly [number, number, number]
  /** Radiance multiplier (1 = the color itself). */
  intensity: number
  /** Default white. */
  color?: THREE.ColorRepresentation
  /** Point the panel faces. Default: the origin. */
  target?: readonly [number, number, number]
  /** `'rect'` (softbox, strip) or `'disc'` (beauty dish, sun). Default `'rect'`. */
  shape?: 'rect' | 'disc'
}

export interface StudioOptions {
  /** The lights. Default `studioLights.product`. */
  lights?: readonly StudioLight[]
  /** Wall color at the top and bottom of the room. Default near-black. */
  walls?: readonly [top: THREE.ColorRepresentation, bottom: THREE.ColorRepresentation]
  /** Prefilter blur (radians). Default `0.02`. */
  blur?: number
}

/** Ready-made setups. */
export const studioLights: Record<'product' | 'soft', readonly StudioLight[]> = {
  /**
   * Bottles and glass: two tall strips behind the subject for rim
   * highlights, two front strips that draw long vertical highlights down the
   * glass, a soft key overhead on the right, a thin top bar for caps and
   * shoulders, and a faint floor bounce.
   */
  product: [
    { size: [0.9, 9], position: [-4.4, 0.4, -2.4], intensity: 9 },
    { size: [0.9, 9], position: [4.4, 0.4, -2.4], intensity: 9 },
    { size: [1.1, 7], position: [-3.6, 0.6, 4.2], intensity: 6 },
    { size: [0.6, 7], position: [3.9, 0.6, 3.9], intensity: 3, color: '#fff4e6' },
    { size: [5, 3], position: [2.8, 4.6, 3.4], intensity: 2.2, color: '#fff4e6' },
    { size: [6, 0.5], position: [0, 6.2, 0], intensity: 3 },
    { size: [9, 9], position: [0, -4.5, 0], intensity: 0.12, color: '#9fb4d3' },
  ],
  /** Soft and even: a big overhead box, a front scrim and side bounces (food, ceramics). */
  soft: [
    { size: [9, 9], position: [0, 7, 1.5], intensity: 2.6, color: '#fff6ec' },
    { size: [8, 5], position: [0, 1.5, 7], intensity: 0.9 },
    { size: [4, 6], position: [-6.5, 1, 0], intensity: 0.6, color: '#e6efff' },
    { size: [4, 6], position: [6.5, 1, 0], intensity: 0.8, color: '#fff1e0' },
    { size: [12, 12], position: [0, -5, 0], intensity: 0.25, color: '#f2ede4' },
  ],
}

const wallVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const wallFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  varying vec3 vDir;
  void main() {
    gl_FragColor = vec4(mix(uBottom, uTop, smoothstep(-0.6, 0.8, vDir.y)), 1.0);
  }
`

/** Bakes a studio into a PMREM environment texture. Dispose it with the renderer's other textures. */
export function studioEnvironment(renderer: THREE.WebGLRenderer, options: StudioOptions = {}): THREE.Texture {
  const scene = new THREE.Scene()
  const [top, bottom] = options.walls ?? ['#07080b', '#030304']
  const wallMaterial = new THREE.ShaderMaterial({
    vertexShader: wallVertex,
    fragmentShader: wallFragment,
    uniforms: { uTop: { value: new THREE.Color(top) }, uBottom: { value: new THREE.Color(bottom) } },
    side: THREE.BackSide,
    depthWrite: false,
  })
  const walls = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), wallMaterial)
  scene.add(walls)

  const rect = new THREE.PlaneGeometry(1, 1)
  const disc = new THREE.CircleGeometry(0.5, 48)
  const materials: THREE.Material[] = [wallMaterial]
  const lights: readonly StudioLight[] = options.lights ?? studioLights.product
  for (const light of lights) {
    const color = new THREE.Color(light.color ?? '#ffffff').multiplyScalar(light.intensity)
    const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false })
    materials.push(material)
    const mesh = new THREE.Mesh(light.shape === 'disc' ? disc : rect, material)
    mesh.scale.set(light.size[0], light.size[1], 1)
    const [x, y, z] = light.position
    const [tx, ty, tz] = light.target ?? [0, 0, 0]
    mesh.position.set(x, y, z)
    mesh.lookAt(tx, ty, tz)
    scene.add(mesh)
  }

  const pmrem = new THREE.PMREMGenerator(renderer)
  const target = pmrem.fromScene(scene, options.blur ?? 0.02)
  pmrem.dispose()
  for (const m of materials) m.dispose()
  walls.geometry.dispose()
  rect.dispose()
  disc.dispose()
  return target.texture
}
