/**
 * Tilt: a card leans toward the pointer in 3D while hovered, on springs.
 * Optionally exposes the pointer position as CSS variables for a moving
 * highlight (`--tilt-x`, `--tilt-y` in `0…1`, `--tilt-active` in `0…1`).
 * Off for touch input and reduced motion.
 *
 * ```ts
 * stage.use(tilt('.card', { max: 8, glare: true }))
 * ```
 * ```css
 * .card::after { background: radial-gradient(circle at calc(var(--tilt-x) * 100%) calc(var(--tilt-y) * 100%), #fff6, transparent 60%); opacity: var(--tilt-active); }
 * ```
 */
import { Phase } from '../core/ticker.js'
import { Spring, type SpringConfig } from '../motion/spring.js'
import { writeValue } from '../motion/style.js'
import type { StagePlugin } from '../stage.js'

export interface TiltOptions {
  /** Maximum rotation in degrees. Default `8`. */
  max?: number
  /** Perspective distance (px). Default `900`. */
  perspective?: number
  /** Scale while hovered. Default `1`. */
  scale?: number
  /** Write `--tilt-x`, `--tilt-y` and `--tilt-active` for highlights. Default `false`. */
  glare?: boolean
  spring?: SpringConfig
}

export interface Tilt {
  readonly el: HTMLElement
  readonly hovered: boolean
  destroy(): void
}

export function tilt(target: Element | string, options: TiltOptions = {}): StagePlugin<Tilt> {
  return (stage, onDestroy) => {
    const el = (typeof target === 'string' ? document.querySelector(target) : target) as HTMLElement | null
    if (!el) throw new Error(`[veyra] tilt: no element for ${String(target)}`)
    const max = options.max ?? 8
    const hoverScale = options.scale ?? 1
    const config = options.spring ?? { stiffness: 150, damping: 17, mass: 1 }
    const rx = new Spring(0, config)
    const ry = new Spring(0, config)
    const sc = new Spring(1, config)
    const glow = new Spring(0, config)
    let hovered = false
    let u = 0.5
    let v = 0.5
    let box = { left: 0, top: 0, width: 1, height: 1 }

    const perspective = options.perspective ?? 900
    // The perspective is only applied while tilting, so cards at rest carry no transform.
    let engaged = false
    const enabled = () => !stage.reducedMotion.value && !stage.viewport.touch.value

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !enabled()) return
      const r = el.getBoundingClientRect()
      box = { left: r.left, top: r.top + stage.scrollY, width: Math.max(1, r.width), height: Math.max(1, r.height) }
      hovered = true
      onMove(e)
    }
    const onMove = (e: PointerEvent) => {
      if (!hovered) return
      u = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width))
      v = Math.min(1, Math.max(0, (e.clientY - (box.top - stage.scrollY)) / box.height))
    }
    const onLeave = () => {
      hovered = false
    }
    el.addEventListener('pointerenter', onEnter)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)

    const removeFrame = stage.onFrame((frame) => {
      const on = hovered && enabled()
      ry.target = on ? (u - 0.5) * 2 * max : 0
      rx.target = on ? -(v - 0.5) * 2 * max : 0
      sc.target = on ? hoverScale : 1
      glow.target = on ? 1 : 0
      if ([rx, ry, sc, glow].every((s) => s.settled && s.value === s.target)) return
      if (!engaged) {
        engaged = true
        writeValue(el, 'transformPerspective', perspective)
      }
      rx.step(frame.delta)
      ry.step(frame.delta)
      sc.step(frame.delta)
      glow.step(frame.delta)
      writeValue(el, 'rotateX', Math.round(rx.value * 1000) / 1000)
      writeValue(el, 'rotateY', Math.round(ry.value * 1000) / 1000)
      writeValue(el, 'scale', Math.round(sc.value * 10000) / 10000)
      if (!on && [rx, ry, sc, glow].every((s) => s.settled)) {
        engaged = false
        writeValue(el, 'transformPerspective', 0)
      }
      if (options.glare) {
        el.style.setProperty('--tilt-x', u.toFixed(4))
        el.style.setProperty('--tilt-y', v.toFixed(4))
        el.style.setProperty('--tilt-active', Math.max(0, glow.value).toFixed(4))
      }
    }, Phase.update)

    let destroyed = false
    const destroy = () => {
      if (destroyed) return
      destroyed = true
      removeFrame()
      el.removeEventListener('pointerenter', onEnter)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      for (const key of ['rotateX', 'rotateY', 'transformPerspective'] as const) writeValue(el, key, 0)
      writeValue(el, 'scale', 1)
    }
    onDestroy(destroy)
    return {
      el,
      get hovered() {
        return hovered
      },
      destroy,
    }
  }
}
