/**
 * Marquee: an endless, seamless band of content. It runs in the reading
 * direction — content travels toward the start of the line, leftward in
 * English and rightward in Persian — speeds up with scroll velocity and can
 * reverse while scrolling up. Copies are `inert` and hidden from assistive
 * tech; reduced motion keeps the band still; it idles while offscreen.
 *
 * ```ts
 * stage.use(marquee('.ticker', { speed: 70, scrollFactor: 0.4, followScroll: true }))
 * ```
 */
import { damp, wrap } from '../core/math.js'
import { Phase } from '../core/ticker.js'
import { whenVisible } from '../env/visibility.js'
import { writeValue } from '../motion/style.js'
import type { StagePlugin } from '../stage.js'
import { directionOf } from '../text/script.js'

export interface MarqueeOptions {
  /** Pixels per second. Default `60`. */
  speed?: number
  /** `'auto'` (default) follows the reading direction; `-1` runs against it. */
  direction?: 'auto' | 1 | -1
  /** Extra speed per unit of scroll velocity (px/s per px/s). Default `0.3`. */
  scrollFactor?: number
  /** Run backwards while the page scrolls up. Default `false`. */
  followScroll?: boolean
  /** Speed multiplier while hovered — `0` pauses. Default `1`. */
  hoverSpeed?: number
}

export interface Marquee {
  readonly el: HTMLElement
  /** Base speed in px/s. */
  speed: number
  /** Current offset of the band (px). */
  readonly offset: number
  /** Re-measures (called automatically on resize). */
  refresh(): void
  /** Restores the original markup. */
  destroy(): void
}

export function marquee(target: Element | string, options: MarqueeOptions = {}): StagePlugin<Marquee> {
  return (stage, onDestroy) => {
    const el = (typeof target === 'string' ? document.querySelector(target) : target) as HTMLElement | null
    if (!el) throw new Error(`[veyra] marquee: no element for ${String(target)}`)

    const originals = Array.from(el.childNodes)
    const track = document.createElement('div')
    track.setAttribute('data-veyra-marquee-track', '')
    track.style.cssText = 'display:flex;width:max-content;will-change:transform'
    const group = document.createElement('div')
    group.style.cssText = 'display:flex;flex-shrink:0;align-items:center'
    group.append(...originals)
    track.append(group)
    el.append(track)
    const previousOverflow = el.style.overflow
    el.style.overflow = 'hidden'

    let groupWidth = 0
    let offset = 0
    let velocity = 0
    let hovered = false
    // Until the observer reports (or immediately, without one).
    let visible = typeof IntersectionObserver === 'undefined'
    let rtl = false
    const copies: HTMLElement[] = []

    const handle: Marquee = {
      el,
      speed: options.speed ?? 60,
      get offset() {
        return offset
      },
      refresh,
      destroy,
    }

    function refresh() {
      rtl = directionOf(el!) === 'rtl'
      groupWidth = group.getBoundingClientRect().width
      const needed = groupWidth > 0 ? Math.max(1, Math.ceil(el!.clientWidth / groupWidth)) : 0
      while (copies.length < needed) {
        const copy = group.cloneNode(true) as HTMLElement
        copy.setAttribute('aria-hidden', 'true')
        copy.inert = true
        track.append(copy)
        copies.push(copy)
      }
      while (copies.length > needed) copies.pop()!.remove()
    }

    const onEnter = () => (hovered = true)
    const onLeave = () => (hovered = false)
    el.addEventListener('pointerenter', onEnter)
    el.addEventListener('pointerleave', onLeave)
    const stopVisible = whenVisible(el, () => {
      visible = true
      return () => (visible = false)
    }, { once: false, rootMargin: '100px' })

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => refresh())
      ro.observe(group)
      ro.observe(el)
    }
    const stopLayout = stage.onRefresh(refresh)
    refresh()

    const removeFrame = stage.onFrame((frame) => {
      if (!visible || groupWidth === 0) return
      if (stage.reducedMotion.value) {
        if (offset !== 0) {
          offset = 0
          writeValue(track, 'x', 0)
        }
        return
      }
      const user = options.direction === -1 ? -1 : 1
      const scroll = stage.scroll
      const reverse = options.followScroll && scroll?.direction === -1 ? -1 : 1
      const boost = Math.abs(scroll?.velocity ?? 0) * (options.scrollFactor ?? 0.3)
      const hover = hovered ? (options.hoverSpeed ?? 1) : 1
      // Content travels toward the line start: left in LTR, right in RTL.
      const target = (rtl ? 1 : -1) * user * reverse * (handle.speed + boost) * hover
      velocity = damp(velocity, target, 6, frame.delta)
      offset += velocity * frame.delta
      offset = rtl ? wrap(offset, 0, groupWidth) : wrap(offset, -groupWidth, 0)
      writeValue(track, 'x', offset)
    }, Phase.update)

    let destroyed = false
    function destroy() {
      if (destroyed) return
      destroyed = true
      removeFrame()
      stopLayout()
      stopVisible()
      ro?.disconnect()
      el!.removeEventListener('pointerenter', onEnter)
      el!.removeEventListener('pointerleave', onLeave)
      el!.append(...originals)
      track.remove()
      el!.style.overflow = previousOverflow
    }
    onDestroy(destroy)
    return handle
  }
}
