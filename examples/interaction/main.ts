import { createStage, cursor, draggable, flip, magnetic, marquee, stagger, tilt, type Draggable } from '@veyra/core'

const stage = createStage()
stage.use(cursor())

// Carousels: snap so that a card's start edge meets the carousel's start edge.
const drags: Draggable[] = []
for (const carousel of document.querySelectorAll<HTMLElement>('.carousel')) {
  const track = carousel.querySelector<HTMLElement>('.track')!
  const snaps: number[] = []
  let drag: Draggable | null = null
  const measure = () => {
    const rtl = getComputedStyle(carousel).direction === 'rtl'
    const box = carousel.getBoundingClientRect()
    const x = drag?.x ?? 0
    snaps.length = 0
    for (const card of track.children) {
      const r = card.getBoundingClientRect()
      snaps.push(rtl ? x + (box.right - r.right) : x - (r.left - box.left))
    }
  }
  measure()
  drag = stage.use(draggable(track, { axis: 'x', bounds: 'parent', snap: snaps, keyboard: 'content' }))
  stage.onRefresh(measure)
  drags.push(drag)
}

// FLIP: three different layout changes, one call each.
const list = document.getElementById('tiles')!
const tiles = () => list.querySelectorAll('li')
const animate = (change: () => void) => flip(tiles(), change, { stagger: stagger(0.012, { from: 'center' }), immediate: stage.reducedMotion.value })
document.getElementById('shuffle')!.addEventListener('click', () =>
  animate(() => {
    const items = [...tiles()]
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[items[i], items[j]] = [items[j]!, items[i]!]
    }
    list.append(...items)
  }),
)
const toggle = (id: string, change: (on: boolean) => void) => {
  const button = document.getElementById(id)!
  button.addEventListener('click', () => {
    const on = button.getAttribute('aria-pressed') !== 'true'
    button.setAttribute('aria-pressed', String(on))
    animate(() => change(on))
  })
}
toggle('layout', (on) => list.classList.toggle('is-list', on))
toggle('filter', (on) => tiles().forEach((li) => (li.hidden = on && Number(li.textContent) % 2 === 0)))

for (const el of document.querySelectorAll('.magnet')) stage.use(magnetic(el, { inner: 'span' }))
for (const el of document.querySelectorAll('.tilt-card')) stage.use(tilt(el, { max: 9, scale: 1.02, glare: true }))

const marquees = [
  stage.use(marquee('#mq-en', { speed: 70, followScroll: true, scrollFactor: 0.25 })),
  stage.use(marquee('#mq-fa', { speed: 70, followScroll: true, scrollFactor: 0.25 })),
]

Object.assign(window, { __ex: { stage, drags, marquees } })
