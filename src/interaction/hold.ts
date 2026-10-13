/**
 * Press and hold — a mouse, a finger, or a key — for pumping, charging,
 * revealing. Every frame while held, `onHold` gets the time held so far and
 * the frame's delta; the element carries `data-held` meanwhile, for CSS.
 *
 * ```ts
 * stage.use(holdable('.pump', { onHold: (hold, dt) => (air += dt * 6), onEnd: () => letGo() }))
 * ```
 *
 * Space and Enter hold while the element has focus: make it a `<button>`.
 * On touch screens give it `touch-action: none` and `user-select: none`, so
 * a long press neither scrolls nor selects.
 */
import type { StagePlugin } from '../stage.js'

export interface HoldOptions {
  /** Keys that hold while the element has focus. Default `[' ', 'Enter']`. */
  keys?: readonly string[]
  onStart?: (hold: Hold) => void
  /** Every frame while held, with the frame's delta in seconds. */
  onHold?: (hold: Hold, dt: number) => void
  /** Let go — or interrupted (focus lost, pointer cancelled, disabled). */
  onEnd?: (hold: Hold) => void
}

export interface Hold {
  readonly el: HTMLElement
  readonly held: boolean
  /** Seconds held: the current hold's, or the last one's after release. */
  readonly duration: number
  /** What is holding: a pointer or a key (`null` when not held). */
  readonly source: 'pointer' | 'key' | null
  readonly enabled: boolean
  enable(): void
  /** Stops listening (ending a hold under way). */
  disable(): void
  destroy(): void
}

export function holdable(target: string | HTMLElement, options: HoldOptions = {}): StagePlugin<Hold> {
  return (stage, onDestroy) => {
    const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target
    if (!el) throw new Error(`[veyra] holdable: nothing matches ${String(target)}`)
    const keys = options.keys ?? [' ', 'Enter']
    let held = false
    let duration = 0
    let source: 'pointer' | 'key' | null = null
    let enabled = true
    let pointer = -1

    const start = (from: 'pointer' | 'key') => {
      if (!enabled || held) return
      held = true
      duration = 0
      source = from
      el.dataset.held = ''
      options.onStart?.(hold)
    }
    const end = () => {
      if (!held) return
      held = false
      delete el.dataset.held
      if (pointer >= 0 && el.hasPointerCapture?.(pointer)) el.releasePointerCapture(pointer)
      pointer = -1
      options.onEnd?.(hold)
      source = null
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || !e.isPrimary || held) return
      pointer = e.pointerId
      el.setPointerCapture?.(e.pointerId)
      start('pointer')
    }
    const onPointerUp = (e: PointerEvent) => {
      if (source === 'pointer' && e.pointerId === pointer) end()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (!keys.includes(e.key)) return
      // Space would scroll the page; a held key repeats.
      e.preventDefault()
      if (!e.repeat) start('key')
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (source === 'key' && keys.includes(e.key)) end()
    }
    // A long press on touch screens opens a menu.
    const onContextMenu = (e: Event) => {
      if (held) e.preventDefault()
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    el.addEventListener('lostpointercapture', onPointerUp)
    el.addEventListener('keydown', onKeyDown)
    el.addEventListener('keyup', onKeyUp)
    el.addEventListener('blur', end)
    el.addEventListener('contextmenu', onContextMenu)
    const stopFrame = stage.onFrame((frame) => {
      if (!held) return
      duration += frame.delta
      options.onHold?.(hold, frame.delta)
    })

    let destroyed = false
    const destroy = () => {
      if (destroyed) return
      destroyed = true
      end()
      stopFrame()
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.removeEventListener('lostpointercapture', onPointerUp)
      el.removeEventListener('keydown', onKeyDown)
      el.removeEventListener('keyup', onKeyUp)
      el.removeEventListener('blur', end)
      el.removeEventListener('contextmenu', onContextMenu)
    }
    const hold: Hold = {
      el,
      get held() {
        return held
      },
      get duration() {
        return duration
      },
      get source() {
        return source
      },
      get enabled() {
        return enabled
      },
      enable() {
        enabled = true
      },
      disable() {
        enabled = false
        end()
      },
      destroy,
    }
    onDestroy(destroy)
    return hold
  }
}
