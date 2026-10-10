/**
 * FLIP layout transitions — First, Last, Invert, Play. Record where
 * elements are, change the layout any way you like (classes, reordering,
 * a different container), and Veyra animates every element from its old
 * box to its new one using transforms only.
 *
 * ```ts
 * flip('.card', () => grid.classList.toggle('is-list'), { stagger: 0.02 })
 *
 * // Or in two steps, around asynchronous work:
 * const before = captureLayout('.card')
 * await renderResults()
 * flipFrom(before, { duration: 0.6 })
 * ```
 *
 * Interrupting a running flip starts the next one from where elements are
 * on screen. Elements should not carry other rotate/scale transforms.
 */
import type { EaseLike } from '../core/ease.js'
import type { Ticker } from '../core/ticker.js'
import { readValue, writeValue } from './style.js'
import { Timeline, toTargets, type Stagger, type Targets } from './timeline.js'

export interface FlipOptions {
  /** Seconds. Default `0.7`. */
  duration?: number
  /** Default `'glide'`. */
  ease?: EaseLike
  stagger?: Stagger
  /** Animate size changes with scale. Default `true`; turn off when content must not stretch. */
  scale?: boolean
  /** Fade in elements that had no box before (new or previously hidden). Default `true`. */
  fadeIn?: boolean
  /** Jump to the new layout without animating (e.g. `stage.reducedMotion.value`). */
  immediate?: boolean
  ticker?: Ticker
  onComplete?: () => void
}

interface Base {
  x: number
  y: number
  scaleX: number
  scaleY: number
}

export interface LayoutState {
  readonly elements: readonly Element[]
  readonly rects: ReadonlyMap<Element, DOMRect>
}

const running = new WeakMap<Element, { timeline: Timeline; base: Base }>()

const num = (v: unknown, fallback: number) => (typeof v === 'number' ? v : Number.parseFloat(String(v)) || fallback)

function baseOf(el: Element): Base {
  const active = running.get(el)
  if (active) return active.base
  return { x: num(readValue(el, 'x'), 0), y: num(readValue(el, 'y'), 0), scaleX: num(readValue(el, 'scaleX'), 1), scaleY: num(readValue(el, 'scaleY'), 1) }
}

/** A `transform-origin` component in px from the box's start (browsers report px; percentages and keywords are handled too). */
function originOffset(value: string, size: number): number {
  const v = value.trim()
  if (v === 'left' || v === 'top') return 0
  if (v === 'right' || v === 'bottom') return size
  if (v.endsWith('%')) return (Number.parseFloat(v) / 100) * size
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : size / 2
}

/** Records the on-screen boxes of `targets` (the "First" of FLIP). */
export function captureLayout(targets: Targets): LayoutState {
  const elements = toTargets(targets).filter((t): t is Element => typeof Element !== 'undefined' && t instanceof Element)
  const rects = new Map<Element, DOMRect>()
  for (const el of elements) rects.set(el, el.getBoundingClientRect())
  return { elements, rects }
}

/**
 * Animates elements from a captured layout to where they are now. Pass
 * `targets` to include elements that appeared since the capture.
 */
export function flipFrom(state: LayoutState, options: FlipOptions = {}, targets?: Targets): Timeline {
  const elements = targets === undefined ? [...state.elements] : toTargets(targets).filter((t): t is Element => t instanceof Element)
  const tl = new Timeline({ ticker: options.ticker, onComplete: options.onComplete })

  // Settle interrupted flips at their base transform before measuring.
  const bases = new Map<Element, Base>()
  for (const el of elements) {
    const base = baseOf(el)
    bases.set(el, base)
    const active = running.get(el)
    if (active) {
      active.timeline.pause()
      running.delete(el)
    }
    for (const key of ['x', 'y', 'scaleX', 'scaleY'] as const) writeValue(el, key, base[key])
  }
  if (options.immediate) return tl.play()

  const stagger = options.stagger ?? 0
  const tween = { duration: options.duration ?? 0.7, ease: options.ease ?? 'glide' }
  const useScale = options.scale ?? true
  elements.forEach((el, index) => {
    const base = bases.get(el)!
    const last = el.getBoundingClientRect()
    const first = state.rects.get(el)
    const at = typeof stagger === 'function' ? stagger(index, elements.length) : stagger * index
    if (!first || first.width === 0 || first.height === 0) {
      if (last.width > 0 && (options.fadeIn ?? true)) {
        const opacity = num(readValue(el, 'opacity'), 1)
        tl.fromTo(el, { opacity: 0 }, { opacity }, tween, at)
      }
      return
    }
    if (last.width === 0 || last.height === 0) return
    const sx = useScale ? first.width / last.width : 1
    const sy = useScale ? first.height / last.height : 1
    // Translation that maps the new box onto the old one around the
    // element's transform origin.
    const [originX = '', originY = ''] = typeof getComputedStyle === 'function' ? getComputedStyle(el).transformOrigin.split(' ') : []
    const ox = originOffset(originX, last.width)
    const oy = originOffset(originY, last.height)
    const dx = first.left - last.left + ox * (sx - 1)
    const dy = first.top - last.top + oy * (sy - 1)
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 1e-3 && Math.abs(sy - 1) < 1e-3) return
    tl.fromTo(
      el,
      { x: base.x + dx, y: base.y + dy, scaleX: base.scaleX * sx, scaleY: base.scaleY * sy },
      { x: base.x, y: base.y, scaleX: base.scaleX, scaleY: base.scaleY },
      tween,
      at,
    )
    running.set(el, { timeline: tl, base })
  })
  tl.call(() => {
    for (const el of elements) if (running.get(el)?.timeline === tl) running.delete(el)
  }, tl.duration)
  return tl.play()
}

/** Captures `targets`, runs `mutate`, and animates the change. */
export function flip(targets: Targets, mutate: () => void, options: FlipOptions = {}): Timeline {
  const state = captureLayout(targets)
  mutate()
  return flipFrom(state, options, targets)
}
