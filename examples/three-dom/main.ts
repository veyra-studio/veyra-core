import * as THREE from 'three'
import { createStage, damp, scenePresets } from '@veyra/core'
import { supportsWebGL2, threeLayer } from '@veyra/core/three'

const stage = createStage()

if (supportsWebGL2()) {
  const gl = stage.use(threeLayer({ zIndex: 0 }))
  gl.renderer.setClearColor(0x000000, 0)

  // Tiles: a shader plane per DOM figure, bent by scroll velocity.
  const bend = { value: 0 }
  const geometry = new THREE.PlaneGeometry(1, 1, 32, 32)
  document.querySelectorAll<HTMLElement>('.tile').forEach((tile, i) => {
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBend: bend, uHue: { value: Number(tile.dataset.hue) }, uSeed: { value: i * 1.7 } },
      vertexShader: /* glsl */ `
        uniform float uBend;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.z += sin(uv.x * 3.14159) * uBend * 120.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uHue; uniform float uSeed;
        varying vec2 vUv;
        vec3 hsv(float h, float s, float v) { vec3 k = clamp(abs(mod(h * 6.0 + vec3(0, 4, 2), 6.0) - 3.0) - 1.0, 0.0, 1.0); return v * mix(vec3(1.0), k, s); }
        void main() {
          float w = sin(vUv.y * 9.0 + uTime * 0.8 + uSeed) * 0.5 + 0.5;
          float g = smoothstep(0.0, 1.0, vUv.y);
          vec3 col = mix(hsv(uHue, 0.75, 0.35), hsv(uHue + 0.08, 0.6, 0.95), g * 0.7 + w * 0.3);
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
    const mesh = new THREE.Mesh(geometry, material)
    gl.scene.add(mesh)
    gl.anchor(tile, mesh, { size: true })
    stage.onFrame((f) => (material.uniforms.uTime!.value = f.time))
  })
  stage.onFrame((f) => {
    const v = stage.scroll ? stage.scroll.velocity / 3000 : 0
    bend.value = damp(bend.value, Math.max(-1, Math.min(1, v)), 6, f.delta)
  })

  // Real HTML headline mirrored into the GL scene.
  const headline = document.getElementById('headline')!
  await document.fonts.ready
  const mirror = gl.mirrorText(headline)
  ;(mirror.mesh.material as THREE.MeshBasicMaterial).color = new THREE.Color('#ffb38a')
  document.documentElement.classList.add('gl-ready')
  stage.viewport.onLayout(() => requestAnimationFrame(mirror.refresh))

  // A lit object anchored to an empty sticky box.
  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.3, 0.1, 220, 28),
    new THREE.MeshStandardMaterial({ color: '#efeadf', roughness: 0.25, metalness: 0.6 }),
  )
  gl.scene.add(knot, new THREE.HemisphereLight('#ffffff', '#202024', 2.2))
  const key = new THREE.DirectionalLight('#ffd2b0', 3)
  key.position.set(400, 600, 800)
  gl.scene.add(key)
  const knotAnchor = gl.anchor('#knot', knot, { live: true })
  stage.scene('.knot-wrap', {
    ...scenePresets.pinned,
    onUpdate(scene) {
      const s = knotAnchor.rect.width
      knot.scale.setScalar(s)
      knot.rotation.set(scene.progress * Math.PI * 2, scene.progress * Math.PI * 3, 0)
    },
  })
}
