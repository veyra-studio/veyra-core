/**
 * A custom cursor that follows the pointer and changes state over
 * interactive targets. A target's `data-cursor` attribute becomes a label
 * («ببین», "Drag") and is mirrored to `data-cursor-state` on the cursor for
 * styling. Never shown for touch input; the native cursor stays visible
 * unless `hideNative` is set.
 *
 * ```ts
 * stage.use(cursor({ targets: 'a, button, [data-cursor]' }))
 * ```
 * ```css
 * .veyra-cursor { width: 14px; height: 14px; border-radius: 50%; background: #fff; mix-blend-mode: difference; transition: width .3s, height .3s; }
 * .veyra-cursor.is-active { width: 64px; height: 64px; }
 * ```
 */
import { damp } from '../core/math.js'
import { Phase } from '../core/ticker.js'
import { writeValue } from '../motion/style.js'
import type { StagePlugin } from '../stage.js'

export interface CursorOptions {
  /** Use an existing element. Default: creates `<div class="veyra-cursor"><span class="veyra-cursor-label">`. */
  el?: HTMLElement | string
  /** Class of the created element. Default `'veyra-cursor'`. */
  className?: string
  /** Elements that activate the cursor. Default `'a, button, [data-cursor]'`. */
  targets?: string
  /** Follow speed (per second). Default `20`; `0` follows exactly. */
  smoothing?: number
  /** Hide the system cursor while the custom one is visible. Default `false`. */
  hideNative?: boolean
}

export interface Cursor {
  readonly el: HTMLElement
  readonly x: number
  readonly y: number
  /** The interactive element under the pointer. */
  readonly target: Element | null
  /** The current label (from `data-cursor`). */
  readonly label: string
  destroy(): void
}

export function cursor(options: CursorOptions = {}): StagePlugin<Cursor> {
  return (stage, onDestroy) => {
    const created = !options.el
    const el = (typeof options.el === 'string' ? document.querySelector(options.el) : options.el ?? document.createElement('div')) as HTMLElement | null
    if (!el) throw new Error(`[veyra] cursor: no element for ${String(options.el)}`)
    let labelEl = el.querySelector<HTMLElement>('.veyra-cursor-label')
    if (created) {
      el.className = options.className ?? 'veyra-cursor'
      labelEl = document.createElement('span')
      labelEl.className = 'veyra-cursor-label'
      el.append(labelEl)
      document.body.append(el)
    }
    el.setAttribute('aria-hidden', 'true')
    Object.assign(el.style, { position: 'fixed', left: '0px', top: '0px', pointerEvents: 'none', zIndex: '2147483000', translate: '-50% -50%' })
    const selector = options.targets ?? 'a, button, [data-cursor]'
    const pointer = stage.pointer
    let x = pointer?.x ?? 0
    let y = pointer?.y ?? 0
    let target: Element | null = null
    let label = ''
    let shown: boolean | null = null

    const onOver = (e: PointerEvent) => {
      const next = e.target instanceof Element ? e.target.closest(selector) : null
      if (next === target) return
      target = next
      label = next?.getAttribute('data-cursor') ?? ''
      el.classList.toggle('is-active', !!next)
      el.setAttribute('data-cursor-state', next ? label || 'hover' : 'default')
      if (labelEl) labelEl.textContent = label
    }
    document.addEventListener('pointerover', onOver, { passive: true })
    el.setAttribute('data-cursor-state', 'default')

    const root = document.documentElement
    const previousCursor = root.style.cursor
    const removeFrame = stage.onFrame((frame) => {
      if (!pointer) return
      const show = pointer.inside && pointer.type !== 'touch' && !stage.viewport.touch.value
      if (show !== shown) {
        shown = show
        el.style.opacity = show ? '' : '0'
        if (options.hideNative) root.style.cursor = show ? 'none' : previousCursor
        if (show) {
          // Appear at the pointer, not sliding in from the last position.
          x = pointer.x
          y = pointer.y
        }
      }
      if (!show) return
      el.classList.toggle('is-down', pointer.down)
      const lambda = stage.reducedMotion.value ? 0 : (options.smoothing ?? 20)
      x = lambda > 0 ? damp(x, pointer.x, lambda, frame.delta) : pointer.x
      y = lambda > 0 ? damp(y, pointer.y, lambda, frame.delta) : pointer.y
      writeValue(el, 'x', Math.round(x * 10) / 10)
      writeValue(el, 'y', Math.round(y * 10) / 10)
    }, Phase.render)

    let destroyed = false
    const destroy = () => {
      if (destroyed) return
      destroyed = true
      removeFrame()
      document.removeEventListener('pointerover', onOver)
      if (options.hideNative) root.style.cursor = previousCursor
      if (created) el.remove()
    }
    onDestroy(destroy)
    return {
      el,
      get x() {
        return x
      },
      get y() {
        return y
      },
      get target() {
        return target
      },
      get label() {
        return label
      },
      destroy,
    }
  }
}
