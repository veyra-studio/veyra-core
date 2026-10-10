/**
 * Magnetic elements lean toward a nearby pointer and spring back when it
 * leaves — buttons that feel alive. An inner element (a label, an icon)
 * can move further for a sense of depth. Off for touch input and reduced
 * motion.
 *
 * ```ts
 * stage.use(magnetic('.cta', { strength: 0.4, inner: '.cta-label' }))
 * ```
 */
import { Phase } from '../core/ticker.js'
import { Spring, type SpringConfig } from '../motion/spring.js'
import { writeValue } from '../motion/style.js'
import type { StagePlugin } from '../stage.js'

export interface MagneticOptions {
  /** Share of the pointer's offset from the center that the element follows, `0…1`. Default `0.35`. */
  strength?: number
  /** How far outside the element (px) the pull starts. Default `48`. */
  radius?: number
  /** Selector of an inner element that moves further. */
  inner?: string
  /** Share of the pointer offset applied to the inner element. Default `strength × 1.6`. */
  innerStrength?: number
  /** Default: lively with a light overshoot. */
  spring?: SpringConfig
  /** Re-measure every frame — for elements inside sticky or moving containers. */
  live?: boolean
}

export interface Magnetic {
  readonly el: HTMLElement
  /** The pointer is within reach. */
  readonly active: boolean
  destroy(): void
}

export function magnetic(target: Element | string, options: MagneticOptions = {}): StagePlugin<Magnetic> {
  return (stage, onDestroy) => {
    const el = (typeof target === 'string' ? document.querySelector(target) : target) as HTMLElement | null
    if (!el) throw new Error(`[veyra] magnetic: no element for ${String(target)}`)
    const inner = options.inner ? el.querySelector<HTMLElement>(options.inner) : null
    const strength = options.strength ?? 0.35
    const innerRatio = (options.innerStrength ?? strength * 1.6) / Math.max(1e-6, strength)
    const radius = options.radius ?? 48
    const config = options.spring ?? { stiffness: 180, damping: 15, mass: 1 }
    const sx = new Spring(0, config)
    const sy = new Spring(0, config)
    // Layout box in document coordinates, without our own offset.
    let box = { left: 0, top: 0, width: 0, height: 0 }
    let active = false

    const measure = () => {
      const r = el.getBoundingClientRect()
      box = { left: r.left + window.scrollX - sx.value, top: r.top + stage.scrollY - sy.value, width: r.width, height: r.height }
    }
    measure()
    const stopLayout = stage.onRefresh(measure)
    const removeMeasure = options.live ? stage.onFrame(measure, Phase.measure) : () => {}

    const removeFrame = stage.onFrame((frame) => {
      const p = stage.pointer
      const enabled = p && p.inside && p.type !== 'touch' && !stage.viewport.touch.value && !stage.reducedMotion.value
      let tx = 0
      let ty = 0
      active = false
      if (enabled) {
        const left = box.left - window.scrollX
        const top = box.top - stage.scrollY
        if (p.x >= left - radius && p.x <= left + box.width + radius && p.y >= top - radius && p.y <= top + box.height + radius) {
          active = true
          tx = (p.x - (left + box.width / 2)) * strength
          ty = (p.y - (top + box.height / 2)) * strength
        }
      }
      sx.target = tx
      sy.target = ty
      if (sx.settled && sy.settled && sx.value === tx && sy.value === ty) return
      sx.step(frame.delta)
      sy.step(frame.delta)
      writeValue(el, 'x', Math.round(sx.value * 100) / 100)
      writeValue(el, 'y', Math.round(sy.value * 100) / 100)
      if (inner) {
        writeValue(inner, 'x', Math.round(sx.value * innerRatio * 100) / 100)
        writeValue(inner, 'y', Math.round(sy.value * innerRatio * 100) / 100)
      }
    }, Phase.update)

    let destroyed = false
    const destroy = () => {
      if (destroyed) return
      destroyed = true
      removeFrame()
      removeMeasure()
      stopLayout()
      writeValue(el, 'x', 0)
      writeValue(el, 'y', 0)
      if (inner) {
        writeValue(inner, 'x', 0)
        writeValue(inner, 'y', 0)
      }
    }
    onDestroy(destroy)
    return {
      el,
      get active() {
        return active
      },
      destroy,
    }
  }
}
