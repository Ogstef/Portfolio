'use client'

import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { PerformanceMonitor } from '@react-three/drei'

// Quality gate + lazy loader for Effects.tsx. The postprocessing library is
// only fetched (as its own chunk) on devices that pass the gate, and is
// unmounted for good if the frame rate sags for a sustained stretch.
const Effects = lazy(() => import('./Effects'))

// Ignore the first few seconds: mounting the composer compiles shaders, and
// that one-off hitch shouldn't count as a sustained decline.
const GRACE_MS = 5000

function capable() {
  if (typeof window === 'undefined') return false
  const cores = navigator.hardwareConcurrency ?? 8
  return window.innerWidth >= 768 && cores > 4
}

export default function PostFX() {
  const [enabled, setEnabled] = useState(capable)
  const mountedAt = useRef(0)
  useEffect(() => {
    mountedAt.current = performance.now()
  }, [])

  if (!enabled) return null
  return (
    <PerformanceMonitor
      onDecline={() => {
        if (performance.now() - mountedAt.current > GRACE_MS) setEnabled(false)
      }}
    >
      <Suspense fallback={null}>
        <Effects />
      </Suspense>
    </PerformanceMonitor>
  )
}
