/**
 * Horizontal scroll sections: while a section is pinned, vertical
 * scrolling moves a row of panels sideways. Direction-aware — in a
 * right-to-left section the row travels rightward, so panels still arrive
 * in reading order. Built on CSS `position: sticky` (ADR-003) and a scene;
 * the section's height is computed so that vertical and horizontal travel
 * match.
 *
 * ```html
 * <section class="gallery">                 <!-- target -->
 *   <div class="gallery-pin">               <!-- sticky; top: 0; height: 100vh; overflow: hidden -->
 *     <div class="gallery-track">…panels…</div>   <!-- display: flex; width: max-content -->
 *   </div>
 * </section>
 * ```
 *
 * ```ts
 * const h = stage.use(horizontal('.gallery', { snap: true }))
 * ```
 *
 * Keyboard focus inside an offscreen panel scrolls the page to that panel.
 */
import { clamp, damp } from '../core/math.js'
import { Phase } from '../core/ticker.js'
import { writeValue } from '../motion/style.js'
import type { Scene } from '../scene/scene.js'
import type { StagePlugin } from '../stage.js'
import { directionOf } from '../text/script.js'

export interface HorizontalOptions {
  /** The sticky element. Default: the target's first element child. */
  pin?: Element | string
  /** The moving row. Default: the pin's widest child. */
  track?: Element | string
  /** Selector for panels inside the track. Default: the track's element children. */
  panels?: string
  /** Vertical scroll per horizontal pixel. Default `1`; `1.5` makes the section 50 % longer. */
  speed?: number
  /** Smoothing of the row's motion (per second). Default `0` (follows scroll exactly). */
  smooth?: number
  /** Settle on the nearest panel when scrolling stops. */
  snap?: boolean | { delay?: number; duration?: number }
  /** CSS variable receiving each panel's `0…1` progress across the viewport. Default `'--panel-progress'`. */
  panelVar?: string | false
  onProgress?: (progress: number, section: Horizontal) => void
  /** Called when the panel under the viewport's center line changes. */
  onPanel?: (index: number, section: Horizontal) => void
}

export interface Horizontal {
  readonly el: HTMLElement
  readonly scene: Scene
  readonly direction: 'ltr' | 'rtl'
  readonly progress: number
  /** Horizontal distance travelled so far (px, along the reading direction). */
  readonly travel: number
  /** Total horizontal travel (px). */
  readonly distance: number
  readonly panels: readonly HTMLElement[]
  /** Index of the panel under the viewport's center line. */
  readonly active: number
  /** `0` as panel `index` enters at the line end, `1` once it has left at the line start. */
  panelProgress(index: number): number
  /** Scrolls the page so that panel `index` sits where the first panel rests. */
  scrollToPanel(index: number, options?: { duration?: number; immediate?: boolean }): Promise<void>
  /** Re-measures on the next frame (automatic on resize and font loading). */
  refresh(): void
  destroy(): void
}

interface PanelBox {
  start: number
  width: number
  lastVar: number
}

const resolve = (ref: Element | string | undefined, root: Element, fallback: () => Element | null): HTMLElement => {
  const el = typeof ref === 'string' ? root.querySelector(ref) : ref ?? fallback()
  if (!el) throw new Error(`[veyra] horizontal: missing element ${String(ref ?? '')}`)
  return el as HTMLElement
}

export function horizontal(target: Element | string, options: HorizontalOptions = {}): StagePlugin<Horizontal> {
  return (stage, onDestroy) => {
    const el = (typeof target === 'string' ? document.querySelector(target) : target) as HTMLElement | null
    if (!el) throw new Error(`[veyra] horizontal: no element for ${String(target)}`)
    const pin = resolve(options.pin, el, () => el.firstElementChild)
    // The track is the pin's widest child: by definition it overflows the pin.
    const track = resolve(options.track, pin, () => {
      let widest: Element | null = null
      let width = -1
      for (const child of pin.children) {
        const w = Math.max(child.scrollWidth, child.getBoundingClientRect().width)
        if (w > width) {
          width = w
          widest = child
        }
      }
      return widest
    })
    const speed = Math.max(0.1, options.speed ?? 1)
    const panelVar = options.panelVar === undefined ? '--panel-progress' : options.panelVar
    const snap = options.snap ? { delay: 0.18, duration: 0.7, ...(options.snap === true ? {} : options.snap) } : null

    const previous = { height: el.style.height, pin: pin.getAttribute('style') }
    if (typeof getComputedStyle === 'function' && getComputedStyle(pin).position !== 'sticky') {
      Object.assign(pin.style, { position: 'sticky', top: '0px', height: '100vh', overflow: 'hidden' })
    }

    let direction: 'ltr' | 'rtl' = 'ltr'
    let distance = 0
    let pinWidth = 0
    let travel = 0
    let lastX = NaN
    let panels: HTMLElement[] = []
    let boxes: PanelBox[] = []
    let active = -1
    let lastProgress = -1

    const measure = () => {
      direction = directionOf(track)
      panels = Array.from(options.panels ? track.querySelectorAll<HTMLElement>(options.panels) : (track.children as HTMLCollectionOf<HTMLElement>))
      pinWidth = pin.clientWidth
      const trackRect = track.getBoundingClientRect()
      const trackWidth = Math.max(track.scrollWidth, trackRect.width)
      distance = Math.max(0, trackWidth - pinWidth)
      boxes = panels.map((panel) => {
        const r = panel.getBoundingClientRect()
        // Offsets along the reading direction; both rects share the row's transform.
        return { start: direction === 'rtl' ? trackRect.right - r.right : r.left - trackRect.left, width: r.width, lastVar: -1 }
      })
      const height = Math.round(pin.offsetHeight + distance * speed)
      if (el.style.height !== `${height}px`) {
        el.style.height = `${height}px`
        // Content below moved: let every other scene re-measure.
        stage.refresh()
      }
    }

    measure()
    const scene = stage.scene(el, { start: 'top top', end: 'bottom bottom' })
    const stopRefresh = stage.onRefresh(measure)

    /** Where the first panel sits at rest: panels snap into that same place. */
    const inset = () => boxes[0]?.start ?? 0

    const panelProgress = (index: number) => {
      const box = boxes[index]
      if (!box) return 0
      return clamp((travel - (box.start - pinWidth)) / (pinWidth + box.width))
    }

    const scrollToPanel = (index: number, opts: { duration?: number; immediate?: boolean } = {}) => {
      const box = boxes[clamp(index, 0, boxes.length - 1)]
      if (!box) return Promise.resolve()
      const t = distance > 0 ? clamp((box.start - inset()) / distance) : 0
      const y = scene.start + t * scene.length
      if (stage.scroll) return stage.scroll.scrollTo(y, { duration: opts.duration, immediate: opts.immediate })
      window.scrollTo({ top: y, behavior: opts.immediate || stage.reducedMotion.value ? 'auto' : 'smooth' })
      return Promise.resolve()
    }

    // Snapping: wait for scrolling to come to rest, then settle on a panel.
    let touching = false
    let idle = 0
    let snapping = false
    const onTouchStart = () => (touching = true)
    const onTouchEnd = () => (touching = false)
    if (snap) {
      window.addEventListener('touchstart', onTouchStart, { passive: true })
      window.addEventListener('touchend', onTouchEnd, { passive: true })
      window.addEventListener('touchcancel', onTouchEnd, { passive: true })
    }

    // Focus moving into an offscreen panel: bring it in by scrolling the page.
    const onFocusIn = (e: FocusEvent) => {
      const index = panels.findIndex((p) => p.contains(e.target as Node))
      if (index < 0) return
      const p = panelProgress(index)
      if (p <= 0 || p >= 1 || boxes[index]!.start < travel || boxes[index]!.start + boxes[index]!.width > travel + pinWidth) {
        void scrollToPanel(index)
      }
    }
    // The browser scrolls the clipped pin to reveal focused content; the row's transform does that job.
    const onPinScroll = () => {
      if (pin.scrollLeft !== 0) pin.scrollLeft = 0
    }
    track.addEventListener('focusin', onFocusIn)
    pin.addEventListener('scroll', onPinScroll)

    const handle: Horizontal = {
      el,
      scene,
      get direction() {
        return direction
      },
      get progress() {
        return scene.progress
      },
      get travel() {
        return travel
      },
      get distance() {
        return distance
      },
      get panels() {
        return panels
      },
      get active() {
        return active
      },
      panelProgress,
      scrollToPanel,
      refresh: () => stage.refresh(),
      destroy,
    }

    const removeFrame = stage.onFrame((frame) => {
      const goal = scene.progress * distance
      const smooth = options.smooth ?? 0
      travel = smooth > 0 && frame.delta > 0 ? damp(travel, goal, smooth, frame.delta) : goal
      if (Math.abs(travel - goal) < 0.05) travel = goal
      const x = direction === 'rtl' ? travel : -travel
      if (x !== lastX) {
        lastX = x
        writeValue(track, 'x', Math.round(x * 100) / 100)
      }
      if (panelVar) {
        boxes.forEach((box, i) => {
          const p = Math.round(panelProgress(i) * 1e4) / 1e4
          if (p !== box.lastVar) {
            box.lastVar = p
            panels[i]!.style.setProperty(panelVar, String(p))
          }
        })
      }
      const center = travel + pinWidth / 2
      let next = 0
      let best = Infinity
      boxes.forEach((box, i) => {
        const d = center < box.start ? box.start - center : center > box.start + box.width ? center - box.start - box.width : 0
        if (d < best) {
          best = d
          next = i
        }
      })
      if (boxes.length && next !== active) {
        active = next
        options.onPanel?.(active, handle)
      }
      if (scene.progress !== lastProgress) {
        lastProgress = scene.progress
        options.onProgress?.(scene.progress, handle)
      }

      const scroll = stage.scroll
      if (!snap || !scroll || snapping || boxes.length === 0 || distance === 0) return
      if (scroll.velocity !== 0 || touching || scroll.isLocked) {
        idle = 0
        return
      }
      idle += frame.rawDelta
      if (idle < snap.delay || scene.rawProgress <= 0.001 || scene.rawProgress >= 0.999) return
      let to = travel
      let closest = Infinity
      for (const box of boxes) {
        const stop = clamp(box.start - inset(), 0, distance)
        if (Math.abs(stop - travel) < closest) {
          closest = Math.abs(stop - travel)
          to = stop
        }
      }
      idle = 0
      if (closest < 1) return
      snapping = true
      void scroll.scrollTo(scene.start + (to / distance) * scene.length, { duration: snap.duration }).then(() => (snapping = false))
    }, Phase.update)

    let destroyed = false
    function destroy() {
      if (destroyed) return
      destroyed = true
      removeFrame()
      stopRefresh()
      scene.destroy()
      track.removeEventListener('focusin', onFocusIn)
      pin.removeEventListener('scroll', onPinScroll)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      writeValue(track, 'x', 0)
      el!.style.height = previous.height
      if (previous.pin === null) pin.removeAttribute('style')
      else pin.setAttribute('style', previous.pin)
      if (panelVar) for (const p of panels) p.style.removeProperty(panelVar)
    }
    onDestroy(destroy)
    return handle
  }
}
