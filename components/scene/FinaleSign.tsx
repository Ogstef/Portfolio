'use client'

import { Suspense, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { TRACK_LENGTH, getFrameAtDistance } from '@/lib/trackPath'
import { LANDMARKS, trackToWorld } from '@/lib/placement'
import { getFinaleSignTexture } from '@/lib/canvasTextures'
import { ENV_ASSETS, ENV_USE_DRACO } from '@/lib/envAssets'
import { GltfInstances, placeMatrix } from './StaticInstances'

// End-of-road finale (ENVIRONMENT_PLAN.md Phase 6): an arch over the last
// stretch of road carrying a sign in the billboards' visual language, two
// lamp posts, and a line of cones where the asphalt ends. Pure scenery — no
// trigger, no cutscene, no colliders; you read it while driving through.

const ACCENT = '#fbbf24'
const TITLE = 'End of the road — but not of the map.'
const BODY =
  'Feel free to drive around and play as long as you like. Explore… there’s an easter egg hidden out there somewhere.'

const ARCH_HALF = 6.6 // posts stand just outside the reflector posts (±5.2)
const ARCH_H = 7.8
const CARD_W = 11
const CARD_H = CARD_W * (632 / 2048) // matches getFinaleSignTexture's canvas
const CARD_Y = 5.75

// Built in the arch's local frame: X across the road, +Z = direction of
// travel, so the card faces -Z towards the approaching car.
const steelGeo = mergeGeometries([
  ...[-1, 1].map((k) => new THREE.BoxGeometry(0.35, ARCH_H, 0.35).translate(k * ARCH_HALF, ARCH_H / 2, 0)),
  new THREE.BoxGeometry(ARCH_HALF * 2 + 0.5, 0.32, 0.32).translate(0, ARCH_H, 0),
  ...[-1, 1].map((k) => new THREE.BoxGeometry(0.1, ARCH_H - CARD_Y - CARD_H / 2, 0.1).translate(k * 4, (ARCH_H + CARD_Y + CARD_H / 2) / 2, 0.08)), // hangers
  new THREE.BoxGeometry(CARD_W + 0.3, CARD_H + 0.3, 0.12).translate(0, CARD_Y, 0.1), // card backing
])!
const rimGeo = (() => {
  const t = 0.09
  const w = CARD_W + 0.3
  const h = CARD_H + 0.3
  return mergeGeometries([
    new THREE.BoxGeometry(w, t, 0.05).translate(0, CARD_Y + h / 2, 0.02),
    new THREE.BoxGeometry(w, t, 0.05).translate(0, CARD_Y - h / 2, 0.02),
    new THREE.BoxGeometry(t, h, 0.05).translate(-w / 2, CARD_Y, 0.02),
    new THREE.BoxGeometry(t, h, 0.05).translate(w / 2, CARD_Y, 0.02),
  ])!
})()
const cardGeo = new THREE.PlaneGeometry(CARD_W, CARD_H).rotateY(Math.PI).translate(0, CARD_Y, 0.03)

// Lamp posts flanking the arch, a little before it, arms reaching over the road.
const LAMP_X = 8.4
const LAMP_Z = -1.6
const LAMP_H = 5.8
const lampPostGeo = mergeGeometries(
  [-1, 1].flatMap((k) => [
    new THREE.CylinderGeometry(0.08, 0.12, LAMP_H, 8).translate(k * LAMP_X, LAMP_H / 2, LAMP_Z),
    new THREE.BoxGeometry(1.3, 0.08, 0.08).translate(k * (LAMP_X - 0.6), LAMP_H, LAMP_Z),
    new THREE.BoxGeometry(0.55, 0.16, 0.32).translate(k * (LAMP_X - 1.25), LAMP_H - 0.05, LAMP_Z),
  ]).map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => (g.deleteAttribute('uv'), g)),
)!
const bulbGeo = mergeGeometries(
  [-1, 1].map((k) => new THREE.SphereGeometry(0.15, 10, 6).scale(1.4, 0.6, 1).translate(k * (LAMP_X - 1.25), LAMP_H - 0.17, LAMP_Z)),
)!

const steelMat = new THREE.MeshStandardMaterial({ color: '#2e3036', roughness: 0.45, metalness: 0.7 })
const rimMat = new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 1.8 })
const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff1c9', emissive: '#ffd27a', emissiveIntensity: 3 })

const CONE_SPACING = 1.05

function EndCones() {
  const { scene } = useGLTF(ENV_ASSETS.props, ENV_USE_DRACO)
  const cone = useMemo(() => scene.children.find((o) => o.name === 'cone')!, [scene])
  const matrices = useMemo(() => {
    const out: THREE.Matrix4[] = []
    for (let lateral = -4.2; lateral <= 4.21; lateral += CONE_SPACING) {
      const p = trackToWorld(TRACK_LENGTH + 0.6, lateral)
      out.push(placeMatrix(p.x, 0, p.z, lateral * 2.3, 1.3))
    }
    return out
  }, [])
  return <GltfInstances node={cone} matrices={matrices} castShadow />
}

export default function FinaleSign() {
  const { s } = LANDMARKS.finale
  const { position, yaw } = getFrameAtDistance(s)
  const cardMat = useMemo(() => {
    const map = getFinaleSignTexture(TITLE, BODY, ACCENT)
    // Self-lit a little so it reads at dusk and through the fog.
    return new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.6 })
  }, [])

  return (
    <>
      <group position={[position.x, 0, position.z]} rotation={[0, yaw, 0]}>
        <mesh geometry={steelGeo} material={steelMat} castShadow />
        <mesh geometry={cardGeo} material={cardMat} />
        <mesh geometry={rimGeo} material={rimMat} />
        <mesh geometry={lampPostGeo} material={steelMat} castShadow />
        <mesh geometry={bulbGeo} material={bulbMat} />
      </group>
      <Suspense fallback={null}>
        <EndCones />
      </Suspense>
    </>
  )
}
