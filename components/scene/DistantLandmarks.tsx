'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { LANDMARKS, trackToWorld } from '@/lib/placement'
import { getCloudPuffTexture } from '@/lib/canvasTextures'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'

// Landmarks that pull the player forward (ENVIRONMENT_PLAN.md Phase 6): an
// old water tower just past the end of the road, and a radio mast far out
// on the right whose blinking red beacon is visible from spawn. Visual only.

const UP = new THREE.Vector3(0, 1, 0)

function strut(a: THREE.Vector3, b: THREE.Vector3, r: number) {
  const dir = new THREE.Vector3().subVectors(b, a)
  const geo = new THREE.CylinderGeometry(r, r, dir.length(), 4)
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()))
  return geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const tidy = (parts: THREE.BufferGeometry[]) =>
  mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => (g.deleteAttribute('uv'), g)))!

// ─── Water tower ──────────────────────────────────────────────────────────

const LEG_H = 10
const TANK_R = 3
const TANK_H = 4.2

const towerFrameGeo = (() => {
  const parts: THREE.BufferGeometry[] = []
  const foot = 3.2
  const top = 2.2
  const corners: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  const at = (h: number, sx: number, sz: number) => {
    const half = THREE.MathUtils.lerp(foot, top, h / LEG_H)
    return v3(sx * half, h, sz * half)
  }
  corners.forEach(([sx, sz]) => parts.push(strut(at(0, sx, sz), at(LEG_H, sx, sz), 0.16)))
  ;[3.3, 6.6].forEach((h, li, levels) => {
    corners.forEach(([sx, sz], ci) => {
      const [nx, nz] = corners[(ci + 1) % 4]
      parts.push(strut(at(h, sx, sz), at(h, nx, nz), 0.06))
      const lower = li === 0 ? 0.4 : levels[li - 1]
      parts.push(strut(at(lower, sx, sz), at(h, nx, nz), 0.04))
    })
  })
  // Catwalk ring + rail under the tank, and a ladder up one leg.
  parts.push(new THREE.CylinderGeometry(TANK_R + 0.7, TANK_R + 0.7, 0.12, 20).translate(0, LEG_H, 0))
  parts.push(new THREE.TorusGeometry(TANK_R + 0.65, 0.04, 4, 32).rotateX(Math.PI / 2).translate(0, LEG_H + 0.9, 0))
  parts.push(strut(v3(foot + 0.3, 0, 0), v3(top + 0.3, LEG_H, 0), 0.05))
  return tidy(parts)
})()

const tankGeo = tidy([
  new THREE.CylinderGeometry(TANK_R, TANK_R, TANK_H, 20).translate(0, LEG_H + 0.1 + TANK_H / 2, 0),
  new THREE.ConeGeometry(TANK_R + 0.25, 1.8, 20).translate(0, LEG_H + 0.1 + TANK_H + 0.9, 0),
  new THREE.SphereGeometry(0.25, 8, 6).translate(0, LEG_H + 0.1 + TANK_H + 1.85, 0),
])

const towerFrameMat = new THREE.MeshStandardMaterial({ color: '#5b5550', roughness: 0.8, metalness: 0.4 })
const tankMat = new THREE.MeshStandardMaterial({ color: '#9a9a92', roughness: 0.55, metalness: 0.5, flatShading: true })

function WaterTower() {
  const { s, lateral } = LANDMARKS.waterTower
  const p = trackToWorld(s, lateral)
  return (
    <group position={p} rotation={[0, 0.4, 0]}>
      <mesh geometry={towerFrameGeo} material={towerFrameMat} castShadow />
      <mesh geometry={tankGeo} material={tankMat} castShadow />
    </group>
  )
}

// ─── Radio mast ───────────────────────────────────────────────────────────

const MAST_H = 60
const MAST_W = 1.4 // triangular lattice side

const mastGeo = (() => {
  const parts: THREE.BufferGeometry[] = []
  const corner = (i: number, h: number) => {
    const taper = THREE.MathUtils.lerp(1, 0.55, h / MAST_H)
    const a = (i / 3) * Math.PI * 2
    return v3(Math.cos(a) * MAST_W * taper, h, Math.sin(a) * MAST_W * taper)
  }
  for (let i = 0; i < 3; i++) parts.push(strut(corner(i, 0), corner(i, MAST_H), 0.12))
  for (let h = 0; h < MAST_H; h += 4) {
    for (let i = 0; i < 3; i++) parts.push(strut(corner(i, h), corner((i + 1) % 3, h + 4), 0.06))
  }
  parts.push(strut(v3(0, MAST_H, 0), v3(0, MAST_H + 6, 0), 0.08)) // whip antenna
  // Guy wires out to three anchors.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5
    parts.push(strut(v3(0, MAST_H * 0.8, 0), v3(Math.cos(a) * 28, 0, Math.sin(a) * 28), 0.03))
  }
  return tidy(parts)
})()

// Far beyond the fog's reach, so it opts out of fog and carries its own
// haze: a dark silhouette pushed part-way to the fog colour.
const mastMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#2a1c1c').lerp(new THREE.Color('#c8601a'), 0.35),
  fog: false,
})

// Constant screen-size glow (sizeAttenuation off), so the beacon reads
// from spawn ~350 m away where a physical bulb would be sub-pixel.
function beaconMaterial() {
  return new THREE.SpriteMaterial({
    map: getCloudPuffTexture(),
    color: '#ff2a1a',
    sizeAttenuation: false,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })
}
const beaconTopMat = beaconMaterial()
const beaconMidMat = beaconMaterial()

function RadioMast() {
  const reduced = usePrefersReducedMotion()
  const top = useRef<THREE.Sprite>(null)
  const mid = useRef<THREE.Sprite>(null)
  const p = trackToWorld(LANDMARKS.radioMast.s, LANDMARKS.radioMast.lateral)

  useFrame(({ clock }) => {
    if (reduced) return
    // Classic aviation-obstruction blink: top on for 0.5 s of every 1.5 s,
    // the mid light offset by half a beat.
    const t = clock.elapsedTime
    const blink = (offset: number) => ((t + offset) % 1.5 < 0.5 ? 1 : 0.08)
    const setOpacity = (s: THREE.Sprite | null, v: number) => {
      if (s) (s.material as THREE.SpriteMaterial).opacity = v
    }
    setOpacity(top.current, blink(0))
    setOpacity(mid.current, blink(0.75))
  })

  return (
    <group position={p}>
      <mesh geometry={mastGeo} material={mastMat} />
      <sprite ref={top} material={beaconTopMat} position={[0, MAST_H + 6.2, 0]} scale={0.035} />
      <sprite ref={mid} material={beaconMidMat} position={[0, MAST_H * 0.5, 0]} scale={0.022} />
    </group>
  )
}

export default function DistantLandmarks() {
  return (
    <>
      <WaterTower />
      <RadioMast />
    </>
  )
}
