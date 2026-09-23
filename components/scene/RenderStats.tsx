'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type { EcctrlVehicleHandle } from 'ecctrl/vehicle'

// Dev-only perf probe for the environment pass (ENVIRONMENT_PLAN.md §5):
// logs draw calls / triangles once shortly after mount, and again whenever
// you press I (e.g. mid-track). Renders nothing, strips out of prod builds.
type Props = {
  vehicleRef: React.RefObject<EcctrlVehicleHandle | null>
}

export default function RenderStats({ vehicleRef }: Props) {
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    const log = (label: string) => {
      const { calls, triangles } = gl.info.render
      const carY = vehicleRef.current?.currPos.y
      console.log(
        `[RenderStats] ${label}: ${calls} draw calls, ${triangles} triangles` +
          (carY !== undefined ? `, chassis y=${carY.toFixed(3)}` : ''),
      )
    }
    const t = setTimeout(() => log('initial'), 3000)
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyI' && !e.repeat) log('snapshot')
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [gl, vehicleRef])

  return null
}
