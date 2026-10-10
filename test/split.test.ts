import { describe, expect, it } from 'vitest'
import { clusterJoiningType, joiningType, shapeClusters, strongDirection, toPersianDigits, ZWJ } from '../src/text/script'
import { splitText } from '../src/text/split'

describe('joining types', () => {
  it('classifies Persian letters', () => {
    expect(joiningType('ب'.codePointAt(0)!)).toBe('D')
    expect(joiningType('ی'.codePointAt(0)!)).toBe('D') // Farsi yeh
    expect(joiningType('ک'.codePointAt(0)!)).toBe('D') // keheh
    expect(joiningType('ا'.codePointAt(0)!)).toBe('R')
    expect(joiningType('و'.codePointAt(0)!)).toBe('R')
    expect(joiningType('ژ'.codePointAt(0)!)).toBe('R')
    expect(joiningType('ء'.codePointAt(0)!)).toBe('U')
    expect(joiningType(0x064e)).toBe('T') // fatha
    expect(joiningType(0x200c)).toBe('U') // ZWNJ
    expect(joiningType(0x200d)).toBe('C') // ZWJ
    expect(clusterJoiningType('بَ')).toBe('D')
  })
})

describe('shapeClusters', () => {
  it('adds joiners on connecting sides', () => {
    // «دوغ»: dal (R) | vav (R) | ghain (D)
    const parts = shapeClusters('دوغ')
    expect(parts.map((p) => p.text)).toEqual(['د', 'و', 'غ'])
    expect(parts.map((p) => [p.joinsPrevious, p.joinsNext])).toEqual([
      [false, false], // dal never joins forward
      [false, false], // vav after dal: dal cannot join forward
      [false, false], // ghain after vav: vav cannot join forward
    ])
    // «بطری»: beh D, tah D, reh R, yeh D
    const b = shapeClusters('بطری')
    expect(b.map((p) => p.display)).toEqual([`ب${ZWJ}`, `${ZWJ}ط${ZWJ}`, `${ZWJ}ر`, 'ی'])
  })

  it('keeps lam-alef together', () => {
    const parts = shapeClusters('سلام')
    expect(parts.map((p) => p.text)).toEqual(['س', 'لا', 'م'])
    expect(parts[0]!.display).toBe(`س${ZWJ}`)
    expect(parts[1]!.display).toBe(`${ZWJ}لا`)
  })

  it('respects ZWNJ (nim-fasele) as a break', () => {
    const parts = shapeClusters('کوه‌ها')
    const he1 = parts[2]!
    // Grapheme segmentation keeps the ZWNJ with the letter before it.
    expect(he1.text.startsWith('ه')).toBe(true)
    expect(he1.joinsNext).toBe(false)
    const he2 = parts[3]!
    expect(he2.text).toBe('ه')
    expect(he2.joinsPrevious).toBe(false)
    expect(he2.joinsNext).toBe(true)
  })

  it('keeps diacritics with their base letter', () => {
    const parts = shapeClusters('بِه')
    expect(parts.map((p) => p.text)).toEqual(['بِ', 'ه'])
    expect(parts[0]!.joinsNext).toBe(true)
  })

  it('leaves Latin untouched', () => {
    expect(shapeClusters('Veyra').map((p) => p.display).join('')).toBe('Veyra')
  })
})

describe('splitText', () => {
  it('splits words and chars with indices and a11y copy', () => {
    const el = document.createElement('h1')
    el.setAttribute('dir', 'rtl')
    el.textContent = 'یک بطری کوه'
    document.body.append(el)
    const s = splitText(el, { type: 'chars' })
    expect(s.words).toHaveLength(3)
    expect(s.chars.map((c) => c.textContent?.replaceAll(ZWJ, '')).join('')).toBe('یکبطریکوه')
    expect(s.words[1]!.style.getPropertyValue('--word-index')).toBe('1')
    expect(el.querySelector('[data-veyra-sr]')?.textContent).toBe('یک بطری کوه')
    expect(s.chars.every((c) => c.getAttribute('aria-hidden') === 'true')).toBe(true)
    s.revert()
    expect(el.textContent).toBe('یک بطری کوه')
    el.remove()
  })

  it('keeps an English run inside Persian as one isolated unit', () => {
    const el = document.createElement('p')
    el.setAttribute('dir', 'rtl')
    el.textContent = 'ساخته‌شده با Veyra Core، نسخهٔ ۱'
    document.body.append(el)
    const s = splitText(el)
    const run = s.words.find((w) => w.textContent?.startsWith('Veyra'))!
    // Boundary punctuation stays outside the LTR isolate.
    expect(run.textContent).toBe('Veyra Core،')
    const iso = run.querySelector('[dir="ltr"]')!
    expect(iso.textContent).toBe('Veyra Core')
    el.remove()
  })

  it('lets digits after an English run join it (bidi W7)', () => {
    const el = document.createElement('p')
    el.setAttribute('dir', 'rtl')
    el.textContent = 'موتور Veyra 0.1 آماده است'
    document.body.append(el)
    const s = splitText(el)
    const iso = el.querySelector('[dir="ltr"]')!
    expect(iso.textContent).toBe('Veyra 0.1')
    expect(s.words).toHaveLength(4)
    el.remove()
  })

  it('re-splitting starts from the original markup', () => {
    const el = document.createElement('p')
    el.textContent = 'one two'
    document.body.append(el)
    splitText(el, { type: 'chars' })
    const again = splitText(el)
    expect(again.words).toHaveLength(2)
    expect(el.querySelectorAll('[data-veyra-sr]')).toHaveLength(1)
    el.remove()
  })

  it('masks words', () => {
    const el = document.createElement('p')
    el.textContent = 'a b'
    document.body.append(el)
    const s = splitText(el, { mask: 'words' })
    expect(s.words[0]!.parentElement!.style.overflow).toBe('hidden')
    el.remove()
  })
})

describe('direction helpers', () => {
  it('detects strong direction and converts digits', () => {
    expect(strongDirection('۱۲ کوه')).toBe('rtl')
    expect(strongDirection('12 Veyra')).toBe('ltr')
    expect(strongDirection('123 !')).toBe(null)
    expect(toPersianDigits('260 ml')).toBe('۲۶۰ ml')
  })
})
