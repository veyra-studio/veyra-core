import { createStage, inlineSign, mapRange, scenePresets, splitText, Spring } from '@veyra/core'

const stage = createStage()

// Hero: masked word reveal on load.
const title = splitText('#title', { type: 'words', mask: 'words' })
stage.timeline().fromTo(title.words, { y: '110%' }, { y: '0%' }, { duration: 1.2, stagger: 0.08, ease: 'glide' }).play()

// Pinned horizontal track. `inlineSign` flips the direction for RTL pages.
const track = document.getElementById('track')!
const count = document.getElementById('count')!
const pinInner = document.querySelector<HTMLElement>('.pin-inner')!
const spring = new Spring(0, { stiffness: 140, damping: 24 })
stage.scene('#pin', {
  ...scenePresets.pinned,
  cssVar: '--progress',
  onUpdate(scene, frame) {
    spring.target = scene.progress
    const p = spring.step(frame.delta)
    const distance = track.scrollWidth - pinInner.clientWidth + 64
    track.style.transform = `translate3d(${-p * distance * inlineSign(track)}px, 0, 0)`
    count.textContent = String(Math.round(scene.progress * 100))
  },
})
// The progress bar reads --progress from its scene element.
document.querySelector<HTMLElement>('.pin-inner')!.style.setProperty('--progress', 'inherit')

// A timeline scrubbed by a pinned scene.
const tl = stage.timeline()
tl.fromTo('.shape.a', { x: '-30vw', rotate: -90 }, { x: '0vw', rotate: 45 }, { duration: 1, ease: 'drift' }, 0)
  .fromTo('.shape.b', { y: '40vh', scale: 0.2 }, { y: '0vh', scale: 1.4 }, { duration: 1, ease: 'drift' }, 0.1)
  .fromTo('.shape.c', { x: '30vw', rotate: 120 }, { x: '0vw', rotate: 0 }, { duration: 1, ease: 'drift' }, 0.2)
  .to('.shape.a', { scale: 2.2, rotate: 225 }, { duration: 0.6, ease: 'tension' }, 1.2)
stage.scene('#scrub', { ...scenePresets.pinned, timeline: tl, smooth: 10 })

// CSS-only: the scene writes --progress, the stylesheet does the rest.
stage.scene('#cssonly', { start: 'top bottom', end: 'center center', cssVar: '--progress' })

// Keep the counter honest under reduced motion.
stage.reducedMotion.subscribe((reduced) => console.info('[example] reduced motion:', reduced), { immediate: true })
Object.assign(window, { stage, mapRange })
