'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { Instances, Instance } from '@react-three/drei'
import { createNoise2D, mulberry32, range } from '@/lib/random'
import { LANDMARKS, trackToWorld } from '@/lib/placement'

// Three rings of distant silhouettes enclosing the play area, for depth
// parallax as you drive (ENVIRONMENT_PLAN.md Phase 6):
//   1. flat-topped mesas      r ≈ 200 — nearest, warmest
//   2. pointed peaks          r ≈ 250 — the original ring
//   3. a tall far ridge       r ≈ 320 — darker dusk silhouette behind
// All of it sits beyond the scene fog's far distance (DriveScene.tsx,
// far=150), where real fog would flatten every layer to the same colour —
// so each layer opts out of fog and bakes its own haze instead (base colour
// pre-blended towards the fog/haze tint). Purely visual, outside Physics.
//
// The track (lib/trackPath.ts) runs roughly z∈[-20,340], x∈[-9,10]; the
// rings are centred on its rough midpoint.

const CENTER: [number, number] = [0, 160]
const FOG = new THREE.Color('#c8601a')
const DUSK_HAZE = new THREE.Color('#7a3c26')

function hazed(hex: string, toward: THREE.Color, amount: number) {
  return '#' + new THREE.Color(hex).lerp(toward, amount).getHexString()
}

type Item = { x: number; z: number; sx: number; sy: number; sz: number; rotY: number; color: string }

const MAST = trackToWorld(LANDMARKS.radioMast.s, LANDMARKS.radioMast.lateral)
const nearMast = (x: number, z: number) => Math.hypot(x - MAST.x, z - MAST.z) < LANDMARKS.radioMast.radius

// `minAbsX`: drop slots closer than this to the track's axis in X. The
// track runs along Z, so a small ring's front/back slots would land on the
// road's ends (spawn, the finale); side-only layers skip them.
function ring(
  count: number,
  radius: number,
  jitter: number,
  seed: number,
  make: (rand: () => number) => Omit<Item, 'x' | 'z' | 'rotY'>,
  minAbsX = 0,
) {
  const rand = mulberry32(seed)
  const items: Item[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * (Math.PI / count)
    const r = radius + (rand() - 0.5) * 2 * jitter
    const item: Item = {
      x: CENTER[0] + Math.cos(angle) * r,
      z: CENTER[1] + Math.sin(angle) * r,
      rotY: rand() * Math.PI * 2,
      ...make(rand),
    }
    if (Math.abs(item.x) >= minAbsX && !nearMast(item.x, item.z)) items.push(item)
  }
  return items
}

// Unit geometries, scaled per instance; colour comes from the instance, so
// materials are white. flatShading keeps the low-poly facets.
const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, fog: false, flatShading: true })
const peakGeo = new THREE.ConeGeometry(1, 1, 5).translate(0, 0.5, 0)
const ridgeGeo = new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0)
// Mesa: a squat 9-sided frustum with a ragged rim, so it reads as eroded
// rock rather than a machined cylinder.
const mesaGeo = (() => {
  const geo = new THREE.CylinderGeometry(0.72, 1, 1, 9, 3).translate(0, 0.5, 0)
  const noise = createNoise2D(8181)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const a = Math.atan2(z, x)
    const k = 1 + (noise(Math.cos(a) * 2 + 5, Math.sin(a) * 2 + y * 3) - 0.5) * 0.35
    pos.setXYZ(i, x * k, y < 0.99 ? y : y - noise(a * 3, 1) * 0.08, z * k)
  }
  geo.computeVertexNormals()
  return geo
})()

function Layer({ geometry, items }: { geometry: THREE.BufferGeometry; items: Item[] }) {
  return (
    <Instances geometry={geometry} material={material} limit={items.length} frustumCulled={false}>
      {items.map((it, i) => (
        <Instance
          key={i}
          position={[it.x, -1, it.z]}
          rotation={[0, it.rotY, 0]}
          scale={[it.sx, it.sy, it.sz]}
          color={it.color}
        />
      ))}
    </Instances>
  )
}

export default function Horizon() {
  const layers = useMemo(
    () => ({
      // Sides only (|x| ≥ 150): clear of the road's ends and of the
      // drivable scenery mesas, which reach ~133 m out (Scenery.tsx).
      mesas: ring(
        40,
        200,
        12,
        9191,
        (rand) => ({
          sx: range(rand, 22, 42),
          sy: range(rand, 12, 26),
          sz: range(rand, 16, 28),
          color: hazed(rand() > 0.5 ? '#7a4630' : '#6a3c2c', FOG, 0.35),
        }),
        150,
      ),
      // Same seed, counts and shape ranges as the original single ring.
      peaks: (() => {
        const rand = mulberry32(7007)
        return Array.from({ length: 52 }, (_, i): Item => {
          const angle = (i / 52) * Math.PI * 2 + (rand() - 0.5) * (Math.PI / 52)
          const radius = 250 + (rand() - 0.5) * 2 * 30
          const height = 26 + rand() * 34
          const radiusXZ = 30 + rand() * 26
          const rotY = rand() * Math.PI * 2
          const dark = rand()
          return {
            x: CENTER[0] + Math.cos(angle) * radius,
            z: CENTER[1] + Math.sin(angle) * radius,
            sx: radiusXZ,
            sy: height,
            sz: radiusXZ * (0.8 + dark * 0.3),
            rotY,
            color: hazed(dark > 0.5 ? '#4a3230' : '#5c4038', FOG, 0.5),
          }
        })
      })(),
      ridge: ring(40, 320, 20, 6262, (rand) => {
        const r = range(rand, 40, 70)
        return { sx: r, sy: range(rand, 45, 80), sz: r * range(rand, 0.7, 1), color: hazed('#3e2a34', DUSK_HAZE, 0.45) }
      }),
    }),
    [],
  )

  return (
    <group>
      <Layer geometry={ridgeGeo} items={layers.ridge} />
      <Layer geometry={peakGeo} items={layers.peaks} />
      <Layer geometry={mesaGeo} items={layers.mesas} />
    </group>
  )
}
