// End-to-end checks of the examples in a real browser (headless Chromium).
//
//   npm run examples:build && npm run verify:examples
//
// Serves examples-dist/, opens every example, fails on console errors or
// failed requests, and exercises the features each page demonstrates:
// dragging and snapping in both directions, keyboard stepping, FLIP,
// pointer effects, marquees, horizontal sections (both directions, snap,
// focus), kashida, scramble, the GLSL chunks compiling, image sequences,
// product rendering (floor reflection, contact shadow) and baked terrain.
// Screenshots go to verify-output/.
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = fileURLToPath(new URL('../examples-dist/', import.meta.url))
const OUT = fileURLToPath(new URL('../verify-output/', import.meta.url))
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
// Snapping eases out over about a second; on a loaded machine it can take
// longer. Poll until the measurement says it has landed (or give up after 6 s).
const settle = async (page, measure) => {
  let last
  for (let i = 0; i < 12; i++) {
    await wait(page, i === 0 ? 1600 : 400)
    last = await page.evaluate(measure)
    if (last.edge < 2 || last.atEnd) break
  }
  return last
}

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
    check(links === 7, `lists all seven examples (${links})`)
  })

  await visit(browser, 'Persian typography', '/persian-type/', async (page) => {
    // The page opens by playing the stretch 0 → 8 → 0 (about three seconds),
    // which would overwrite a level set while it runs: let it finish first.
    await page.waitForFunction(() => performance.now() > 3600 && !document.querySelector('#kashida').textContent.includes('ـ'), null, { timeout: 15000 })
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
    // The transition takes about a second; on a loaded machine, longer.
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#tiles li')).every((li) => !li.style.transform || li.style.transform === 'none'), null, { timeout: 6000 }).catch(() => {})
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
    const enSnap = await settle(page, () => {
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
    const faSnap = await settle(page, () => {
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

  await visit(browser, 'Product & terrain', '/studio/', async (page) => {
    const soft = await page.evaluate(() => ({ software: window.__ex.status.software, tier: window.__ex.status.tier }))
    check(soft.software === true && soft.tier === 'low', `software rendering detected, quality starts at the lowest tier (${soft.software}, ${soft.tier})`)
    await page.waitForFunction(() => window.__ex.status.warmed === true, null, { timeout: 20000 })
    check(true, 'warmUp compiles and draws the product scene before it shows')
    await scrollToSection(page, '.stage-wrap', 0.2)
    await page.waitForFunction(() => (window.__ex.status.frames ?? 0) > 3, null, { timeout: 20000 })
    // Let the sticky stage settle where the scroll put it.
    await page.waitForFunction(() => Math.abs(window.__ex.slotRect().top - innerHeight * 0.12) < 2, null, { timeout: 10000 })
    await wait(page, 400)
    const volume = await page.evaluate(() => window.__ex.status.volume)
    check(volume > 0.04 && volume < 0.07, `turned bottle has a sensible volume (${volume.toFixed(4)} cubic units)`)
    const probe = await page.evaluate(() => {
      const r = window.__ex.slotRect()
      const cx = r.left + r.width / 2
      const base = r.top + r.height
      const at = (y) => window.__ex.sample(cx, Math.min(innerHeight - 4, y))
      return { body: window.__ex.sample(cx, r.top + r.height * 0.6), near: at(base + 10), far: at(base + r.height * 0.2), contact: window.__ex.sample(cx + r.width * 0.42, base + 2) }
    })
    check(probe.body[3] > 240 && probe.body[0] > probe.body[2] + 30, `bottle renders, its red liquid seen through the glass (rgba ${probe.body.join(', ')})`)
    check(probe.near[3] > probe.far[3] + 10 && probe.near[3] > 20, `floor reflects the bottle and fades with height (alpha ${probe.near[3]} near → ${probe.far[3]} far)`)
    check(probe.contact[3] > 20, `contact shadow darkens the floor at the foot (alpha ${probe.contact[3]})`)
    const neck = await page.evaluate(() => window.__ex.status.neckAlpha())
    check(neck.clear < neck.milky && neck.clear < 100, `see-through glass shows the page behind the empty neck (alpha ${neck.milky} → ${neck.clear})`)
    const solid = await page.evaluate(() => window.__ex.status.solid())
    check(solid.tinted[3] === 255 && solid.clear[0] > solid.tinted[0] + 20, `clear solid is traced through: its glass tints the light behind it (rgba ${solid.clear.join(', ')} → ${solid.tinted.join(', ')})`)
    await page.screenshot({ path: `${OUT}studio-product.png` })
    const terrain = await page.evaluate(() => window.__ex.status.terrain)
    check(terrain.shadowed > 0.03 && terrain.shadowed < 0.8, `terrain bake casts mountain shadows (${(terrain.shadowed * 100).toFixed(0)}% of samples in shadow, ${terrain.ms} ms)`)
    await page.$eval('#terrain', (el) => el.scrollIntoView({ block: 'center' }))
    await wait(page, 600)
    const detail = await page.evaluate(() => window.__ex.status.terrainDetail())
    check(detail.detailed > detail.flat * 1.3, `noise texture adds rock detail to the terrain (neighbor contrast ${detail.flat.toFixed(2)} → ${detail.detailed.toFixed(2)})`)
    await page.screenshot({ path: `${OUT}studio-terrain.png` })
    // Last: it pauses the page.
    const restore = await page.evaluate(() => window.__ex.status.contextRestore())
    check(restore.rebuilt.wasLost && restore.rebuilt.back, 'layer.lost follows the context: lost, then back')
    check(
      restore.rebuilt.light > restore.before * 0.8 && restore.unrestored.light < restore.before * 0.5,
      `after a lost context, onRestore brings the environment light back (${restore.before} → ${restore.rebuilt.light}; without it ${restore.unrestored.light})`,
    )
  })

  await visit(
    browser,
    'Product · phone address bar',
    '/studio/',
    async (page) => {
      await page.waitForFunction(() => window.__ex.status.warmed === true, null, { timeout: 20000 })
      const size = () =>
        page.evaluate(() => ({
          buffer: [window.__ex.layer.canvas.width, window.__ex.layer.canvas.height],
          height: window.__ex.layer.height,
          distance: window.__ex.layer.camera.position.z,
          resizes: window.__ex.status.resizes ?? 0,
        }))
      // Software rendering is slow: wait for frames to pass rather than for time.
      const frames = async (n) => {
        const f0 = await page.evaluate(() => window.__ex.stage.ticker.current.frame)
        await page.waitForFunction((f) => window.__ex.stage.ticker.current.frame >= f, f0 + n, { timeout: 60000 })
      }
      const before = await size()
      // The address bar slides in: the window loses 80 px of height, nothing else.
      await page.setViewportSize({ width: 390, height: 764 })
      await frames(3)
      const bar = await size()
      check(
        bar.resizes === before.resizes && bar.buffer.join() === before.buffer.join() && bar.distance === before.distance,
        `a toolbar sliding in leaves the canvas alone (buffer ${before.buffer.join('×')}, camera ${before.distance.toFixed(0)}, ${bar.resizes - before.resizes} resizes)`,
      )
      // A rotation: width and height change together — one resize.
      await page.setViewportSize({ width: 844, height: 390 })
      await frames(3)
      const turned = await size()
      check(turned.resizes === before.resizes + 1 && turned.buffer[0] > before.buffer[0], `a rotation resizes the canvas once (${turned.resizes - before.resizes}, ${turned.buffer.join('×')})`)
    },
    { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  )

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
