import { describe, expect, it } from 'vitest'
import { isSoftwareRenderer } from '../src/env/capabilities'

const RENDERER = 0x1f01
const UNMASKED = 0x9246
const fakeGl = (renderer: string, unmasked?: string) =>
  ({
    RENDERER,
    getParameter: (p: number) => (p === RENDERER ? renderer : p === UNMASKED ? unmasked : null),
    getExtension: (name: string) => (name === 'WEBGL_debug_renderer_info' && unmasked !== undefined ? { UNMASKED_RENDERER_WEBGL: UNMASKED } : null),
  }) as unknown as WebGL2RenderingContext

describe('isSoftwareRenderer', () => {
  it('reads the unmasked name where the plain one is hidden', () => {
    expect(isSoftwareRenderer(fakeGl('WebKit WebGL', 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)'))).toBe(true)
    expect(isSoftwareRenderer(fakeGl('WebKit WebGL', 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)'))).toBe(false)
  })

  it('recognizes software renderers by their plain names too', () => {
    expect(isSoftwareRenderer(fakeGl('llvmpipe (LLVM 15.0.7, 256 bits)'))).toBe(true)
    expect(isSoftwareRenderer(fakeGl('Microsoft Basic Render Driver'))).toBe(true)
    expect(isSoftwareRenderer(fakeGl('Mali-G78'))).toBe(false)
  })

  it('says no when the name is unavailable', () => {
    expect(isSoftwareRenderer(fakeGl('WebKit WebGL'))).toBe(false)
    expect(isSoftwareRenderer({ getParameter: () => { throw new Error('lost') } } as unknown as WebGL2RenderingContext)).toBe(false)
  })
})
