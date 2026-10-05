import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useMemo } from 'react'
import { getFrameAtDistance } from '@/lib/trackPath'
import { getPlankMaterial, plankBox } from './plank'

// Ramp rises from road edge (x=±ROAD_EDGE, y=0) outward to RAMP_TOP_H.
// Base size scaled up from the original (2.0, 9) for a longer, higher jump —
// RAMP_TOP_H and RAMP_RUN keep the same ratio, so RAMP_ANGLE (the tuned
// slope) is unchanged regardless of `scale`; only the ramp's length/height
// grow, exactly like the earlier (2.0,9)→(3.1,14) change did.
const ROAD_EDGE      = 4
const RAMP_TOP_H     = 3.1
const RAMP_RUN       = 14
const RAMP_THICK     = 0.5
const RAMP_WIDTH     = 8
const PLAT_D         = 9
const PLAT_THICK     = 0.4

// Rotation angle so top rises by RAMP_TOP_H over RAMP_RUN — independent of
// `scale` since it's a ratio, so every ramp size shares the same proven slope.
const RAMP_ANGLE  = Math.atan2(RAMP_TOP_H, RAMP_RUN)  // ≈ 0.218 rad


function RampSet({ distance, side, scale = 1 }: { distance: number; side: 'left' | 'right'; scale?: number }) {
  const rampRun  = RAMP_RUN * scale
  const rampThick = RAMP_THICK * scale
  const rampWidth = RAMP_WIDTH * scale
  const platD    = PLAT_D * scale
  const platThick = PLAT_THICK * scale

  // Box center Y so the low end's top surface sits exactly at y=0 (ground level)
  const rampCY = (rampRun / 2) * Math.sin(RAMP_ANGLE) - (rampThick / 2) * Math.cos(RAMP_ANGLE)

  const s       = side === 'right' ? 1 : -1
  const angle   = s * RAMP_ANGLE   // + lifts +X (right), − lifts −X (left)
  const rampCX  = s * (ROAD_EDGE + rampRun / 2)

  // Platform position is derived from the ramp's own rotated far-top corner
  // (not "ROAD_EDGE + rampRun", which assumes the tilted box's horizontal
  // footprint is exactly rampRun — it isn't: tilting a box up foreshortens
  // its ground-projected width by run*(1-cos θ), so that assumption left a
  // real ~0.2-0.6 unit gap between ramp and platform depending on scale, a
  // seam a wheel could catch or drop into). Rotating the ramp's local
  // far-top corner (s*rampRun/2, rampThick/2) by `angle` and placing the
  // platform flush against it is exact for any scale.
  const cornerLocalX = s * (rampRun / 2)
  const cornerLocalY = rampThick / 2
  const cornerX = rampCX + cornerLocalX * Math.cos(angle) - cornerLocalY * Math.sin(angle)
  const cornerY = rampCY + cornerLocalX * Math.sin(angle) + cornerLocalY * Math.cos(angle)

  const platCX  = cornerX + s * (platD / 2)
  const platCY  = cornerY + platThick / 2

  const { position, yaw } = getFrameAtDistance(distance)
  const mat = getPlankMaterial()
  // Same box dimensions as the colliders. The car runs up these along local
  // X, so boards lie across it, along Z.
  // Memoised: these meshes sit inside RigidBody, which derives its default
  // colliders from them — a stable geometry keeps those colliders stable.
  const rampGeo = useMemo(() => plankBox(rampRun, rampThick, rampWidth, 'z'), [rampRun, rampThick, rampWidth])
  const platGeo = useMemo(() => plankBox(platD, platThick, rampWidth, 'z'), [platD, platThick, rampWidth])

  return (
    <group position={[position.x, 0, position.z]} rotation={[0, yaw, 0]}>
      {/* Sloped ramp — explicit CuboidCollider so slope is one smooth surface */}
      <RigidBody type="fixed">
        <CuboidCollider
          args={[rampRun / 2, rampThick / 2, rampWidth / 2]}
          position={[rampCX, rampCY, 0]}
          rotation={[0, 0, angle]}
        />
        <mesh position={[rampCX, rampCY, 0]} rotation={[0, 0, angle]} receiveShadow castShadow material={mat} geometry={rampGeo} />
      </RigidBody>

      {/* Flat launch platform at the top */}
      <RigidBody type="fixed">
        <CuboidCollider args={[platD / 2, platThick / 2, rampWidth / 2]} position={[platCX, platCY, 0]} />
        <mesh position={[platCX, platCY, 0]} receiveShadow castShadow material={mat} geometry={platGeo} />
      </RigidBody>
    </group>
  )
}

export default function Ramps() {
  return (
    <>
      <RampSet distance={22}  side="right" />
      <RampSet distance={55}  side="left"  />
      {/* Moved off distance 105 — that's now inside TRIGONO_GAP's span (lib/gapJump.ts) */}
      <RampSet distance={75}  side="right" />
      {/* No ramp between Trigono and the Gumroad gate (distance ~195-260) —
          that stretch is deliberately kept clear as runway to build speed
          back up after Trigono's sign-mode cutscene, per the mandatory jump
          right after it. */}
      {/* A big finale jump on the straight run after the last project */}
      <RampSet distance={335} side="right" scale={1.4} />
    </>
  )
}
