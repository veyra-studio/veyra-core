// End-to-end checks of the examples in a real browser (headless Chromium).
//
//   npm run examples:build && npm run verify:examples
//
// Serves examples-dist/, opens every example, fails on console errors or
// failed requests, and exercises the features each page demonstrates:
// dragging and snapping in both directions, keyboard stepping, FLIP,
// pointer effects, marquees, horizontal sections (both directions, snap,
// focus), kashida, scramble, the GLSL chunks compiling, image sequences.
// Screenshots go to verify-output/.
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { chromium } from 'playwright'

const ROOT = new URL('../examples-dist/', import.meta.url).pathname
const OUT = new URL('../verify-output/', import.meta.url).pathname
if (!existsSync(ROOT)) {
  console.error('examples-dist/ is missing — run "npm run examples:build" first.')
  process.exit(1)
}
mkdirSync(OUT, { recursive: true })
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.webp': 'image/webp' }

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  let file = normalize(join(ROOT, decodeURIComponent(url.pathname)))
  if (!file.startsWith(ROOT)) return res.writeHead(403).end()
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
  if (!existsSync(file)) return res.writeHead(404).end('not found')
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).pipe(res)
})
await new Promise((r) => server.listen(0, r))
const BASE = `http://localhost:${server.address().port}`

const failures = []
const fail = (msg) => {
  failures.push(msg)
  console.log(`  ✗ ${msg}`)
}
const pass = (msg) => console.log(`  ✓ ${msg}`)
const check = (ok, msg, detail = '') => (ok ? pass(msg) : fail(detail ? `${msg} — ${detail}` : msg))
const wait = (page, ms) => page.waitForTimeout(ms)

async function visit(browser, name, path, steps, options = {}) {
  console.log(`\n${name}`)
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...options })
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('response', (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`))
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await wait(page, 600)
  try {
    await steps(page)
  } catch (error) {
    fail(`${name}: ${error?.stack ?? error}`)
  }
  check(errors.length === 0, `${name}: no console or network errors`, errors.join(' | '))
  await context.close()
}

const center = (page, sel) =>
  page.$eval(sel, (el) => {
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
const scrollToSection = (page, sel, fraction) =>
  page.evaluate(
    ([s, f]) => {
      const el = document.querySelector(s)
      const top = el.getBoundingClientRect().top + scrollY
      window.scrollTo(0, top + (el.offsetHeight - innerHeight) * f)
    },
    [sel, fraction],
  )
const translateX = (page, sel) =>
  page.$eval(sel, (el) => {
    const m = /translate3d\((-?[\d.]+)px/.exec(el.style.transform)
    return m ? Number(m[1]) : 0
  })

try {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })

  await visit(browser, 'Index', '/', async (page) => {
    const links = await page.$$eval('main li a', (as) => as.length)
    check(links === 6, `lists all six examples (${links})`)
  })

  await visit(browser, 'Persian typography', '/persian-type/', async (page) => {
    await page.$eval('#k-range', (input) => {
      input.value = '6'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const stretched = await page.$eval('#kashida', (el) => ({ text: el.textContent, label: el.getAttribute('aria-label') }))
    check(/ـ{6}/.test(stretched.text), 'kashida inserts six tatweels on a connection', stretched.text)
    check(stretched.label === 'کشیده بنویس، آرام بخوان', 'kashida keeps the original text for assistive tech')
    await page.screenshot({ path: `${OUT}persian-type-kashida.png`, fullPage: true })
    await page.click('#replay')
    await wait(page, 400)
    const mid = await page.$eval('#scramble-en', (el) => el.textContent)
    check(mid !== 'Decoded, letter by letter', 'scramble shows random glyphs while decoding', mid)
    await wait(page, 3600)
    const done = await page.$$eval('#scramble-fa, #scramble-en', (els) => els.map((e) => e.textContent))
    check(done[0] === 'حرف به حرف، رمزگشایی' && done[1] === 'Decoded, letter by letter', 'scramble settles on the original text', done.join(' / '))
    const level = await page.evaluate(() => window.__ex.stretch.level)
    check(level === 0, `kashida animation returns to level 0 (${level})`)
  })

  await visit(browser, 'Interaction', '/interaction/', async (page) => {
    // Drag the English carousel to the left and let it snap.
    await page.$eval('#track-en', (el) => el.parentElement.scrollIntoView({ block: 'center' }))
    await wait(page, 300)
    const en = await center(page, '#track-en')
    await page.mouse.move(640, en.y)
    await page.mouse.down()
    for (let i = 1; i <= 12; i++) await page.mouse.move(640 - i * 30, en.y)
    await page.mouse.up()
    await wait(page, 1800)
    const enState = await page.evaluate(() => {
      const d = window.__ex.drags[0]
      const box = document.querySelector('#track-en').parentElement.getBoundingClientRect()
      const edges = [...document.querySelectorAll('#track-en .card')].map((c) => Math.abs(c.getBoundingClientRect().left - box.left))
      const track = document.querySelector('#track-en').getBoundingClientRect()
      return { x: d.x, moving: d.moving, aligned: Math.min(...edges), atEnd: Math.abs(track.right - box.right) < 1 }
    })
    check(enState.x < 0 && !enState.moving, `English carousel moved left and came to rest (x = ${enState.x.toFixed(1)})`)
    check(enState.aligned < 1.5 || enState.atEnd, `…on a card's start edge or the end bound (${enState.atEnd ? 'end' : `off by ${enState.aligned.toFixed(2)}px`})`)

    // Drag the Persian carousel to the right: it starts at the right edge.
    await page.$eval('#track-fa', (el) => el.parentElement.scrollIntoView({ block: 'center' }))
    await wait(page, 300)
    const fa = await center(page, '#track-fa')
    await page.mouse.move(640, fa.y)
    await page.mouse.down()
    for (let i = 1; i <= 12; i++) await page.mouse.move(640 + i * 30, fa.y)
    await page.mouse.up()
    await wait(page, 1800)
    const faState = await page.evaluate(() => {
      const d = window.__ex.drags[1]
      const box = document.querySelector('#track-fa').parentElement.getBoundingClientRect()
      const edges = [...document.querySelectorAll('#track-fa .card')].map((c) => Math.abs(c.getBoundingClientRect().right - box.right))
      const track = document.querySelector('#track-fa').getBoundingClientRect()
      return { x: d.x, moving: d.moving, aligned: Math.min(...edges), atEnd: Math.abs(track.left - box.left) < 1 }
    })
    check(faState.x > 0 && !faState.moving, `Persian carousel moved right and came to rest (x = ${faState.x.toFixed(1)})`)
    check(faState.aligned < 1.5 || faState.atEnd, `…on a card's start (right) edge or the end bound (${faState.atEnd ? 'end' : `off by ${faState.aligned.toFixed(2)}px`})`)

    // Keyboard on the English carousel: back one card, then forward one card.
    await page.$eval('#track-en', (el) => el.parentElement.scrollIntoView({ block: 'center' }))
    await page.focus('#track-en')
    const x0 = await page.evaluate(() => window.__ex.drags[0].x)
    await page.keyboard.press('ArrowLeft')
    await wait(page, 1500)
    const x1 = await page.evaluate(() => window.__ex.drags[0].x)
    await page.keyboard.press('ArrowRight')
    await wait(page, 1500)
    const x2 = await page.evaluate(() => window.__ex.drags[0].x)
    const pitch = await page.$$eval('#track-en .card', (cards) => cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left)
    check(x1 > x0 && x1 - x0 <= pitch + 1, `ArrowLeft steps back to the previous card (${x0.toFixed(0)} → ${x1.toFixed(0)})`)
    check(x2 < x1 && x1 - x2 <= pitch + 1, `ArrowRight steps forward one card (${x1.toFixed(0)} → ${x2.toFixed(0)})`)

    // FLIP: switching to list view animates, then settles with no transforms left.
    await page.$eval('#tiles', (el) => el.scrollIntoView({ block: 'center' }))
    await wait(page, 300)
    await page.click('#layout')
    await wait(page, 120)
    const moving = await page.$$eval('#tiles li', (lis) => lis.filter((li) => li.style.transform && li.style.transform !== 'none').length)
    check(moving > 0, `FLIP animates tiles to the list layout (${moving} moving)`)
    await page.screenshot({ path: `${OUT}interaction-flip.png` })
    await wait(page, 1400)
    const settled = await page.$$eval('#tiles li', (lis) => lis.every((li) => !li.style.transform || li.style.transform === 'none'))
    const listed = await page.$eval('#tiles', (el) => el.classList.contains('is-list'))
    check(settled && listed, 'FLIP leaves no transforms once settled')

    // Magnetic, tilt and the custom cursor.
    await page.$eval('.magnets', (el) => el.scrollIntoView({ block: 'center' }))
    await wait(page, 300)
    const magnet = await center(page, '.magnet')
    await page.mouse.move(magnet.x + 30, magnet.y + 10, { steps: 6 })
    await wait(page, 600)
    const magnetT = await page.$eval('.magnet', (el) => el.style.transform)
    check(/translate3d\(/.test(magnetT), `magnetic button leans toward the pointer (${magnetT})`)
    const card = await center(page, '.tilt-card')
    await page.mouse.move(card.x + 80, card.y - 60, { steps: 6 })
    await wait(page, 700)
    const tiltState = await page.$eval('.tilt-card', (el) => ({ t: el.style.transform, glare: el.style.getPropertyValue('--tilt-active') }))
    check(/rotateX\(.+rotateY\(/.test(tiltState.t) && Number(tiltState.glare) > 0.5, `tilt card leans and lights up (${tiltState.t})`)
    const cursor = await page.$eval('.veyra-cursor', (el) => ({ state: el.getAttribute('data-cursor-state'), label: el.textContent, t: el.style.transform }))
    check(cursor.state === 'View' && cursor.label === 'View', `cursor shows the target's label (${cursor.state})`)
    await page.screenshot({ path: `${OUT}interaction-pointer.png` })

    // Marquees run in opposite directions.
    await page.$eval('.marquees', (el) => el.scrollIntoView({ block: 'center' }))
    await wait(page, 400)
    const o1 = await page.evaluate(() => window.__ex.marquees.map((m) => m.offset))
    await wait(page, 1000)
    const o2 = await page.evaluate(() => window.__ex.marquees.map((m) => m.offset))
    const d0 = o2[0] - o1[0]
    const d1 = o2[1] - o1[1]
    const wrapped = (d, dir) => (dir < 0 ? d < 0 || d > 100 : d > 0 || d < -100)
    check(wrapped(d0, -1) && wrapped(d1, 1), `English marquee runs left, Persian runs right (Δ ${d0.toFixed(0)} / ${d1.toFixed(0)})`)
    await page.screenshot({ path: `${OUT}interaction-marquee.png` })
  })

  await visit(browser, 'Horizontal sections', '/horizontal/', async (page) => {
    await scrollToSection(page, '#h-en', 0.43)
    await wait(page, 250)
    const enX = await translateX(page, '#h-en .h-track')
    check(enX < -200, `left-to-right row travels left (x = ${enX.toFixed(0)})`)
    await wait(page, 1600)
    const enSnap = await page.evaluate(() => {
      const h = window.__ex.en
      const track = document.querySelector('#h-en .h-track')
      const pin = document.querySelector('#h-en .h-pin').getBoundingClientRect()
      const edges = h.panels.map((p) => Math.abs(p.getBoundingClientRect().left - pin.left - parseFloat(getComputedStyle(track).paddingInlineStart)))
      return { active: h.active, travel: h.travel, edge: Math.min(...edges), atEnd: Math.abs(h.travel - h.distance) < 1 }
    })
    check(enSnap.edge < 2 || enSnap.atEnd, `…and settles on a panel when scrolling stops (panel ${enSnap.active + 1}, off by ${enSnap.edge.toFixed(1)}px)`)
    await page.screenshot({ path: `${OUT}horizontal-en.png` })

    await scrollToSection(page, '#h-fa', 0.43)
    await wait(page, 250)
    const faX = await translateX(page, '#h-fa .h-track')
    check(faX > 200, `right-to-left row travels right (x = ${faX.toFixed(0)})`)
    await wait(page, 1600)
    const faSnap = await page.evaluate(() => {
      const h = window.__ex.fa
      const track = document.querySelector('#h-fa .h-track')
      const pin = document.querySelector('#h-fa .h-pin').getBoundingClientRect()
      const edges = h.panels.map((p) => Math.abs(pin.right - p.getBoundingClientRect().right - parseFloat(getComputedStyle(track).paddingInlineStart)))
      return { active: h.active, edge: Math.min(...edges), atEnd: Math.abs(h.travel - h.distance) < 1 }
    })
    check(faSnap.edge < 2 || faSnap.atEnd, `…and settles on a panel (panel ${faSnap.active + 1}, off by ${faSnap.edge.toFixed(1)}px)`)
    const count = await page.$eval('#count-fa', (el) => el.textContent)
    check(/^[۰-۹]{2}$/.test(count), `Persian counter uses Persian digits (${count})`)
    await page.screenshot({ path: `${OUT}horizontal-fa.png` })

    // Focus inside an offscreen panel brings it into view.
    await scrollToSection(page, '#h-en', 0)
    await wait(page, 500)
    await page.focus('#h-en .panel:nth-child(4) a')
    await wait(page, 2200)
    const focusState = await page.evaluate(() => ({ active: window.__ex.en.active, scrollLeft: document.querySelector('#h-en .h-pin').scrollLeft }))
    check(focusState.active === 3 && focusState.scrollLeft === 0, `focusing a link in panel 4 scrolls the page to it (active panel ${focusState.active + 1})`)
  })

  await visit(browser, 'Procedural', '/procedural/', async (page) => {
    const glsl = await page.evaluate(() => window.__ex.status.glsl)
    check(glsl === 'ok', `GLSL chunks compile and link in WebGL2 (${glsl})`)
    await page.$eval('#shader', (el) => el.scrollIntoView({ block: 'center' }))
    await wait(page, 900)
    await page.screenshot({ path: `${OUT}procedural-shader.png` })
    await page.$eval('#field', (el) => el.scrollIntoView({ block: 'center' }))
    await wait(page, 900)
    const varied = await page.$eval('#field', (canvas) => {
      const ctx = canvas.getContext('2d')
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const seen = new Set()
      for (let i = 0; i < data.length; i += 4 * 997) seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`)
      return seen.size
    })
    check(varied > 5, `noise field draws (${varied} distinct sampled colors)`)
    await scrollToSection(page, '#seq', 0)
    await page.waitForFunction(() => window.__ex.sequence.loaded === 72, null, { timeout: 15000 })
    await scrollToSection(page, '#seq', 0.5)
    await wait(page, 500)
    const frame = await page.evaluate(() => window.__ex.sequence.frame)
    check(Math.abs(frame - 36) <= 2, `image sequence shows the middle frame halfway through (${frame})`)
    await page.screenshot({ path: `${OUT}procedural-sequence.png` })
  })

  await visit(browser, 'Scroll scenes (regression)', '/scroll-scenes/', async (page) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3))
    await wait(page, 700)
  })
  await visit(browser, 'three.js + DOM (regression)', '/three-dom/', async (page) => {
    await wait(page, 800)
  })
  await visit(browser, 'Interaction · reduced motion', '/interaction/', async (page) => {
    const o1 = await page.evaluate(() => window.__ex.marquees.map((m) => m.offset))
    await wait(page, 600)
    const o2 = await page.evaluate(() => window.__ex.marquees.map((m) => m.offset))
    check(o1.every((v, i) => v === 0 && o2[i] === 0), 'marquees stay still')
    const en = await center(page, '#track-en')
    await page.mouse.move(640, en.y)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++) await page.mouse.move(640 - i * 30, en.y)
    await page.mouse.up()
    const state = await page.evaluate(() => ({ moving: window.__ex.drags[0].moving, x: window.__ex.drags[0].x }))
    check(!state.moving && state.x < 0, `a released drag lands immediately (x = ${state.x.toFixed(0)})`)
  }, { reducedMotion: 'reduce' })

  await browser.close()
} catch (error) {
  fail(String(error?.stack ?? error))
} finally {
  server.close()
}

console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nAll checks passed')
process.exit(failures.length ? 1 : 0)
