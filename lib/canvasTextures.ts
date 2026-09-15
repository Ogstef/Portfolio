import * as THREE from 'three'
import type { Project } from '@/data/projects'

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
