'use client'

import { useEffect, useState } from 'react'
import { driveKeys } from '@/lib/vehicleInput'

const VISIBLE_DURATION_MS = 5000

export default function ControlHints() {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDismissed(true), VISIBLE_DURATION_MS)

    const onKeyDown = (e: KeyboardEvent) => {
      if (!driveKeys.includes(e.code)) return
      setDismissed(true)
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <div
      className={`pointer-events-none fixed top-4 left-1/2 z-30 -translate-x-1/2 rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-opacity duration-300 ${
        dismissed ? 'opacity-0' : 'opacity-100'
      }`}
    >
      WASD / ↑↓←→ — Drive · Space — Brake
    </div>
  )
}
