'use client'

import { useEffect, useRef } from 'react'
import type { EcctrlVehicleHandle } from 'ecctrl/vehicle'

type Props = {
  vehicleRef: React.RefObject<EcctrlVehicleHandle | null>
  resetSignal: number
  spawn: [number, number, number]
}

export default function VehicleReset({ vehicleRef, resetSignal, spawn }: Props) {
  const prevSignal = useRef(resetSignal)

  useEffect(() => {
    if (resetSignal === prevSignal.current) return
    prevSignal.current = resetSignal

    const body = vehicleRef.current?.body
    if (!body) return

    const [x, y, z] = spawn
    body.setTranslation({ x, y, z }, true)
    body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  }, [resetSignal, vehicleRef, spawn])

  return null
}
