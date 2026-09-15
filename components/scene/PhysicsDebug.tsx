'use client'

// Temporary diagnostic logger — remove once the handbrake/launch instability
// is fixed. Logs while the handbrake is held, OR while accelerating hard
// from near a standstill (the standing-start launch case), so the console
// isn't spammed by normal driving in between.

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { EcctrlVehicleHandle } from 'ecctrl/vehicle'

type Props = {
  vehicleRef: React.RefObject<EcctrlVehicleHandle | null>
}

const euler = new THREE.Euler()
const LAUNCH_SPEED_THRESHOLD = 6 // m/s — below this, hard throttle counts as a "standing start"

export default function PhysicsDebug({ vehicleRef }: Props) {
  const frame = useRef(0)

  useFrame(() => {
    frame.current++

    const v = vehicleRef.current
    if (!v) return

    const speed = Math.hypot(v.currLinVel.x, v.currLinVel.z)
    const launching = v.input.forward && speed < LAUNCH_SPEED_THRESHOLD
    if (!v.input.brake && !launching) return

    euler.setFromQuaternion(v.currQuat, 'ZXY')
    const pitchDeg = THREE.MathUtils.radToDeg(euler.x)
    const rollDeg = THREE.MathUtils.radToDeg(euler.z)
    const yawRateDeg = THREE.MathUtils.radToDeg(v.currAngVel.y)
    const vertVel = v.currLinVel.y

    const wheels = Array.from(v.wheelsInfo.entries())
      .map(([id, ref]) => {
        const w = ref.current
        if (!w) return `${id.slice(0, 4)}:none`
        const hit = w.rayHit ? '1' : '0'
        const lat = w.latFricImp.length().toFixed(2)
        const lng = w.lngFricImp.length().toFixed(2)
        const slip = w.slipStrength.toFixed(2)
        const brake = w.brakeTorque.toFixed(0)
        const drive = w.driveTorque.toFixed(0)
        return `${id.slice(0, 4)}[hit=${hit} lat=${lat} lng=${lng} slip=${slip} brk=${brake} drv=${drive}]`
      })
      .join(' ')

    console.log(
      `[${v.input.brake ? 'BRAKE' : 'LAUNCH'}] t=${frame.current} speed=${speed.toFixed(2)} vertVel=${vertVel.toFixed(2)} yawRate=${yawRateDeg.toFixed(1)} ` +
        `pitch=${pitchDeg.toFixed(1)} roll=${rollDeg.toFixed(1)} :: ${wheels}`
    )
  })

  return null
}
