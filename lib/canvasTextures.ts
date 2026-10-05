import * as THREE from 'three'
import type { Project } from '@/data/projects'
import { mulberry32 } from './random'

// Procedurally-drawn textures — no external image/network dependency, so the
// site stays fully self-contained (no third-party CDN that could go down).

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

const THUMB_W = 512
const THUMB_H = 288

// Generates a stylized "screenshot" for a project's billboard — a fake
// browser window with the project's accent color, a wireframe content mock,
// and its stack as pills. Stands in for a real screenshot without needing
// one on disk for every project.
export function createProjectThumbnail(project: Project): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = THUMB_W
  canvas.height = THUMB_H
  const ctx = canvas.getContext('2d')!
  const { r, g, b } = hexToRgb(project.accent)
  const accent = `rgb(${r}, ${g}, ${b})`
  const accentSoft = `rgba(${r}, ${g}, ${b}, 0.3)`

  const bg = ctx.createLinearGradient(0, 0, THUMB_W, THUMB_H)
  bg.addColorStop(0, '#0b0b18')
  bg.addColorStop(1, '#171732')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, THUMB_W, THUMB_H)

  const glow = ctx.createRadialGradient(THUMB_W * 0.82, THUMB_H * 0.18, 0, THUMB_W * 0.82, THUMB_H * 0.18, THUMB_W * 0.6)
  glow.addColorStop(0, accentSoft)
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, THUMB_W, THUMB_H)

  // Browser chrome bar
  const chromeH = 30
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fillRect(0, 0, THUMB_W, chromeH);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.beginPath()
    ctx.fillStyle = c
    ctx.arc(17 + i * 18, chromeH / 2, 5, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  roundRect(ctx, 92, 7, THUMB_W - 112, 16, 8)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '11px monospace'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${project.id}.dev`, 104, chromeH / 2 + 1)

  // Giant watermark initial, low opacity
  ctx.save()
  ctx.globalAlpha = 0.09
  ctx.fillStyle = '#ffffff'
  ctx.font = '900 230px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(project.title[0]!, THUMB_W * 0.8, THUMB_H * 0.66)
  ctx.restore()

  // Wireframe content mock
  const barX = 34
  let barY = 68
  const bars = [
    { w: 200, h: 11, accent: true },
    { w: 150, h: 7, accent: false },
    { w: 230, h: 7, accent: false },
    { w: 110, h: 7, accent: false },
    { w: 180, h: 7, accent: false },
  ]
  for (const bar of bars) {
    ctx.fillStyle = bar.accent ? accent : 'rgba(255,255,255,0.16)'
    roundRect(ctx, barX, barY, bar.w, bar.h, bar.h / 2)
    ctx.fill()
    barY += bar.h + 12
  }

  // Stack pills
  let pillX = barX
  const pillY = THUMB_H - 38
  ctx.font = '12px system-ui, sans-serif'
  for (const s of project.stack.slice(0, 3)) {
    const w = ctx.measureText(s).width + 22
    ctx.strokeStyle = accent
    ctx.lineWidth = 1.5
    roundRect(ctx, pillX, pillY, w, 24, 12)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.textBaseline = 'middle'
    ctx.fillText(s, pillX + 11, pillY + 13)
    pillX += w + 8
    if (pillX > THUMB_W - 60) break
  }

  ctx.strokeStyle = accentSoft
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, THUMB_W - 2, THUMB_H - 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

let cloudPuffTexture: THREE.CanvasTexture | null = null

// Soft radial-gradient blob used to build drifting sky clouds out of a few
// overlapping billboard sprites — same "draw it, don't fetch it" approach.
export function getCloudPuffTexture(): THREE.CanvasTexture {
  if (cloudPuffTexture) return cloudPuffTexture

  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grd.addColorStop(0, 'rgba(255,255,255,0.95)')
  grd.addColorStop(0.4, 'rgba(255,255,255,0.55)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, size, size)

  cloudPuffTexture = new THREE.CanvasTexture(canvas)
  cloudPuffTexture.colorSpace = THREE.SRGBColorSpace
  cloudPuffTexture.needsUpdate = true
  return cloudPuffTexture
}

// Tileable value noise: a random lattice with `period` cells per side whose
// indices wrap, so the result tiles seamlessly under RepeatWrapping. Several
// periods are summed (octaves) with halving weights, normalised to [0,1].
function tileableNoise(size: number, periods: number[], rand: () => number): Float32Array {
  const out = new Float32Array(size * size)
  let weight = 1
  let totalWeight = 0
  for (const period of periods) {
    const lattice = Array.from({ length: period * period }, rand)
    const cell = size / period
    for (let y = 0; y < size; y++) {
      const gy = y / cell
      const y0 = Math.floor(gy)
      const ty = gy - y0
      const sy = ty * ty * (3 - 2 * ty)
      const r0 = (y0 % period) * period
      const r1 = ((y0 + 1) % period) * period
      for (let x = 0; x < size; x++) {
        const gx = x / cell
        const x0 = Math.floor(gx)
        const tx = gx - x0
        const sx = tx * tx * (3 - 2 * tx)
        const c0 = x0 % period
        const c1 = (x0 + 1) % period
        const top = lattice[r0 + c0] + (lattice[r0 + c1] - lattice[r0 + c0]) * sx
        const bot = lattice[r1 + c0] + (lattice[r1 + c1] - lattice[r1 + c0]) * sx
        out[y * size + x] += (top + (bot - top) * sy) * weight
      }
    }
    totalWeight += weight
    weight *= 0.5
  }
  for (let i = 0; i < out.length; i++) out[i] /= totalWeight
  return out
}

// Piecewise-linear lookup through a list of RGB stops for t in [0,1].
function rampColor(stops: Array<[number, number, number]>, t: number): [number, number, number] {
  const f = THREE.MathUtils.clamp(t, 0, 1) * (stops.length - 1)
  const i = Math.min(Math.floor(f), stops.length - 2)
  const k = f - i
  const a = stops[i]
  const b = stops[i + 1]
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
}

// Contrast-stretch noise around 0.5 — summed octaves cluster near the
// middle, which would otherwise wash every tone ramp out to its centre.
function stretch(n: number, amount: number) {
  return 0.5 + (n - 0.5) * amount
}

function finishTiledTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

let groundTexture: THREE.CanvasTexture | null = null

// Desert dirt: layered value noise across four sand/dirt tones plus pebble
// specks. Tones straddle the old flat #5a3e28 so the mip-mapped average (all
// you see near the fog line) still matches the fog tint it was tuned with.
export function getGroundTexture(): THREE.CanvasTexture {
  if (groundTexture) return groundTexture

  const size = 512
  const rand = mulberry32(5150)
  const macro = tileableNoise(size, [4, 8, 16], rand)
  const grain = tileableNoise(size, [64, 128], rand)
  const tones: Array<[number, number, number]> = [
    [72, 48, 30],
    [86, 59, 38],
    [98, 69, 45],
    [112, 82, 55],
  ]

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(size, size)
  for (let i = 0; i < size * size; i++) {
    const [r, g, b] = rampColor(tones, stretch(macro[i], 2.2))
    const d = (grain[i] - 0.5) * 22
    img.data[i * 4] = r + d
    img.data[i * 4 + 1] = g + d * 0.85
    img.data[i * 4 + 2] = b + d * 0.7
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)

  // Pebbles — drawn at x/y ±size too so ones straddling an edge wrap.
  for (let i = 0; i < 420; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = 0.6 + rand() * 1.8
    const light = rand() < 0.6
    ctx.fillStyle = light
      ? `rgba(150,120,90,${0.35 + rand() * 0.4})`
      : `rgba(40,26,16,${0.35 + rand() * 0.4})`
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        ctx.beginPath()
        ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  groundTexture = finishTiledTexture(canvas)
  return groundTexture
}

let asphaltTexture: THREE.CanvasTexture | null = null

// Worn asphalt: dark grey noise, pale aggregate flecks, two faint darker
// wheel-wear bands per lane and a few hairline cracks. U runs across the
// road (one tile = the full width), V along it.
export function getAsphaltTexture(): THREE.CanvasTexture {
  if (asphaltTexture) return asphaltTexture

  const size = 512
  const rand = mulberry32(9090)
  const macro = tileableNoise(size, [4, 8], rand)
  const grain = tileableNoise(size, [128, 256], rand)

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(size, size)
  // Wheel tracks sit ~1/8 and ~3/8 across each half of the road.
  const bands = [0.14, 0.36, 0.64, 0.86]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const u = x / size
      const wear = bands.reduce((acc, c) => acc + Math.exp(-(((u - c) / 0.035) ** 2)), 0)
      const base = 30 + stretch(macro[i], 1.8) * 10 - wear * 5
      const n = (grain[i] - 0.5) * 16
      img.data[i * 4] = base + n
      img.data[i * 4 + 1] = base + n
      img.data[i * 4 + 2] = base + n + 5
      img.data[i * 4 + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(150,150,160,${0.12 + rand() * 0.2})`
    ctx.fillRect(rand() * size, rand() * size, 1 + rand(), 1 + rand())
  }

  // Cracks: jittery polylines, drawn at y±size so they wrap along the road.
  ctx.lineCap = 'round'
  for (let c = 0; c < 5; c++) {
    const pts: Array<[number, number]> = []
    let x = 60 + rand() * (size - 120)
    let y = rand() * size
    const heading = rand() * Math.PI * 2
    const len = 8 + Math.floor(rand() * 10)
    for (let k = 0; k < len; k++) {
      pts.push([x, y])
      const a = heading + (rand() - 0.5) * 1.4
      x += Math.cos(a) * 10
      y += Math.sin(a) * 10
    }
    ctx.strokeStyle = `rgba(8,8,12,${0.5 + rand() * 0.3})`
    ctx.lineWidth = 0.8 + rand() * 1.2
    for (const oy of [-size, 0, size]) {
      ctx.beginPath()
      pts.forEach(([px, py], k) => (k === 0 ? ctx.moveTo(px, py + oy) : ctx.lineTo(px, py + oy)))
      ctx.stroke()
    }
  }

  asphaltTexture = finishTiledTexture(canvas)
  return asphaltTexture
}

let blotchTexture: THREE.CanvasTexture | null = null

// Soft irregular blob (alpha only, white) for large dirt colour patches —
// a radial falloff whose edge is broken up by noise so no two instances
// read as a perfect circle once rotated/stretched.
export function getBlotchTexture(): THREE.CanvasTexture {
  if (blotchTexture) return blotchTexture

  const size = 256
  const rand = mulberry32(3131)
  const noise = tileableNoise(size, [6, 12, 24], rand)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const d = Math.hypot(x / size - 0.5, y / size - 0.5) * 2
      const edge = 0.55 + (noise[i] - 0.5) * 0.7
      const a = THREE.MathUtils.clamp((edge - d) / 0.35, 0, 1)
      img.data[i * 4] = 255
      img.data[i * 4 + 1] = 255
      img.data[i * 4 + 2] = 255
      img.data[i * 4 + 3] = a * a * 255
    }
  }
  ctx.putImageData(img, 0, 0)

  blotchTexture = new THREE.CanvasTexture(canvas)
  blotchTexture.colorSpace = THREE.SRGBColorSpace
  blotchTexture.needsUpdate = true
  return blotchTexture
}

let plankTexture: THREE.CanvasTexture | null = null

// Weathered wood planks for the ramps: boards run along U (stacked in V),
// each with its own tint, grain streaks, a staggered butt joint and nails.
// Tiles seamlessly — joints and nails are drawn inside each board.
export function getPlankTexture(): THREE.CanvasTexture {
  if (plankTexture) return plankTexture

  const size = 256
  const boards = 6
  const boardH = size / boards
  const rand = mulberry32(7171)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  for (let b = 0; b < boards; b++) {
    const y = b * boardH
    const tint = (rand() - 0.5) * 26
    ctx.fillStyle = `rgb(${138 + tint},${106 + tint * 0.85},${66 + tint * 0.6})`
    ctx.fillRect(0, y, size, boardH)

    for (let g = 0; g < 14; g++) {
      ctx.strokeStyle = `rgba(70,45,22,${0.12 + rand() * 0.18})`
      ctx.lineWidth = 0.6 + rand() * 1.1
      const gy = y + 3 + rand() * (boardH - 6)
      ctx.beginPath()
      ctx.moveTo(0, gy)
      ctx.bezierCurveTo(size * 0.33, gy + (rand() - 0.5) * 4, size * 0.66, gy + (rand() - 0.5) * 4, size, gy)
      ctx.stroke()
    }

    const joint = 20 + rand() * (size - 40)
    ctx.fillStyle = 'rgba(40,26,12,0.85)'
    ctx.fillRect(joint, y, 2, boardH)
    ctx.fillStyle = 'rgba(30,24,20,0.9)'
    for (const nx of [joint - 6, joint + 8]) {
      for (const ny of [y + boardH * 0.28, y + boardH * 0.72]) {
        ctx.beginPath()
        ctx.arc(nx, ny, 1.4, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    ctx.fillStyle = 'rgba(38,24,12,0.95)'
    ctx.fillRect(0, y, size, 2)
  }

  plankTexture = finishTiledTexture(canvas)
  return plankTexture
}

function diamondPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(cx, cy - r)
  ctx.lineTo(cx + r, cy)
  ctx.lineTo(cx, cy + r)
  ctx.lineTo(cx - r, cy)
  ctx.closePath()
}

const jumpSignTextures = new Map<string, THREE.CanvasTexture>()

// Yellow diamond "JUMP AHEAD" warning sign with a ramp-and-arc pictogram,
// plus a distance plate underneath. Transparent outside the shapes — use
// with alphaTest.
export function getJumpSignTexture(distanceLabel: string): THREE.CanvasTexture {
  const cached = jumpSignTextures.get(distanceLabel)
  if (cached) return cached

  const W = 256
  const H = 340
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const cx = W / 2
  const cy = 124
  const r = 120

  diamondPath(ctx, cx, cy, r)
  ctx.fillStyle = '#111'
  ctx.fill()
  diamondPath(ctx, cx, cy, r - 9)
  ctx.fillStyle = '#f5c518'
  ctx.fill()
  diamondPath(ctx, cx, cy, r - 15)
  ctx.strokeStyle = '#111'
  ctx.lineWidth = 3
  ctx.stroke()

  // Pictogram: wedge ramp, dashed flight arc, landing block.
  ctx.fillStyle = '#111'
  ctx.beginPath()
  ctx.moveTo(cx - 62, cy + 2)
  ctx.lineTo(cx - 22, cy + 2)
  ctx.lineTo(cx - 22, cy - 18)
  ctx.closePath()
  ctx.fill()
  ctx.fillRect(cx + 26, cy - 18, 36, 20)
  ctx.setLineDash([7, 6])
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(cx - 22, cy - 22)
  ctx.quadraticCurveTo(cx + 2, cy - 64, cx + 30, cy - 24)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '900 30px system-ui, sans-serif'
  ctx.fillText('JUMP', cx, cy + 32)
  ctx.font = '900 22px system-ui, sans-serif'
  ctx.fillText('AHEAD', cx, cy + 60)

  // Distance plate
  roundRect(ctx, cx - 70, 262, 140, 66, 8)
  ctx.fillStyle = '#111'
  ctx.fill()
  roundRect(ctx, cx - 64, 268, 128, 54, 5)
  ctx.fillStyle = '#f5c518'
  ctx.fill()
  ctx.fillStyle = '#111'
  ctx.font = '900 34px system-ui, sans-serif'
  ctx.fillText(distanceLabel, cx, 296)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true
  jumpSignTextures.set(distanceLabel, texture)
  return texture
}

const chevronTextures = new Map<string, THREE.CanvasTexture>()

// Black board with three yellow chevrons pointing `dir` — hazard markers
// either side of a gap-jump ramp, pointing in towards it.
export function getChevronTexture(dir: 'left' | 'right'): THREE.CanvasTexture {
  const cached = chevronTextures.get(dir)
  if (cached) return cached

  const W = 256
  const H = 160
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#141414'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#f5c518'
  ctx.lineWidth = 6
  ctx.strokeRect(5, 5, W - 10, H - 10)

  ctx.fillStyle = '#f5c518'
  const s = dir === 'left' ? -1 : 1
  for (let i = 0; i < 3; i++) {
    const x = W / 2 + (i - 1) * 64
    ctx.beginPath()
    ctx.moveTo(x - s * 26, 26)
    ctx.lineTo(x - s * 6, 26)
    ctx.lineTo(x + s * 26, H / 2)
    ctx.lineTo(x - s * 6, H - 26)
    ctx.lineTo(x - s * 26, H - 26)
    ctx.lineTo(x + s * 6, H / 2)
    ctx.closePath()
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true
  chevronTextures.set(dir, texture)
  return texture
}

const neonTextures = new Map<string, THREE.CanvasTexture>()

// Neon tube lettering on a dark backing board, with a soft glow baked in.
// Use as both map and emissiveMap so flickering emissiveIntensity reads as
// the tubes buzzing.
export function getNeonTexture(text: string, color: string): THREE.CanvasTexture {
  const key = `${text}|${color}`
  const cached = neonTextures.get(key)
  if (cached) return cached

  const W = 256
  const H = 112
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  roundRect(ctx, 2, 2, W - 4, H - 4, 14)
  ctx.fillStyle = '#120d14'
  ctx.fill()
  ctx.strokeStyle = '#2c2430'
  ctx.lineWidth = 4
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'italic 800 64px "Brush Script MT", "Segoe Script", cursive, system-ui'
  ctx.shadowColor = color
  ctx.shadowBlur = 18
  ctx.lineWidth = 7
  ctx.strokeStyle = color
  ctx.strokeText(text, W / 2, H / 2 + 2)
  ctx.shadowBlur = 0
  ctx.lineWidth = 2.5
  ctx.strokeStyle = '#fff4f8'
  ctx.strokeText(text, W / 2, H / 2 + 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true
  neonTextures.set(key, texture)
  return texture
}

const panelTextures = new Map<string, THREE.CanvasTexture>()

// Flat corporate signage panel: solid background with bold centred text.
export function getPanelTexture(text: string, bg: string, fg: string): THREE.CanvasTexture {
  const key = `${text}|${bg}|${fg}`
  const cached = panelTextures.get(key)
  if (cached) return cached

  const W = 512
  const H = 96
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '800 52px system-ui, sans-serif'
  ctx.fillText(text, W / 2, H / 2 + 2, W - 40)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true
  panelTextures.set(key, texture)
  return texture
}

// Greedy word-wrap for canvas text; returns the lines that fit `maxWidth`.
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

let finaleTexture: THREE.CanvasTexture | null = null

// End-of-road sign: the project billboards' visual language (dark card,
// accent rim) at roadside-sign scale. Drawn to canvas rather than drei
// <Text>, whose default font is fetched from a CDN.
export function getFinaleSignTexture(title: string, body: string, accent: string): THREE.CanvasTexture {
  if (finaleTexture) return finaleTexture

  const W = 2048
  const H = 632
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const { r, g, b } = hexToRgb(accent)

  ctx.fillStyle = accent
  roundRect(ctx, 0, 0, W, H, 36)
  ctx.fill()
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#12121f')
  bg.addColorStop(1, '#0a0a14')
  ctx.fillStyle = bg
  roundRect(ctx, 14, 14, W - 28, H - 28, 26)
  ctx.fill()
  const glow = ctx.createRadialGradient(W * 0.5, 0, 0, W * 0.5, 0, W * 0.6)
  glow.addColorStop(0, `rgba(${r},${g},${b},0.18)`)
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(14, 14, W - 28, H - 28)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 104px system-ui, sans-serif'
  ctx.fillText(title, W / 2, 150, W - 160)

  ctx.fillStyle = accent
  ctx.fillRect(W / 2 - 160, 232, 320, 8)

  ctx.fillStyle = 'rgba(255,255,255,0.86)'
  ctx.font = '500 62px system-ui, sans-serif'
  const lines = wrapText(ctx, body, W - 260)
  lines.forEach((line, i) => ctx.fillText(line, W / 2, 330 + i * 84))

  finaleTexture = new THREE.CanvasTexture(canvas)
  finaleTexture.colorSpace = THREE.SRGBColorSpace
  finaleTexture.anisotropy = 8
  finaleTexture.needsUpdate = true
  return finaleTexture
}
