import { describe, expect, it } from 'vitest'
import { Ticker } from '../src/core/ticker'
import { elongate, kashida, kashidaPoints, TATWEEL } from '../src/text/kashida'
import { scrambleText } from '../src/text/scramble'

const manualTicker = () => new Ticker({ autoPause: false, requestFrame: () => 0, cancelFrame: () => {} })

describe('kashida', () => {
  it('finds connections, best first', () => {
    // ک ش ی د ه: after sheen (seen family) first, then the last connection, then the rest.
    expect(kashidaPoints('کشیده')).toEqual([2, 3, 1])
  })

  it('never breaks lam-alef or joins across ZWNJ or non-joining letters', () => {
    // س ل ا م: lam-alef stays a ligature; alef does not join forward.
    expect(kashidaPoints('سلام')).toEqual([1])
    // م ی ZWNJ خ و ا ه م
    expect(kashidaPoints('می‌خواهم')).toEqual([7, 4, 1])
    expect(kashidaPoints('Veyra')).toEqual([])
    expect(kashidaPoints('دوغ')).toEqual([])
  })

  it('elongates on the best connection or spreads across them', () => {
    expect(elongate('کشیده', 1)).toBe(`کش${TATWEEL}یده`)
    expect(elongate('کشیده', 3)).toBe(`کش${TATWEEL.repeat(3)}یده`)
    expect(elongate('کشیده', 2, { mode: 'spread' })).toBe(`کش${TATWEEL}ی${TATWEEL}ده`)
    expect(elongate('کشیده', 3, { mode: 'spread' })).toBe(`ک${TATWEEL}ش${TATWEEL}ی${TATWEEL}ده`)
    expect(elongate('سلام', 2)).toBe(`س${TATWEEL.repeat(2)}لام`)
    expect(elongate('Veyra کشیده', 1)).toBe(`Veyra کش${TATWEEL}یده`)
    expect(elongate('کشیده', 0)).toBe('کشیده')
    expect(elongate('کشیده', 1.9)).toBe(`کش${TATWEEL}یده`)
  })

  it('drives an element and exposes the original text while stretched', () => {
    const el = document.createElement('h1')
    el.innerHTML = 'نوش <em>جان</em>'
    const k = kashida(el)
    k.level = 2.6
    // ن→و is the only connection in «نوش» (و never joins forward); ج→ا in «جان».
    expect(el.textContent).toBe(`ن${TATWEEL.repeat(2)}وش ج${TATWEEL.repeat(2)}ان`)
    expect(el.querySelector('em')).not.toBeNull()
    expect(el.getAttribute('aria-label')).toBe('نوش جان')
    k.revert()
    expect(el.textContent).toBe('نوش جان')
    expect(el.hasAttribute('aria-label')).toBe(false)
  })
})

describe('scrambleText', () => {
  it('flickers through script-appropriate glyphs and settles on the text', () => {
    const el = document.createElement('p')
    el.textContent = 'سلام Veyra 42'
    const tl = scrambleText(el, { paused: true, seed: 3, duration: 1, ticker: manualTicker() })
    tl.progress = 0
    const scrambled = el.textContent!
    expect(scrambled).not.toBe('سلام Veyra 42')
    expect([...scrambled].length).toBe([...'سلام Veyra 42'].length)
    expect(scrambled[4]).toBe(' ')
    expect(scrambled[10]).toBe(' ')
    expect(scrambled.slice(0, 4)).toMatch(/^[ء-ی]{4}$/u)
    expect(scrambled[5]).toMatch(/[A-Z]/)
    expect(scrambled.slice(6, 10)).toMatch(/^[a-z]{4}$/)
    expect(scrambled.slice(11)).toMatch(/^\d\d$/)
    expect(el.getAttribute('aria-label')).toBe('سلام Veyra 42')

    // Same seed, same progress → same glyphs (scrubbing is stable).
    const other = document.createElement('p')
    other.textContent = 'سلام Veyra 42'
    const tl2 = scrambleText(other, { paused: true, seed: 3, duration: 1, ticker: manualTicker() })
    tl2.progress = 0
    expect(other.textContent).toBe(scrambled)

    tl.progress = 1
    expect(el.textContent).toBe('سلام Veyra 42')
    expect(el.hasAttribute('aria-label')).toBe(false)
  })

  it('settles letters from the start of the text', () => {
    const el = document.createElement('p')
    el.textContent = 'abcdefgh'
    const tl = scrambleText(el, { paused: true, spread: 1, duration: 1, ticker: manualTicker() })
    tl.progress = 0.5
    expect(el.textContent!.slice(0, 3)).toBe('abc')
    expect(el.textContent!.slice(5)).not.toBe('fgh')
  })

  it('starts a new run from the real text when one is already running', () => {
    const el = document.createElement('p')
    el.textContent = 'رمزگشایی'
    const first = scrambleText(el, { paused: true, ticker: manualTicker() })
    first.progress = 0.3
    expect(el.textContent).not.toBe('رمزگشایی')
    const second = scrambleText(el, { paused: true, ticker: manualTicker() })
    second.progress = 1
    expect(el.textContent).toBe('رمزگشایی')
  })
})
