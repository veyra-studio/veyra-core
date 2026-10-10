import { createNoise, createStage, imageSequence, Phase, seededRandom, whenVisible } from '@veyra/core'
import { glslColor, glslMath, glslNoise, glslSdf } from '@veyra/core/glsl'

const stage = createStage({ quality: { dprRange: [1, 2] } })
const status: Record<string, string> = {}

// 1 — A field of lines drifting through fractal noise (Canvas2D).
{
  const canvas = document.getElementById('field') as HTMLCanvasElement
  const ctx = canvas.getContext('2d')!
  const { fbm3 } = createNoise(11)
  const rand = seededRandom(5)
  const points = Array.from({ length: 900 }, () => ({ x: rand(), y: rand(), age: rand() * 200 }))
  let visible = false
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(canvas.clientWidth * dpr)
    canvas.height = Math.round(canvas.clientHeight * dpr)
    ctx.fillStyle = '#111110'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  resize()
  stage.viewport.onLayout(resize)
  whenVisible(canvas, () => {
    visible = true
    return () => (visible = false)
  }, { once: false })
  stage.onFrame(({ time, delta }) => {
    if (!visible) return
    const w = canvas.width
    const h = canvas.height
    ctx.fillStyle = 'rgba(17, 17, 16, 0.06)'
    ctx.fillRect(0, 0, w, h)
    ctx.lineWidth = Math.max(1, w / 900)
    for (const p of points) {
      const angle = fbm3(p.x * 2.2, p.y * 2.2 * (h / w), time * 0.06, { octaves: 3 }) * Math.PI * 2.4
      const step = 0.045 * delta
      const nx = p.x + Math.cos(angle) * step
      const ny = p.y + Math.sin(angle) * step * (w / h)
      ctx.strokeStyle = p.age % 97 < 9 ? '#ff4f1a' : 'rgba(239, 234, 223, 0.55)'
      ctx.beginPath()
      ctx.moveTo(p.x * w, p.y * h)
      ctx.lineTo(nx * w, ny * h)
      ctx.stroke()
      p.x = nx
      p.y = ny
      p.age += 1
      if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1 || p.age > 400) {
        p.x = rand()
        p.y = rand()
        p.age = 0
      }
    }
  }, Phase.render)
}

// 2 — The GLSL chunks compiled into one fragment shader (WebGL2).
{
  const canvas = document.getElementById('shader') as HTMLCanvasElement
  const label = document.getElementById('glsl-status')!
  const gl = canvas.getContext('webgl2', { antialias: false })
  const fail = (message: string) => {
    status.glsl = message
    label.textContent = 'not available'
  }
  if (!gl) fail('no webgl2')
  else {
    const vertex = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`
    const fragment = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform float uTime;
uniform vec2 uSize;
${glslNoise}
${glslSdf}
${glslColor}
${glslMath}
void main() {
  vec2 p = (vUv - 0.5) * vec2(uSize.x / uSize.y, 1.0);
  // Domain-warped noise for the backdrop.
  vec2 q = p * 2.2;
  q += 0.6 * vec2(fbm(vec3(q, uTime * 0.07), 4), fbm(vec3(q + 5.2, uTime * 0.07), 4));
  float n = fbm(q, 5) * 0.5 + 0.5;
  // Three discs melting into each other, wobbling on noise.
  float t = uTime * 0.6;
  float d = sdCircle(p - 0.22 * vec2(cos(t), sin(t * 1.3)), 0.16);
  d = opSmoothUnion(d, sdCircle(p - 0.24 * vec2(cos(t * 0.7 + 2.0), sin(t + 1.0)), 0.13), 0.12);
  d = opSmoothUnion(d, sdRing(rotate2d(t * 0.2) * p, 0.34, 0.012), 0.08);
  d += 0.015 * gnoise(vec3(p * 9.0, uTime * 0.5));
  vec3 paper = srgbToLinear(vec3(0.937, 0.918, 0.875));
  vec3 signal = srgbToLinear(vec3(1.0, 0.31, 0.10));
  vec3 ink = srgbToLinear(vec3(0.067, 0.067, 0.063));
  vec3 back = mixOklab(ink, srgbToLinear(vec3(0.11, 0.25, 0.58)), smootherstep(0.25, 0.85, n));
  vec3 color = mixOklab(back, mixOklab(signal, paper, remapClamped(p.y, -0.4, 0.4, 0.0, 0.6)), fillAA(d, fwidth(d)));
  outColor = vec4(linearToSrgb(color), 1.0);
}`
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'compile error')
      return shader
    }
    try {
      const program = gl.createProgram()!
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex))
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment))
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link error')
      gl.useProgram(program)
      const buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
      const loc = gl.getAttribLocation(program, 'aPos')
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
      const uTime = gl.getUniformLocation(program, 'uTime')
      const uSize = gl.getUniformLocation(program, 'uSize')
      status.glsl = 'ok'
      label.textContent = 'compiled ✓'
      let visible = false
      whenVisible(canvas, () => {
        visible = true
        return () => (visible = false)
      }, { once: false })
      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, stage.quality?.dpr.value ?? 1)
        canvas.width = Math.round(canvas.clientWidth * dpr)
        canvas.height = Math.round(canvas.clientHeight * dpr)
        gl.viewport(0, 0, canvas.width, canvas.height)
      }
      resize()
      stage.viewport.onLayout(resize)
      stage.quality?.dpr.subscribe(resize)
      stage.onFrame(({ time }) => {
        if (!visible) return
        gl.uniform1f(uTime, time)
        gl.uniform2f(uSize, canvas.width, canvas.height)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }, Phase.render)
    } catch (error) {
      fail(String((error as Error).message))
      console.warn('[example] shader failed', error)
    }
  }
}

// 3 — An image sequence scrubbed by scroll. The frames are drawn here and
// handed over as URLs, exactly like files would be.
{
  const label = document.getElementById('seq-status')!
  const count = 72
  const frame = document.createElement('canvas')
  frame.width = 960
  frame.height = 600
  const g = frame.getContext('2d')!
  const urls: string[] = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    g.fillStyle = '#efeadf'
    g.fillRect(0, 0, frame.width, frame.height)
    g.save()
    g.translate(frame.width / 2, frame.height / 2)
    // A ring seen at an angle: an ellipse whose width follows the turn.
    for (let k = 0; k < 28; k++) {
      const t = (k / 28) * Math.PI * 2
      const x = Math.cos(t + a) * 220
      const z = Math.sin(t + a)
      const y = Math.sin(t) * 70 + Math.cos(a) * 20
      g.fillStyle = k % 7 === 0 ? '#ff4f1a' : z > 0 ? '#111110' : '#77736b'
      const r = 16 + z * 8
      g.beginPath()
      g.arc(x, y, Math.max(4, r), 0, Math.PI * 2)
      g.fill()
    }
    g.restore()
    g.fillStyle = '#111110'
    g.font = '600 28px ui-monospace, monospace'
    g.fillText(String(i + 1).padStart(2, '0'), 32, 56)
    urls.push(frame.toDataURL('image/png'))
  }
  label.textContent = 'loading…'
  const sequence = stage.use(
    imageSequence('#turn', {
      count,
      src: (i) => urls[i]!,
      fit: 'contain',
      scene: { trigger: '#seq', start: 'top top', end: 'bottom bottom' },
      onLoad: (n, total) => (label.textContent = n === total ? `${total} frames` : `${n} / ${total}`),
    }),
  )
  Object.assign(window, { __ex: { stage, status, sequence } })
}
