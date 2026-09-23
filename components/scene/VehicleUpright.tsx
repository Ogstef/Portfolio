'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { EcctrlVehicleHandle } from 'ecctrl/vehicle'

// bodyYAxis.y is how "up" the car's own up-axis points in world space: 1 =
// upright, 0 = on its side, -1 = roof-down. Below this it's tipped more than
// ~70° — not a guarantee against ever tilting that far (ramps/collisions can
// do it briefly), just the point past which we start watching for "stuck."
const TILT_THRESHOLD = 0.35

// Must stay past the threshold this long before we act. Ramp jumps and hard
// landings can tip the car this far for an instant and self-correct — only
// a *sustained* tilt means it's actually resting upside-down/on its side.
const STUCK_SECONDS = 0.6

// Lift clear of the ground before re-settling so the sudden reorientation
// doesn't snap the (formerly roof-down) underside straight into the ground.
const RECOVER_LIFT = 0.6

const UP = new THREE.Vector3(0, 1, 0)
const FORWARD = new THREE.Vector3(0, 0, 1)

type Props = {
  vehicleRef: React.RefObject<EcctrlVehicleHandle | null>
}

// Safety net for Car.tsx's grip/damping tuning: if the car still ends up
// stuck tipped over, snap it back upright in place instead of leaving the
// player stranded staring at the underside of the world. Deliberately a
// discrete correction (same setTranslation/setRotation/setLinvel/setAngvel
// as VehicleReset.tsx) rather than a continuous rotation constraint — an
// enabledRotations lock was tried here first and it fought the per-wheel
// suspension solver badly enough to launch the car on a light throttle tap.
export default function VehicleUpright({ vehicleRef }: Props) {
  const tiltSeconds = useRef(0)

  useFrame((_, delta) => {
    const v = vehicleRef.current
    // v.body can be null for the first frame or two after the vehicle
    // handle itself exists, before the RigidBody's ref callback fires.
    if (!v || !v.body) return

    if (v.bodyYAxis.y >= TILT_THRESHOLD) {
      tiltSeconds.current = 0
      return
    }

    tiltSeconds.current += delta
    if (tiltSeconds.current < STUCK_SECONDS) return
    tiltSeconds.current = 0

    const body = v.body
    const pos = v.currPos

    // Keep the car's heading (yaw), drop whatever pitch/roll flipped it.
    const forward = FORWARD.clone().applyQuaternion(v.currQuat)
    forward.y = 0
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1)
    forward.normalize()
    const yaw = Math.atan2(forward.x, forward.z)
    const uprightQuat = new THREE.Quaternion().setFromAxisAngle(UP, yaw)

    body.setTranslation({ x: pos.x, y: pos.y + RECOVER_LIFT, z: pos.z }, true)
    body.setRotation({ x: uprightQuat.x, y: uprightQuat.y, z: uprightQuat.z, w: uprightQuat.w }, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  })

  return null
}
