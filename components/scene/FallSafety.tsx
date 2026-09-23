'use client'

import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { EcctrlVehicleHandle } from 'ecctrl/vehicle'
import { getFrameAtDistance } from '@/lib/trackPath'
import { GAPS } from '@/lib/gapJump'

// Below any legitimate driving surface (ramps top out well above this) —
// falling past it only happens by missing one of the mandatory canyon jumps.
const FALL_Y = -8

const UP = new THREE.Vector3(0, 1, 0)

// Precompute each gap's respawn frame (position + facing) once.
const RESPAWN_FRAMES = GAPS.map((gap) => {
  const frame = getFrameAtDistance(gap.respawnDistance)
  const quat = new THREE.Quaternion().setFromAxisAngle(UP, frame.yaw)
  return { z: frame.position.z, position: frame.position, quat }
})

// A missed jump drops the car into the void with nothing to catch it —
// without this it falls forever. Teleports back to just before whichever
// gap it fell through (found by nearest world-Z, since a car in freefall
// hasn't drifted far from the gap it fell into) so a missed jump is a quick
// retry, not a long drive back to spawn.
export default function FallSafety({ vehicleRef }: { vehicleRef: React.RefObject<EcctrlVehicleHandle | null> }) {
  useFrame(() => {
    const v = vehicleRef.current
    // v.body can be null for the first frame or two after the vehicle
    // handle itself exists, before the RigidBody's ref callback fires.
    if (!v || !v.body || v.currPos.y > FALL_Y) return

    const carZ = v.currPos.z
    const nearest = RESPAWN_FRAMES.reduce((best, f) =>
      Math.abs(f.z - carZ) < Math.abs(best.z - carZ) ? f : best,
    )

    const body = v.body
    body.setTranslation({ x: nearest.position.x, y: 2, z: nearest.position.z }, true)
    body.setRotation({ x: nearest.quat.x, y: nearest.quat.y, z: nearest.quat.z, w: nearest.quat.w }, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  })

  return null
}
