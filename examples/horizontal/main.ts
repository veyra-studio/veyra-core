import { createStage, horizontal, toPersianDigits } from '@veyra/core'

const stage = createStage()
const pad = (i: number) => String(i + 1).padStart(2, '0')

const countEn = document.getElementById('count-en')!
const countFa = document.getElementById('count-fa')!
const en = stage.use(horizontal('#h-en', { snap: true, onPanel: (i) => (countEn.textContent = pad(i)) }))
const fa = stage.use(horizontal('#h-fa', { snap: true, onPanel: (i) => (countFa.textContent = toPersianDigits(pad(i))) }))

Object.assign(window, { __ex: { stage, en, fa } })
