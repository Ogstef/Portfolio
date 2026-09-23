'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { EcctrlVehicleHandle } from 'ecctrl/vehicle'

// Same direction as the old fixed key light at [10, 6, -5], pushed further
// out so the shadow camera's near plane never clips tall scenery.
const OFFSET = new THREE.Vector3(10, 6, -5).normalize().multiplyScalar(50)
const SHADOW_EXTENT = 40

type Props = {
  vehicleRef: React.RefObject<EcctrlVehicleHandle | null>
}

// Key light whose shadow frustum travels with the car. A fixed
// directionalLight's default shadow camera only covers ±5 units around the
// origin, so shadows vanished as soon as you drove away from spawn.
export default function SunLight({ vehicleRef }: Props) {
  const light = useRef<THREE.DirectionalLight>(null)

  useFrame(() => {
    const l = light.current
    const v = vehicleRef.current
    if (!l || !v) return
    // The target isn't in the scene graph, so update its matrix by hand —
    // DirectionalLight reads target.matrixWorld when aiming its shadow camera.
    l.target.position.set(v.currPos.x, 0, v.currPos.z)
    l.position.copy(l.target.position).add(OFFSET)
    l.target.updateMatrixWorld()
  })

  return (
    <directionalLight
      ref={light}
      color="#ffc080"
      position={OFFSET}
      intensity={1.8}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0001}
      shadow-normalBias={0.03}
      shadow-camera-left={-SHADOW_EXTENT}
      shadow-camera-right={SHADOW_EXTENT}
      shadow-camera-top={SHADOW_EXTENT}
      shadow-camera-bottom={-SHADOW_EXTENT}
      shadow-camera-near={1}
      shadow-camera-far={100}
    />
  )
}
