import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { warmUp } from '../src/three/warm'

describe('warmUp', () => {
  it('compiles first, draws once into one pixel with shadows, then restores the renderer', async () => {
    const calls: string[] = []
    let viewport = new THREE.Vector4(0, 0, 800, 600)
    let scissor = new THREE.Vector4(0, 0, 800, 600)
    let scissorTest = false
    const rt = new THREE.WebGLRenderTarget(4, 4)
    let target: THREE.WebGLRenderTarget | null = rt
    const renderer = {
      shadowMap: { needsUpdate: false },
      compileAsync: async () => void calls.push('compile'),
      getRenderTarget: () => target,
      setRenderTarget: (t: THREE.WebGLRenderTarget | null) => void ((target = t), calls.push(`target ${t ? 'rt' : 'canvas'}`)),
      getViewport: (v: THREE.Vector4) => v.copy(viewport),
      setViewport: (x: number | THREE.Vector4, y = 0, w = 0, h = 0) => void (viewport = x instanceof THREE.Vector4 ? x.clone() : new THREE.Vector4(x, y, w, h)),
      getScissor: (v: THREE.Vector4) => v.copy(scissor),
      setScissor: (x: number | THREE.Vector4, y = 0, w = 0, h = 0) => void (scissor = x instanceof THREE.Vector4 ? x.clone() : new THREE.Vector4(x, y, w, h)),
      getScissorTest: () => scissorTest,
      setScissorTest: (on: boolean) => void (scissorTest = on),
      render() {
        calls.push(`render ${viewport.toArray().join(',')} shadows ${renderer.shadowMap.needsUpdate} scissor ${scissorTest}`)
        renderer.shadowMap.needsUpdate = false
      },
    }
    await warmUp(renderer as unknown as THREE.WebGLRenderer, new THREE.Scene(), new THREE.PerspectiveCamera())
    expect(calls).toEqual(['compile', 'target canvas', 'render 0,0,1,1 shadows true scissor true', 'target rt'])
    expect(viewport.toArray()).toEqual([0, 0, 800, 600])
    expect(scissor.toArray()).toEqual([0, 0, 800, 600])
    expect(scissorTest).toBe(false)
    expect(renderer.shadowMap.needsUpdate).toBe(false)
    rt.dispose()
  })
})
