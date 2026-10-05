'use client'

import { useState } from 'react'
import { useFrame } from '@react-three/fiber'

// Mounts its children one frame after the scene first renders, so
// non-critical layers (ambient life, dust) never delay that first frame
// (ENVIRONMENT_PLAN.md §2.6).
export default function AfterFirstFrame({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  useFrame(() => {
    if (!ready) setReady(true)
  })
  return ready ? <>{children}</> : null
}
