/**
 * Dragging with real physics: pointer tracking, inertia when released,
 * rubber-band resistance past the bounds, and snapping that keeps the
 * thrown velocity — the core of carousels, sliders and throwable cards.
 *
 * ```ts
 * const d = stage.use(draggable('.track', { axis: 'x', bounds: 'parent', snap: (x) => Math.round(x / 320) * 320 }))
 * ```
 *
 * Under reduced motion, a release goes straight to its resting place.
 */
import { Phase } from '../core/ticker.js'
import { Decay } from '../motion/decay.js'
import { Spring, springs, type SpringConfig } from '../motion/spring.js'
import { readValue, writeValue } from '../motion/style.js'
import type { StagePlugin } from '../stage.js'

export interface DragBounds {
  minX?: number
  maxX?: number
  minY?: number
  maxY?: number
}

/** Snap points: a list of positions, a step size, or a function returning the snapped value. */
export type DragSnap = readonly number[] | number | ((value: number, axis: 'x' | 'y') => number)

export interface DraggableOptions {
  /** Default `'x'`. */
  axis?: 'x' | 'y' | 'both'
  /** Limits, `'parent'` (stay within / cover the parent), or a function re-evaluated on each drag. */
  bounds?: DragBounds | 'parent' | (() => DragBounds)
  snap?: DragSnap
  /** Keep moving after release. Default `true`. */
  inertia?: boolean
  /** Inertia time constant in seconds. Default `0.325`. */
  timeConstant?: number
  /** Rubber-band stiffness past the bounds, `0…1`. Default `0.55`; `0` locks to the bounds. */
  resistance?: number
  /** Spring used for snapping and returning inside the bounds. */
  spring?: SpringConfig
  /** Write `x` / `y` transforms. Default `true`; turn off to drive something else from `onUpdate`. */
  apply?: boolean
  /** Pixels the pointer must travel before a drag starts. Default `4`. */
  threshold?: number
  /**
   * Arrow keys step between snap points while the element has focus.
   * `true` moves the element in the arrow's direction; `'content'` moves it
   * the other way, like scrolling a carousel.
   */
  keyboard?: boolean | 'content'
  onDragStart?: (drag: Draggable) => void
  onDrag?: (drag: Draggable) => void
  onDragEnd?: (drag: Draggable) => void
  /** Called once motion has fully stopped after a release. */
  onRest?: (drag: Draggable) => void
  /** Called after every position change. */
  onUpdate?: (drag: Draggable) => void
}

export interface Draggable {
  readonly el: HTMLElement
  readonly x: number
  readonly y: number
  readonly velocityX: number
  readonly velocityY: number
  readonly dragging: boolean
  /** Coasting or springing after a release. */
  readonly moving: boolean
  readonly enabled: boolean
  /** Moves to a position, springing there unless `animate` is `false`. */
  setPosition(x: number, y: number, options?: { animate?: boolean }): void
  /** Moves `steps` snap points (positive = towards larger values), on one axis or all. */
  step(steps: number, axis?: 'x' | 'y'): void
  enable(): void
  disable(): void
  destroy(): void
}

type Mode = 'idle' | 'drag' | 'decay' | 'spring'

interface Axis {
  name: 'x' | 'y'
  value: number
  velocity: number
  start: number
  mode: Mode
  decay: Decay
  spring: Spring
  min: number
  max: number
}

const RUBBER_RANGE = 400

/** iOS-style rubber band: proportional at first, approaching `RUBBER_RANGE`. */
function rubber(overshoot: number, resistance: number): number {
  if (resistance <= 0) return 0
  return (1 - 1 / ((overshoot * resistance) / RUBBER_RANGE + 1)) * RUBBER_RANGE
}

function snapValue(snap: DragSnap | undefined, value: number, axis: 'x' | 'y'): number {
  if (snap === undefined) return value
  if (typeof snap === 'function') return snap(value, axis)
  if (typeof snap === 'number') return snap > 0 ? Math.round(value / snap) * snap : value
  let best = value
  let distance = Infinity
  for (const point of snap) {
    const d = Math.abs(point - value)
    if (d < distance) {
      distance = d
      best = point
    }
  }
  return best
}

const toNumber = (v: unknown) => (typeof v === 'number' ? v : Number.parseFloat(String(v)) || 0)

export function draggable(target: Element | string, options: DraggableOptions = {}): StagePlugin<Draggable> {
  return (stage, onDestroy) => {
    const found = (typeof target === 'string' ? document.querySelector(target) : target) as HTMLElement | null
    if (!found) throw new Error(`[veyra] draggable: no element for ${String(target)}`)
    const el: HTMLElement = found
    const axisMode = options.axis ?? 'x'
    const threshold = options.threshold ?? 4
    const resistance = options.resistance ?? 0.55
    const apply = options.apply ?? true
    const springConfig = options.spring ?? springs.default
    const makeAxis = (name: 'x' | 'y'): Axis => ({
      name,
      value: toNumber(readValue(el, name)),
      velocity: 0,
      start: 0,
      mode: 'idle',
      decay: new Decay(0, { timeConstant: options.timeConstant }),
      spring: new Spring(0, springConfig),
      min: -Infinity,
      max: Infinity,
    })
    const axes: Axis[] = []
    if (axisMode !== 'y') axes.push(makeAxis('x'))
    if (axisMode !== 'x') axes.push(makeAxis('y'))
    const ax = (name: 'x' | 'y') => axes.find((a) => a.name === name)

    let enabled = true
    let pending = false
    let dragging = false
    let pointerId = -1
    let originX = 0
    let originY = 0
    let travelled = 0
    let dirty = false
    let wasMoving = false
    const samples: Array<{ t: number; x: number; y: number }> = []

    const previous = { touchAction: el.style.touchAction, userSelect: el.style.userSelect }
    el.style.touchAction = axisMode === 'x' ? 'pan-y' : axisMode === 'y' ? 'pan-x' : 'none'
    el.style.userSelect = 'none'

    const resolveBounds = () => {
      let b: DragBounds = {}
      const opt = options.bounds
      if (opt === 'parent') {
        const parent = el.parentElement
        if (parent) {
          const pr = parent.getBoundingClientRect()
          const er = el.getBoundingClientRect()
          const cx = ax('x')?.value ?? 0
          const cy = ax('y')?.value ?? 0
          const x1 = cx + (pr.left - er.left)
          const x2 = cx + (pr.right - er.right)
          const y1 = cy + (pr.top - er.top)
          const y2 = cy + (pr.bottom - er.bottom)
          b = { minX: Math.min(x1, x2), maxX: Math.max(x1, x2), minY: Math.min(y1, y2), maxY: Math.max(y1, y2) }
        }
      } else if (typeof opt === 'function') b = opt()
      else if (opt) b = opt
      for (const a of axes) {
        a.min = (a.name === 'x' ? b.minX : b.minY) ?? -Infinity
        a.max = (a.name === 'x' ? b.maxX : b.maxY) ?? Infinity
      }
    }

    const restingPlace = (a: Axis, from: number) => {
      const snapped = snapValue(options.snap, from, a.name)
      return Math.min(a.max, Math.max(a.min, snapped))
    }

    const springTo = (a: Axis, to: number) => {
      a.spring.value = a.value
      a.spring.velocity = a.velocity
      a.spring.target = to
      a.mode = 'spring'
    }

    const release = (withVelocity: boolean) => {
      const reduced = stage.reducedMotion.value
      for (const a of axes) {
        if (!withVelocity) a.velocity = 0
        const inertia = options.inertia ?? true
        const projected = inertia ? a.value + a.velocity * a.decay.timeConstant : a.value
        const outside = a.value < a.min || a.value > a.max
        if (reduced) {
          a.value = restingPlace(a, projected)
          a.velocity = 0
          a.mode = 'idle'
        } else if (options.snap !== undefined || outside || !inertia) {
          springTo(a, restingPlace(a, projected))
        } else {
          a.decay.start(a.value, a.velocity)
          a.mode = 'decay'
        }
      }
      dirty = true
    }

    const stepAxis = (a: Axis, steps: number) => {
      const current = a.mode === 'spring' ? a.spring.target : a.value
      const snap = options.snap
      const inside = (v: number) => Math.min(a.max, Math.max(a.min, v))
      let to = current
      if (Array.isArray(snap) && snap.length) {
        // The next distinct resting place in the step's direction, `steps` times.
        const stops = [...new Set((snap as readonly number[]).map(inside))].sort((p, q) => p - q)
        for (let k = 0; k < Math.abs(steps); k++) {
          const next = steps > 0 ? stops.find((p) => p > to + 0.5) : [...stops].reverse().find((p) => p < to - 0.5)
          if (next === undefined) break
          to = next
        }
      } else if (typeof snap === 'number' && snap > 0) {
        const index = steps > 0 ? Math.floor(current / snap + 1e-6) + steps : Math.ceil(current / snap - 1e-6) + steps
        to = inside(index * snap)
      } else {
        to = inside(current + steps * 40)
      }
      a.velocity = 0
      springTo(a, to)
    }

    const handle = drag()
    function drag(): Draggable {
      return {
        el,
        get x() {
          return ax('x')?.value ?? 0
        },
        get y() {
          return ax('y')?.value ?? 0
        },
        get velocityX() {
          return ax('x')?.velocity ?? 0
        },
        get velocityY() {
          return ax('y')?.velocity ?? 0
        },
        get dragging() {
          return dragging
        },
        get moving() {
          return axes.some((a) => a.mode === 'decay' || a.mode === 'spring')
        },
        get enabled() {
          return enabled
        },
        setPosition(x, y, opts = {}) {
          resolveBounds()
          for (const a of axes) {
            const to = a.name === 'x' ? x : y
            if (opts.animate === false || stage.reducedMotion.value) {
              a.value = to
              a.velocity = 0
              a.mode = 'idle'
            } else {
              springTo(a, to)
            }
          }
          dirty = true
        },
        step(steps, axis) {
          resolveBounds()
          for (const a of axes) if (!axis || a.name === axis) stepAxis(a, steps)
          dirty = true
        },
        enable() {
          enabled = true
        },
        disable() {
          enabled = false
          if (dragging) end(false)
        },
        destroy,
      }
    }

    const onDown = (e: PointerEvent) => {
      if (!enabled || pending || dragging) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      pending = true
      pointerId = e.pointerId
      originX = e.clientX
      originY = e.clientY
      travelled = 0
      samples.length = 0
      // Catch a moving element where it is.
      for (const a of axes) {
        a.mode = 'idle'
        a.velocity = 0
        a.start = a.value
      }
      el.setPointerCapture?.(e.pointerId)
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId || (!pending && !dragging)) return
      const dx = e.clientX - originX
      const dy = e.clientY - originY
      travelled = Math.max(travelled, Math.hypot(dx, dy))
      if (pending && !dragging) {
        if (travelled < threshold) return
        dragging = true
        resolveBounds()
        for (const a of axes) a.mode = 'drag'
        options.onDragStart?.(handle)
      }
      for (const a of axes) {
        const raw = a.start + (a.name === 'x' ? dx : dy)
        a.value = raw < a.min ? a.min - rubber(a.min - raw, resistance) : raw > a.max ? a.max + rubber(raw - a.max, resistance) : raw
      }
      const now = performance.now()
      samples.push({ t: now, x: ax('x')?.value ?? 0, y: ax('y')?.value ?? 0 })
      while (samples.length > 2 && now - samples[0]!.t > 100) samples.shift()
      dirty = true
      options.onDrag?.(handle)
    }

    const end = (withVelocity: boolean) => {
      const wasDragging = dragging
      pending = false
      dragging = false
      if (pointerId !== -1 && el.hasPointerCapture?.(pointerId)) el.releasePointerCapture(pointerId)
      pointerId = -1
      if (!wasDragging) return
      // Release velocity from the last ~100 ms; a pause before letting go means no throw.
      const now = performance.now()
      const first = samples[0]
      const last = samples[samples.length - 1]
      const fresh = last && now - last.t < 80
      for (const a of axes) {
        a.velocity = first && last && fresh && last.t > first.t ? ((a.name === 'x' ? last.x - first.x : last.y - first.y) / (last.t - first.t)) * 1000 : 0
      }
      options.onDragEnd?.(handle)
      release(withVelocity)
      if (travelled >= threshold) {
        // The pointer was dragging, not clicking.
        const swallow = (ev: Event) => {
          ev.stopPropagation()
          ev.preventDefault()
        }
        el.addEventListener('click', swallow, { capture: true, once: true })
        setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 0)
      }
    }

    const onUp = (e: PointerEvent) => {
      if (e.pointerId === pointerId) end(true)
    }
    const onCancel = (e: PointerEvent) => {
      if (e.pointerId === pointerId) end(false)
    }
    const onDragStartNative = (e: Event) => e.preventDefault()
    const onKey = (e: KeyboardEvent) => {
      if (!enabled || !options.keyboard) return
      const sign = options.keyboard === 'content' ? -1 : 1
      const map: Record<string, ['x' | 'y', number]> = {
        ArrowRight: ['x', 1],
        ArrowLeft: ['x', -1],
        ArrowDown: ['y', 1],
        ArrowUp: ['y', -1],
      }
      const hit = map[e.key]
      if (!hit || !ax(hit[0])) return
      e.preventDefault()
      handle.step(hit[1] * sign, hit[0])
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    el.addEventListener('dragstart', onDragStartNative)
    el.addEventListener('keydown', onKey)

    const removeFrame = stage.onFrame((frame) => {
      const dt = frame.delta
      for (const a of axes) {
        if (a.mode === 'decay') {
          a.value = a.decay.step(dt)
          a.velocity = a.decay.velocity
          if (a.value < a.min || a.value > a.max) springTo(a, a.value < a.min ? a.min : a.max)
          else if (a.decay.settled) {
            a.velocity = 0
            const snapped = restingPlace(a, a.value)
            if (snapped !== a.value) springTo(a, snapped)
            else a.mode = 'idle'
          }
          dirty = true
        } else if (a.mode === 'spring') {
          a.value = a.spring.step(dt)
          a.velocity = a.spring.velocity
          if (a.spring.settled) {
            a.value = a.spring.target
            a.velocity = 0
            a.mode = 'idle'
          }
          dirty = true
        }
      }
      if (dirty) {
        dirty = false
        if (apply) for (const a of axes) writeValue(el, a.name, a.value)
        options.onUpdate?.(handle)
      }
      const moving = axes.some((a) => a.mode === 'decay' || a.mode === 'spring')
      if (wasMoving && !moving && !dragging) options.onRest?.(handle)
      wasMoving = moving
    }, Phase.update)

    let destroyed = false
    function destroy() {
      if (destroyed) return
      destroyed = true
      removeFrame()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      el.removeEventListener('dragstart', onDragStartNative)
      el.removeEventListener('keydown', onKey)
      el.style.touchAction = previous.touchAction
      el.style.userSelect = previous.userSelect
    }
    onDestroy(destroy)
    return handle
  }
}
