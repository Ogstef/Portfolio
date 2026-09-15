import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'

// Ramp rises from road edge (x=±ROAD_EDGE, y=0) outward to RAMP_TOP_H
const ROAD_EDGE   = 4
const RAMP_TOP_H  = 2.0
const RAMP_RUN    = 9
const RAMP_THICK  = 0.5
const RAMP_WIDTH  = 7
const PLAT_D      = 7
const PLAT_THICK  = 0.4

// Rotation angle so top rises by RAMP_TOP_H over RAMP_RUN
const RAMP_ANGLE  = Math.atan2(RAMP_TOP_H, RAMP_RUN)  // ≈ 0.218 rad

// Box center Y so the low end's top surface sits exactly at y=0 (ground level)
const RAMP_CY     = (RAMP_RUN / 2) * Math.sin(RAMP_ANGLE) - (RAMP_THICK / 2) * Math.cos(RAMP_ANGLE)

// Height of the top-end surface (where platform meets ramp)
const RAMP_TOP_Y  = RAMP_CY + (RAMP_RUN / 2) * Math.sin(RAMP_ANGLE) + (RAMP_THICK / 2) * Math.cos(RAMP_ANGLE)

const mat = new THREE.MeshStandardMaterial({ color: '#7a5a38', roughness: 0.8, metalness: 0.1 })

function RampSet({ z, side }: { z: number; side: 'left' | 'right' }) {
  const s       = side === 'right' ? 1 : -1
  const angle   = s * RAMP_ANGLE   // + lifts +X (right), − lifts −X (left)
  const rampCX  = s * (ROAD_EDGE + RAMP_RUN / 2)
  const platCX  = s * (ROAD_EDGE + RAMP_RUN + PLAT_D / 2)
  const platCY  = RAMP_TOP_Y + PLAT_THICK / 2

  return (
    <group position={[0, 0, z]}>
      {/* Sloped ramp — explicit CuboidCollider so slope is one smooth surface */}
      <RigidBody type="fixed">
        <CuboidCollider
          args={[RAMP_RUN / 2, RAMP_THICK / 2, RAMP_WIDTH / 2]}
          position={[rampCX, RAMP_CY, 0]}
          rotation={[0, 0, angle]}
        />
        <mesh position={[rampCX, RAMP_CY, 0]} rotation={[0, 0, angle]} receiveShadow castShadow material={mat}>
          <boxGeometry args={[RAMP_RUN, RAMP_THICK, RAMP_WIDTH]} />
        </mesh>
      </RigidBody>

      {/* Flat launch platform at the top */}
      <RigidBody type="fixed">
        <CuboidCollider args={[PLAT_D / 2, PLAT_THICK / 2, RAMP_WIDTH / 2]} position={[platCX, platCY, 0]} />
        <mesh position={[platCX, platCY, 0]} receiveShadow castShadow material={mat}>
          <boxGeometry args={[PLAT_D, PLAT_THICK, RAMP_WIDTH]} />
        </mesh>
      </RigidBody>
    </group>
  )
}

export default function Ramps() {
  return (
    <>
      <RampSet z={22}  side="right" />
      <RampSet z={55}  side="left"  />
      <RampSet z={105} side="right" />
    </>
  )
}
