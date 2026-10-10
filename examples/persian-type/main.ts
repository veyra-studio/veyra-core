import { animate, createStage, kashida, scrambleText, splitText, timeline, toPersianDigits } from '@veyra/core'

const stage = createStage({ scroll: false })

// The naive approach, for comparison: one inline-block per letter.
const naive = document.getElementById('naive')!
naive.innerHTML = [...naive.textContent!].map((c) => (c === ' ' ? ' ' : `<span>${c}</span>`)).join('')

await document.fonts.ready

const veyra = splitText('#veyra', { type: 'chars' })
const display = splitText('#display', { type: 'chars' })
const mixed = splitText('#mixed', { type: 'words' })
const lines = splitText('#lines', { type: 'lines', mask: 'lines' })

// Kashida: a slider sets the level; replay stretches and releases it.
const stretch = kashida('#kashida')
const range = document.getElementById('k-range') as HTMLInputElement
const levelOut = document.getElementById('k-level')!
const showLevel = () => (levelOut.textContent = toPersianDigits(Math.floor(stretch.level)))
range.addEventListener('input', () => {
  stretch.level = Number(range.value)
  showLevel()
})

function play() {
  scrambleText('#scramble-fa', { duration: 1.6, ticker: stage.ticker })
  scrambleText('#scramble-en', { duration: 1.4, delay: 0.2, ticker: stage.ticker })
  const k = stage.timeline({ onUpdate: () => ((range.value = String(Math.floor(stretch.level))), showLevel()) })
  k.to(stretch, { level: 8 }, { duration: 1.1, ease: 'drift' }, 0.3).to(stretch, { level: 0 }, { duration: 1.1, ease: 'drift' }, '+=0.6')
  k.play()

  const tl = stage.timeline()
  tl.fromTo(veyra.chars, { y: 40, opacity: 0 }, { y: 0, opacity: 1 }, { duration: 0.9, stagger: 0.035, ease: 'glide' }, 0)
  tl.fromTo(display.chars, { y: '0.6em', rotate: -8, opacity: 0 }, { y: '0em', rotate: 0, opacity: 1 }, { duration: 1.1, stagger: 0.06, ease: 'backOut' }, 0.2)
  tl.fromTo(mixed.words, { y: 24, opacity: 0 }, { y: 0, opacity: 1 }, { duration: 0.8, stagger: 0.08 }, 0.4)
  tl.fromTo(lines.lines, { y: '110%' }, { y: '0%' }, { duration: 1.2, stagger: 0.12, ease: 'glide' }, 0.5)
  tl.play()
}

play()
document.getElementById('replay')!.addEventListener('click', play)

// Re-split lines when the layout width changes.
stage.viewport.onLayout(() => lines.refresh())

// Expose for debugging in the console.
Object.assign(window, { veyra: { stage, animate, timeline }, __ex: { stage, stretch } })
