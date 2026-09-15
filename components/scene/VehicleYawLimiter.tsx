'use client'

import { useFrame } from '@react-three/fiber'
import type { EcctrlVehicleHandle } from 'ecctrl/vehicle'

// PhysicsDebug logs (space held at speed) showed yawRate escalating past
// 190-260°/s during a rear-wheel-lock handbrake turn — a runaway spin, not
// a controlled U-turn (a real handbrake turn peaks around 120-180°/s). That
// runaway is what was launching/flipping the car for VehicleUpright to then
// clean up after. Clamping angular velocity itself — not a rotation
// constraint, which is what broke the car earlier by giving the per-wheel
// suspension solver nowhere to put its reaction force — still lets any turn
// happen, it just can't run away past this ceiling.
const MAX_YAW_RATE = Math.PI // rad/s, ~180°/s

type Props = {
  vehicleRef: React.RefObject<EcctrlVehicleHandle | null>
}

export default function VehicleYawLimiter({ vehicleRef }: Props) {
  useFrame(() => {
    const v = vehicleRef.current
    if (!v) return

    const av = v.currAngVel
    if (Math.abs(av.y) <= MAX_YAW_RATE) return

    v.body.setAngvel({ x: av.x, y: Math.sign(av.y) * MAX_YAW_RATE, z: av.z }, true)
  })

  return null
}
