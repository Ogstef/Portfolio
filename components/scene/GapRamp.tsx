import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useMemo } from 'react'
import { getFrameAtDistance } from '@/lib/trackPath'
import type { GapJump } from '@/lib/gapJump'
import { getPlankMaterial, plankBox } from './plank'

// Rotating a box tilts it — its ground-projected footprint along the
// rotation axis shrinks from `run` to run*cosθ, foreshortened further by its
// own thickness. Placing the next piece at a Z offset of exactly `run` (as
// an earlier version of this component did) left a real, scale-dependent
// gap at every ramp/platform seam — small (~0.1-0.2 units) but exactly the
// kind of seam a wheel can catch or drop into mid-jump. This rotates the
// ramp box's own top-face corner to find where it actually lands, and
// places the next piece flush against that — exact for any run/thick/angle.
function rotateX(theta: number, localY: number, localZ: number) {
  return {
    y: localY * Math.cos(theta) - localZ * Math.sin(theta),
    z: localY * Math.sin(theta) + localZ * Math.cos(theta),
  }
}

// A mandatory canyon jump — see lib/gapJump.ts for why the numbers are what
// they are. Everything here is in the group's local frame, where local
// z = gap.baseDistance + (arc-length distance along the track).
export default function GapRamp({ gap }: { gap: GapJump }) {
  const { position, yaw } = getFrameAtDistance(gap.baseDistance)
  const mat = getPlankMaterial()
  // Same box dimensions as the colliders — the car drives along local Z,
  // so boards lie across it, along X.
  const rampGeo = useMemo(() => plankBox(gap.roadWidth, gap.thick, gap.run, 'x'), [gap])
  const platGeo = useMemo(() => plankBox(gap.roadWidth, gap.platThick, gap.platD, 'x'), [gap])

  // Up-ramp: rotation -angle. Shift its box so the near (road-side) top-face
  // corner lands exactly at local z=0, flush with where Road.tsx's ribbon ends.
  const upNear = rotateX(-gap.angle, gap.thick / 2, -gap.run / 2)
  const upShift = -(gap.run / 2 + upNear.z)
  const upCenterZ = gap.run / 2 + upShift
  const upFar = rotateX(-gap.angle, gap.thick / 2, gap.run / 2)
  const upFarZ = gap.run / 2 + upFar.z + upShift
  const upFarY = gap.cy + upFar.y

  // Launch platform sits flush against the up-ramp's actual far corner.
  const launchPlatCenterZ = upFarZ + gap.platD / 2
  const launchPlatFarZ = upFarZ + gap.platD

  // — the gap: no geometry from here to landingPlatCenterZ - platD/2 — this
  // is the void the car must clear.
  const landingPlatCenterZ = launchPlatFarZ + gap.gapWidth + gap.platD / 2
  const landingPlatFarZ = launchPlatFarZ + gap.gapWidth + gap.platD

  // Down-ramp: rotation +angle, shifted so its near (landing-side) corner
  // lands flush against the landing platform's far edge, at the same height.
  const downNear = rotateX(gap.angle, gap.thick / 2, -gap.run / 2)
  const downCenterZ = landingPlatFarZ - downNear.z

  return (
    <group position={[position.x, 0, position.z]} rotation={[0, yaw, 0]}>
      {/* Up-ramp: rises from road level to the launch platform */}
      <RigidBody type="fixed">
        <CuboidCollider
          args={[gap.roadWidth / 2, gap.thick / 2, gap.run / 2]}
          position={[0, gap.cy, upCenterZ]}
          rotation={[-gap.angle, 0, 0]}
        />
        <mesh position={[0, gap.cy, upCenterZ]} rotation={[-gap.angle, 0, 0]} receiveShadow castShadow material={mat} geometry={rampGeo} />
      </RigidBody>

      {/* Launch platform */}
      <RigidBody type="fixed">
        <CuboidCollider
          args={[gap.roadWidth / 2, gap.platThick / 2, gap.platD / 2]}
          position={[0, gap.platCy, launchPlatCenterZ]}
        />
        <mesh position={[0, gap.platCy, launchPlatCenterZ]} receiveShadow castShadow material={mat} geometry={platGeo} />
      </RigidBody>

      {/* Landing platform */}
      <RigidBody type="fixed">
        <CuboidCollider
          args={[gap.roadWidth / 2, gap.platThick / 2, gap.platD / 2]}
          position={[0, gap.platCy, landingPlatCenterZ]}
        />
        <mesh position={[0, gap.platCy, landingPlatCenterZ]} receiveShadow castShadow material={mat} geometry={platGeo} />
      </RigidBody>

      {/* Down-ramp: descends from the landing platform back to road level */}
      <RigidBody type="fixed">
        <CuboidCollider
          args={[gap.roadWidth / 2, gap.thick / 2, gap.run / 2]}
          position={[0, gap.cy, downCenterZ]}
          rotation={[gap.angle, 0, 0]}
        />
        <mesh position={[0, gap.cy, downCenterZ]} rotation={[gap.angle, 0, 0]} receiveShadow castShadow material={mat} geometry={rampGeo} />
      </RigidBody>
    </group>
  )
}
