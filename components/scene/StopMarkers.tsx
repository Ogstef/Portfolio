'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { EcctrlVehicleHandle } from 'ecctrl/vehicle'
import type { Project } from '@/data/projects'
import ProjectBillboard from './ProjectBillboard'

type Props = {
  projects: Project[]
  vehicleRef: React.RefObject<EcctrlVehicleHandle | null>
  onEnter: (project: Project) => void
  onLeave: (project: Project) => void
}

export default function StopMarkers({ projects, vehicleRef, onEnter, onLeave }: Props) {
  const positions = useRef(projects.map((p) => new THREE.Vector3(...p.position)))
  const activeId = useRef<string | null>(null)

  useFrame(() => {
    const v = vehicleRef.current
    if (!v) return

    let nearest: Project | null = null
    let nearestDist = Infinity

    for (let i = 0; i < projects.length; i++) {
      const dist = v.currPos.distanceTo(positions.current[i])
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = projects[i]
      }
    }

    const inside = nearest !== null && nearestDist < nearest.triggerRadius

    if (inside && nearest!.id !== activeId.current) {
      activeId.current = nearest!.id
      onEnter(nearest!)
    } else if (!inside && activeId.current !== null) {
      activeId.current = null
      onLeave(projects[0])
    }
  })

  return (
    <>
      {projects.map((p) => {
        const [, py, pz] = p.position as [number, number, number]
        return (
          // Billboard sits at signX (off road), trigger zone stays at road centre (x=0)
          <group key={p.id} position={[0, py, pz]}>
            <ProjectBillboard project={p} />
          </group>
        )
      })}
    </>
  )
}
