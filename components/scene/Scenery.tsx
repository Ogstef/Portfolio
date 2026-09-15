'use client'

import { useMemo } from 'react'

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
const FIELD_X = 42 // how far out scenery extends
const FIELD_Z_MIN = -18
const FIELD_Z_MAX = 190

// Ramps (see Ramps.tsx) occupy roughly x in [3,21] (mirrored) around these z's
const RAMP_ZS = [22, 55, 105]

function nearRamp(x: number, z: number) {
  const ax = Math.abs(x)
  if (ax < 3 || ax > 21) return false
  return RAMP_ZS.some((rz) => Math.abs(z - rz) < 5)
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
      const x = side * (ROAD_CLEAR_X + rand() * (FIELD_X - ROAD_CLEAR_X))
      const z = FIELD_Z_MIN + rand() * (FIELD_Z_MAX - FIELD_Z_MIN)
      if (nearRamp(x, z)) continue
      items.push({
        x,
        z,
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

export default function Scenery() {
  const cacti = useField(55, 1001)
  const rocks = useField(70, 2002)

  return (
    <group>
      {cacti.map((c, i) => (
        <Cactus key={i} {...c} />
      ))}
      {rocks.map((r, i) => (
        <Rock key={i} {...r} />
      ))}
    </group>
  )
}
