'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import type { EcctrlVehicleHandle } from 'ecctrl/vehicle'
import { Controls } from '@/lib/vehicleInput'

type Props = {
  vehicleRef: React.RefObject<EcctrlVehicleHandle | null>
  locked: boolean
  onExit: () => void
}

export default function VehicleInputBridge({ vehicleRef, locked, onExit }: Props) {
  const [, getKeys] = useKeyboardControls<Controls>()
  const prevForward = useRef(false)

  useFrame(() => {
    const v = vehicleRef.current
    if (!v) return

    const { forward, backward, steerLeft, steerRight, brake } = getKeys()

    if (locked) {
      v.setMovement({ forward: false, backward: false, steerLeft: false, steerRight: false, brake: true })

      // Wheel friction alone (now rear-only, softened for handbrake turns)
      // isn't strong enough to hold the car still — it kept creeping/sliding
      // while a sign was up. Zero horizontal velocity directly every frame
      // for a hard, immediate stop; leave Y alone so gravity/suspension
      // still settle it naturally instead of fighting them.
      const linvel = v.currLinVel
      v.body.setLinvel({ x: 0, y: linvel.y, z: 0 }, true)
      v.body.setAngvel({ x: 0, y: 0, z: 0 }, true)

      // Rising edge of ↑ / W exits sign mode
      if (forward && !prevForward.current) onExit()
      prevForward.current = forward
      return
    }

    prevForward.current = forward

    // ecctrl's drive controller targets a velocity and keeps commanding more
    // torque the longer it's resisted. Holding forward and brake together
    // lets that torque command wind up against the brake, then dump all at
    // once as a launch the instant it overpowers it — reproduced right after
    // exiting sign mode by pressing both at once. A handbrake and a throttle
    // shouldn't be active together, so brake always wins.
    v.setMovement({
      forward: brake ? false : forward,
      backward: brake ? false : backward,
      steerLeft,
      steerRight,
      brake,
    })
  })

  return null
}
