'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { TRACK_LENGTH, getFrameAtDistance } from '@/lib/trackPath'
import { GAPS } from '@/lib/gapJump'

// Deterministic PRNG (mulberry32) so the scenery layout is stable across
// renders — unlike Math.random(), which would reshuffle everything every
// time the component re-renders.
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ROAD_CLEAR_X = 6 // keep this clear of the road on both sides
const FIELD_X = 46 // how far out scenery extends
const FIELD_S_MIN = 0
const FIELD_S_MAX = TRACK_LENGTH + 15

// Ramps (see Ramps.tsx) occupy roughly lateral offset in [3,37] (mirrored —
// the largest, scale=1.4 ramp reaches ROAD_EDGE + RAMP_RUN*1.4 + PLAT_D*1.4 =
// 4+19.6+12.6=36.2) around these arc-length distances
const RAMP_S = [22, 55, 75, 335]

function nearRamp(lateral: number, s: number) {
  const al = Math.abs(lateral)
  if (al < 3 || al > 37) return false
  return RAMP_S.some((rs) => Math.abs(s - rs) < 6)
}

type Placement = { x: number; z: number; scale: number; rotY: number; hasArm: boolean; armSide: number }

function useField(count: number, seed: number): Placement[] {
  return useMemo(() => {
    const rand = mulberry32(seed)
    const items: Placement[] = []
    let guard = 0
    while (items.length < count && guard < count * 8) {
      guard++
      const side = rand() < 0.5 ? -1 : 1
      const lateral = side * (ROAD_CLEAR_X + rand() * (FIELD_X - ROAD_CLEAR_X))
      const s = THREE.MathUtils.clamp(
        FIELD_S_MIN + rand() * (FIELD_S_MAX - FIELD_S_MIN),
        0,
        TRACK_LENGTH,
      )
      if (nearRamp(lateral, s)) continue
      // Every mandatory gap-jump's void spans the full lateral width there
      // (see Ground.tsx) — skip those bands regardless of offset, or items
      // on the far side would render floating over open air.
      if (GAPS.some((gap) => s >= gap.baseDistance - 4 && s <= gap.downRampEnd + 4)) continue
      const { position, right } = getFrameAtDistance(s)
      const worldPos = position.clone().addScaledVector(right, lateral)
      items.push({
        x: worldPos.x,
        z: worldPos.z,
        scale: 0.7 + rand() * 0.9,
        rotY: rand() * Math.PI * 2,
        hasArm: rand() < 0.35,
        armSide: rand() < 0.5 ? -1 : 1,
      })
    }
    return items
  }, [count, seed])
}

function Cactus({ x, z, scale, rotY, hasArm, armSide }: Placement) {
  const height = 2 + scale
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]} scale={scale}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.24, 0.3, height, 8]} />
        <meshStandardMaterial color="#3f6b45" roughness={1} />
      </mesh>
      <mesh position={[0, height + 0.15, 0]} castShadow>
        <sphereGeometry args={[0.24, 8, 8]} />
        <meshStandardMaterial color="#3f6b45" roughness={1} />
      </mesh>
      {hasArm && (
        <mesh position={[armSide * 0.32, height * 0.55, 0]} rotation={[0, 0, armSide * 0.9]} castShadow>
          <cylinderGeometry args={[0.13, 0.16, 1.1, 6]} />
          <meshStandardMaterial color="#3f6b45" roughness={1} />
        </mesh>
      )}
    </group>
  )
}

function Rock({ x, z, scale, rotY }: Placement) {
  return (
    <mesh
      position={[x, 0.15 * scale, z]}
      rotation={[0.3, rotY, 0.1]}
      scale={[scale, scale * 0.6, scale]}
      castShadow
      receiveShadow
    >
      <icosahedronGeometry args={[0.5, 0]} />
      <meshStandardMaterial color="#6b5b4a" roughness={1} flatShading />
    </mesh>
  )
}

// Weathered desert tree — gnarled trunk + a couple of sparse canopy clumps,
// taller and more varied in silhouette than the cacti for a denser, more
// layered horizon.
function Tree({ x, z, scale, rotY }: Placement) {
  const trunkH = 2.6 + scale
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]} scale={scale}>
      <mesh position={[0, trunkH / 2, 0]} rotation={[0, 0, 0.08]} castShadow receiveShadow>
        <cylinderGeometry args={[0.1, 0.2, trunkH, 6]} />
        <meshStandardMaterial color="#4a3626" roughness={1} />
      </mesh>
      <mesh position={[0.15, trunkH * 0.62, 0.05]} rotation={[0, 0, -0.6]} castShadow>
        <cylinderGeometry args={[0.06, 0.1, trunkH * 0.5, 6]} />
        <meshStandardMaterial color="#4a3626" roughness={1} />
      </mesh>
      <mesh position={[0, trunkH + 0.35, 0]} castShadow>
        <icosahedronGeometry args={[0.75, 0]} />
        <meshStandardMaterial color="#5c7a3f" roughness={1} flatShading />
      </mesh>
      <mesh position={[0.45, trunkH + 0.05, 0.15]} castShadow>
        <icosahedronGeometry args={[0.45, 0]} />
        <meshStandardMaterial color="#527038" roughness={1} flatShading />
      </mesh>
    </group>
  )
}

export default function Scenery() {
  const cacti = useField(70, 1001)
  const rocks = useField(90, 2002)
  const trees = useField(40, 3003)

  return (
    <group>
      {cacti.map((c, i) => (
        <Cactus key={i} {...c} />
      ))}
      {rocks.map((r, i) => (
        <Rock key={i} {...r} />
      ))}
      {trees.map((t, i) => (
        <Tree key={i} {...t} />
      ))}
    </group>
  )
}
