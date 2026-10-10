/**
 * Decode effect: letters cycle through random glyphs and settle into the
 * real text, from the start of the line to its end (the right edge in
 * Persian). Glyphs come from the script of each letter — Persian letters
 * for Persian, Latin for English — and the text stays one shaped run, so
 * Arabic-script letters keep joining while they flicker.
 *
 * Returns a timeline: play it, or scrub it with a scroll scene.
 */
import { resolveEase, type EaseLike } from '../core/ease.js'
import type { Ticker } from '../core/ticker.js'
import { Timeline } from '../motion/timeline.js'
import { graphemes } from './script.js'

export interface ScrambleOptions {
  /** Seconds. Default `1.2`. */
  duration?: number
  /** Seconds before it starts. Default `0`. */
  delay?: number
  /**
   * Glyph pool. `'auto'` (default) chooses per letter: Persian letters,
   * Persian digits, Latin upper/lower case or digits.
   */
  chars?: 'auto' | string
  /** Share of the duration over which letters settle one after another. Default `0.75`. */
  spread?: number
  /** Glyph changes per second. Default `24`. */
  rate?: number
  /** Shapes the settle schedule. Default linear. */
  ease?: EaseLike
  /** Seed for the glyph sequence (the same seed always flickers the same way). */
  seed?: number
  /** Create without playing (for scrubbing). Default `false`. */
  paused?: boolean
  ticker?: Ticker
}

const POOLS = {
  persian: [...'ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی'],
  persianDigits: [...'۰۱۲۳۴۵۶۷۸۹'],
  upper: [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'],
  lower: [...'abcdefghijklmnopqrstuvwxyz'],
  digits: [...'0123456789'],
}

function poolFor(ch: string): string[] | null {
  const cp = ch.codePointAt(0)!
  if (cp >= 0x06f0 && cp <= 0x06f9) return POOLS.persianDigits
  if ((cp >= 0x0620 && cp <= 0x064a) || (cp >= 0x0671 && cp <= 0x06d3)) return POOLS.persian
  if (cp >= 0x41 && cp <= 0x5a) return POOLS.upper
  if (cp >= 0x61 && cp <= 0x7a) return POOLS.lower
  if (cp >= 0x30 && cp <= 0x39) return POOLS.digits
  return null
}

function hash(a: number, b: number, c: number): number {
  let h = Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1) ^ Math.imul(c, 0x9e3779b1 | 0)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

/** Runs in progress per element, so a new scramble starts from the real text. */
const running = new WeakMap<Element, { timeline: Timeline; restore: () => void }>()

export function scrambleText(target: Element | string, options: ScrambleOptions = {}): Timeline {
  const el = (typeof target === 'string' ? document.querySelector(target) : target) as HTMLElement | null
  if (!el) throw new Error(`[veyra] scrambleText: no element for ${String(target)}`)
  const previous = running.get(el)
  if (previous) {
    previous.timeline.pause()
    previous.restore()
  }
  const duration = Math.max(0.001, options.duration ?? 1.2)
  const spread = Math.min(1, Math.max(0, options.spread ?? 0.75))
  const rate = options.rate ?? 24
  const seed = options.seed ?? 1
  const shape = resolveEase(options.ease, (t) => t)
  const custom = options.chars && options.chars !== 'auto' ? [...options.chars] : null

  // Every text node, split into graphemes; letters get a pool and a settle time.
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const nodes: Array<{ node: Text; glyphs: Array<{ text: string; pool: string[] | null; index: number }> }> = []
  let letters = 0
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const node = n as Text
    if (node.parentElement?.closest('[data-veyra-sr]')) continue
    const glyphs = graphemes(node.data).map((text) => {
      const native = poolFor(text)
      const pool = native ? (custom ?? native) : null
      return { text, pool, index: pool ? letters++ : -1 }
    })
    nodes.push({ node, glyphs })
  }
  const settleAt = (index: number) => 1 - spread + spread * shape((index + 1) / Math.max(1, letters))
  const label = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  const hadLabel = el.hasAttribute('aria-label')
  let lastKey = ''

  const render = (p: number) => {
    const bucket = Math.floor(p * duration * rate)
    // Re-render only when a glyph could have changed.
    const key = p >= 1 ? 'done' : `${bucket}`
    if (key === lastKey) return
    lastKey = key
    for (const { node, glyphs } of nodes) {
      let out = ''
      for (const g of glyphs) {
        if (!g.pool || p >= settleAt(g.index)) out += g.text
        else out += g.pool[hash(seed, g.index, bucket) % g.pool.length]
      }
      if (node.data !== out) node.data = out
    }
    if (!hadLabel) {
      if (p < 1) el.setAttribute('aria-label', label)
      else el.removeAttribute('aria-label')
    }
  }

  const restore = () => {
    for (const { node, glyphs } of nodes) node.data = glyphs.map((g) => g.text).join('')
    if (!hadLabel) el.removeAttribute('aria-label')
  }
  const tl = new Timeline({ ticker: options.ticker })
  tl.add(render, options.delay ?? 0, { duration, ease: 'linear' })
  tl.call(() => {
    if (running.get(el)?.timeline === tl) running.delete(el)
  }, (options.delay ?? 0) + duration)
  running.set(el, { timeline: tl, restore })
  if (!options.paused) tl.play()
  return tl
}
