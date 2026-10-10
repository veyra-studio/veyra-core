import * as THREE from 'three'
import { bakeOcclusion, bakeSunlight, createStage, erodedNoise, heightfield, Phase, ridgedNoise } from '@veyra/core'
import { glslNoiseTexture } from '@veyra/core/glsl'
import { condensationMaps, ContactShadow, heightfieldGeometry, noiseTexture, Profile, ReflectiveFloor, studioEnvironment, threeLayer } from '@veyra/core/three'

const stage = createStage({ quality: { dprRange: [1, 2] } })
const status: Record<string, unknown> = {}

// ---------------------------------------------------------------------
// 1 — A product shot: bottle, label band, condensation, floor, shadow.
// ---------------------------------------------------------------------
const layer = stage.use(threeLayer({ fov: 15, zIndex: 1, near: 2, autoRender: false }))
const { renderer, scene, camera } = layer
renderer.setClearColor(0x000000, 0)
renderer.toneMapping = THREE.NeutralToneMapping
scene.environment = studioEnvironment(renderer)

// A generic soda bottle, measured as [radius, height] from the bottom.
const outer = new Profile(
  [
    [0, 0.01],
    [0.1, 0],
    [0.14, 0.03],
    [0.15, 0.1],
    [0.15, 0.5],
    [0.13, 0.6],
    [0.07, 0.78],
    [0.06, 0.9],
    [0.065, 0.93],
    [0.065, 0.96],
    [0.055, 0.97],
  ],
  { samples: 6, corners: [1] },
)
status.volume = outer.volume()
const maps = condensationMaps({ size: 512, seed: 2 })
const normalMap = new THREE.CanvasTexture(maps.normal)
const roughnessMap = new THREE.CanvasTexture(maps.roughness)
for (const t of [normalMap, roughnessMap]) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(2, 2)
}
const glass = new THREE.MeshPhysicalMaterial({ color: '#fff', roughness: 0.6, roughnessMap, normalMap, normalScale: new THREE.Vector2(0.3, 0.3), transmission: 1, thickness: 0.03, ior: 1.5, attenuationColor: new THREE.Color('#cfe6d6'), attenuationDistance: 200 })
const bottle = new THREE.Group()
bottle.add(new THREE.Mesh(outer.geometry(96), glass))
const liquid = outer.offset(0.01).clip(0.03, 0.82)
// Opaque inside: three.js glass refracts only opaque objects behind it.
bottle.add(new THREE.Mesh(liquid.geometry(96), new THREE.MeshPhysicalMaterial({ color: '#b8361a', roughness: 0.25, clearcoat: 0.5 })))
// The label sits on the shoulder's cone: its rules follow the cut, the type keeps its shape.
const band = outer.band({ from: 0.52, to: 0.66, arc: Math.PI * 0.9, lift: 0.002 })
const art = document.createElement('canvas')
art.width = 1024
art.height = Math.round(1024 / (band.width / band.height))
{
  const ctx = art.getContext('2d')!
  ctx.fillStyle = '#efeadf'
  ctx.fillRect(0, 0, art.width, art.height)
  ctx.strokeStyle = '#111110'
  ctx.lineWidth = art.height * 0.04
  ctx.beginPath()
  for (const v of [0.1, 0.9]) {
    const half = band.halfWidthAt(v) * art.width
    const y = (1 - v) * art.height
    ctx.moveTo(art.width / 2 - half, y)
    ctx.lineTo(art.width / 2 + half, y)
  }
  ctx.stroke()
  ctx.fillStyle = '#111110'
  ctx.font = `600 ${art.height * 0.5}px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Veyra', art.width / 2, art.height / 2)
}
const labelTex = new THREE.CanvasTexture(art)
labelTex.colorSpace = THREE.SRGBColorSpace
bottle.add(new THREE.Mesh(band.geometry, new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.5 })))
scene.add(bottle)

const REFLECT = 3
bottle.traverse((o) => o.layers.enable(REFLECT))
camera.layers.enable(REFLECT)
const floor = new ReflectiveFloor({ width: 8000, depth: 8000, strength: 0.4, layer: REFLECT })
scene.add(floor.mesh)
const shadow = new ContactShadow({ width: 1, depth: 1, far: 1, opacity: 0.85 })
shadow.cast(bottle)
scene.add(shadow.object)

const slot = document.getElementById('slot')!
stage.rects.track(slot, { live: true })
const stageWrap = document.querySelector('.stage-wrap')!
let turn = 0
stage.scene(stageWrap, { start: 'top top', end: 'bottom bottom', onProgress: (p) => (turn = p * Math.PI * 1.5) })
stage.onFrame(() => {
  const r = stage.rects.view(slot)
  const S = r.height
  const baseY = -(r.top + r.height - layer.height / 2)
  bottle.scale.setScalar(S)
  bottle.position.set(r.left + r.width / 2 - layer.width / 2, baseY, 0)
  bottle.rotation.y = turn + 0.4
  glass.attenuationDistance = S * 0.3
  floor.mesh.position.y = baseY
  floor.setFade(0, S * 0.3)
  shadow.object.position.set(bottle.position.x, baseY + 0.5, 0)
  shadow.resize(S * 1.4, S * 1.4, S * 0.5)
  const visible = r.bottom > 0 && r.top < layer.height
  layer.canvas.style.visibility = visible ? 'visible' : 'hidden'
  if (!visible) return
  floor.update(renderer, scene, camera)
  shadow.update(renderer, scene)
  renderer.render(scene, camera)
  status.frames = ((status.frames as number) ?? 0) + 1
}, Phase.render + 1)

// ---------------------------------------------------------------------
// 2 — Terrain: a height field baked once, drawn with a small shader.
// ---------------------------------------------------------------------
{
  const canvas = document.getElementById('terrain') as HTMLCanvasElement
  const r2 = new THREE.WebGLRenderer({ canvas, antialias: true })
  r2.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  const t0 = performance.now()
  const field = heightfield({
    size: [6000, 6000],
    resolution: 192,
    height: (x, z) => erodedNoise(x / 2200, z / 2200, { seed: 4 }) * 1400 + ridgedNoise(x / 900, z / 900, { seed: 1 }) * 260,
  })
  const sunDir = new THREE.Vector3(0.8, 0.45, -0.4).normalize()
  const sun = bakeSunlight(field, [sunDir.x, sunDir.y, sunDir.z])
  const ao = bakeOcclusion(field)
  status.terrain = {
    ms: Math.round(performance.now() - t0),
    shadowed: Array.from(sun).filter((v) => v < 0.5).length / sun.length,
    range: [Math.round(field.min), Math.round(field.max)],
  }
  const geometry = heightfieldGeometry(field, { attributes: { aSun: sun, aOcclusion: ao } })
  // Rock and drift detail read from a noise texture, not computed per pixel.
  const noise = noiseTexture({ cells: 8 })
  noise.anisotropy = r2.capabilities.getMaxAnisotropy()
  const material = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: sunDir }, uNoise: { value: noise }, uDetail: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSun; attribute float aOcclusion;
      varying vec3 vN; varying float vS; varying float vA; varying float vD; varying vec3 vW;
      void main() {
        vN = normal; vS = aSun; vA = aOcclusion; vW = (modelMatrix * vec4(position, 1.0)).xyz;
        vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${glslNoiseTexture}
      uniform vec3 uSun; uniform sampler2D uNoise; uniform float uDetail;
      varying vec3 vN; varying float vS; varying float vA; varying float vD; varying vec3 vW;
      void main() {
        vec3 n = normalize(vN);
        // Triplanar, so cliffs don't streak: rock in the albedo, and its
        // gradient (stored in the texture) bumps the normal.
        float rock = tfbm(uNoise, 8.0, vW * 0.02, n, 4) * uDetail;
        vec3 g = tfbmd(uNoise, 8.0, vW * 0.01, n, 3).yzw * uDetail;
        n = normalize(n - (g - n * dot(g, n)) * 0.6);
        float snow = smoothstep(0.62, 0.78, n.y + rock * 0.12) * smoothstep(500.0, 900.0, vW.y + rock * 140.0);
        vec3 albedo = mix(vec3(0.28, 0.26, 0.24) * (1.0 + rock * 0.6), vec3(0.92, 0.94, 0.97), snow);
        vec3 col = albedo * (vec3(1.0, 0.95, 0.86) * max(dot(n, uSun), 0.0) * vS * 2.2 + vec3(0.42, 0.55, 0.75) * vA * 0.7);
        col = mix(col, vec3(0.72, 0.8, 0.9), 1.0 - exp(-vD * 0.00012));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  })
  const s2 = new THREE.Scene()
  s2.background = new THREE.Color('#b9cde3')
  s2.add(new THREE.Mesh(geometry, material))
  const cam = new THREE.PerspectiveCamera(40, 2, 10, 40000)
  cam.position.set(-1800, 2400, 3600)
  cam.lookAt(0, 300, -600)
  const resize = () => {
    const w = canvas.clientWidth
    r2.setSize(w, w / 2, false)
    cam.aspect = 2
    cam.updateProjectionMatrix()
    r2.render(s2, cam)
  }
  resize()
  stage.viewport.onLayout(resize)
  // For the browser checks: fine contrast between neighboring pixels, with and without the detail.
  const g2 = r2.getContext()
  status.terrainDetail = () => {
    const contrast = (detail: number) => {
      material.uniforms.uDetail!.value = detail
      r2.render(s2, cam)
      const w = r2.domElement.width
      const h = r2.domElement.height
      const row = new Uint8Array(w * 4)
      let sum = 0
      let n = 0
      for (const y of [0.45, 0.55, 0.65]) {
        g2.readPixels(0, Math.round(h * y), w, 1, g2.RGBA, g2.UNSIGNED_BYTE, row)
        for (let x = 4; x < w * 4; x += 4) {
          sum += Math.abs(row[x]! - row[x - 4]!)
          n++
        }
      }
      return sum / n
    }
    const result = { flat: contrast(0), detailed: contrast(1) }
    r2.render(s2, cam)
    return result
  }
}

// For the browser checks: render now and read one pixel (CSS coordinates).
const gl = renderer.getContext()
const sample = (x: number, y: number) => {
  floor.update(renderer, scene, camera)
  shadow.update(renderer, scene)
  renderer.render(scene, camera)
  const px = new Uint8Array(4)
  const dpr = renderer.getPixelRatio()
  gl.readPixels(Math.round(x * dpr), Math.round((layer.height - y) * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
  return Array.from(px)
}
const slotRect = () => stage.rects.view(slot)

// For the browser checks: the empty neck's alpha over the transparent canvas,
// with three.js's half-white fill and with see-through glass.
status.neckAlpha = () => {
  const r = slotRect()
  const at = () => sample(r.left + r.width / 2, r.top + r.height * 0.1)[3]
  layer.seeThroughGlass = false
  const milky = at()
  layer.seeThroughGlass = true
  const clear = at()
  layer.seeThroughGlass = false
  return { milky, clear }
}
status.software = layer.software
status.tier = stage.quality?.tier.value
Object.assign(window, { __ex: { status, stage, sample, slotRect } })
