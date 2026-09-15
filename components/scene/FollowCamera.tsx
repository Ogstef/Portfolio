'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { EcctrlVehicleHandle } from 'ecctrl/vehicle'
import type { Project } from '@/data/projects'

// Follow mode
const FOLLOW_OFFSET  = new THREE.Vector3(0, 4, -10)
const LERP_POS_DRIVE = 0.08
const LERP_LOOK_DRIVE = 0.12

// Ground sits at y=0. Floors both the camera and its look target here so
// that whatever the car's chassis is doing (mid-flip, tipped over, however
// briefly before VehicleUpright corrects it), the camera itself can never
// dip underground or look at the world upside-down.
const MIN_CAMERA_Y = 1.5
const MIN_LOOK_Y   = 0.3
const UP = new THREE.Vector3(0, 1, 0)
const FORWARD = new THREE.Vector3(0, 0, 1)

// Cinematic sign mode
const SIGN_APPROACH   = 14  // how far across the road the camera parks
const SIGN_LOOK_Y     = 3   // look lower than the sign itself so the (higher) sign
                             // lands in the upper part of the frame, clear of the
                             // fixed-bottom 2D project panel instead of overlapping it
const LERP_POS_SIGN   = 0.025 // slow dolly
const LERP_LOOK_SIGN  = 0.04  // slow pan onto sign

type Props = {
  vehicleRef: React.RefObject<EcctrlVehicleHandle | null>
  activeProject: Project | null
}

export default function FollowCamera({ vehicleRef, activeProject }: Props) {
  const { camera } = useThree()
  const lookTarget   = useRef(new THREE.Vector3())
  const signCamPos   = useRef(new THREE.Vector3())
  const signLookPos  = useRef(new THREE.Vector3())

  useFrame(() => {
    const v = vehicleRef.current
    if (!v) return

    if (activeProject) {
      const [, sy, sz] = activeProject.position as [number, number, number]
      const sx = activeProject.signX

      // Camera parks on the opposite side of the road from the sign, slightly back
      const approachX = sx + (sx < 0 ? SIGN_APPROACH : -SIGN_APPROACH)
      signCamPos.current.set(approachX, 5, sz - 4)
      signLookPos.current.set(sx, sy + SIGN_LOOK_Y, sz)

      camera.position.lerp(signCamPos.current, LERP_POS_SIGN)
      lookTarget.current.lerp(signLookPos.current, LERP_LOOK_SIGN)
    } else {
      // Trail behind the car's heading only (yaw) — never inherit its
      // pitch/roll, so the camera can't tip over or point underground even
      // while the chassis itself is briefly tilted or flipped.
      const forward = FORWARD.clone().applyQuaternion(v.currQuat)
      forward.y = 0
      if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1)
      forward.normalize()
      const yaw = Math.atan2(forward.x, forward.z)
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(UP, yaw)
      const rotatedOffset = FOLLOW_OFFSET.clone().applyQuaternion(yawQuat)

      camera.position.lerp(v.currPos.clone().add(rotatedOffset), LERP_POS_DRIVE)
      lookTarget.current.lerp(v.currPos, LERP_LOOK_DRIVE)
    }

    camera.position.y = Math.max(camera.position.y, MIN_CAMERA_Y)
    lookTarget.current.y = Math.max(lookTarget.current.y, MIN_LOOK_Y)
    camera.lookAt(lookTarget.current)
  })

  return null
}
