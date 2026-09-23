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
      {projects.map((p) => (
        <ProjectBillboard key={p.id} project={p} />
      ))}
    </>
  )
}
