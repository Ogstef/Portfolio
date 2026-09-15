'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import type { Project } from '@/data/projects'
import ProjectPanel from '@/components/overlay/ProjectPanel'
import SkipToResumeLink from '@/components/overlay/SkipToResumeLink'
import CinematicToggle from '@/components/overlay/CinematicToggle'
import ResetButton from '@/components/overlay/ResetButton'

// Load the 3D scene only on the client — Three.js / Rapier won't run in SSR
const DriveScene = dynamic(() => import('@/components/scene/DriveScene'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0d0d1a] text-white/50 text-sm">
      Loading scene…
    </div>
  ),
})

export default function HomePage() {
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [cinematicsEnabled, setCinematicsEnabled] = useState(true)
  const [resetSignal, setResetSignal] = useState(0)

  const handleReset = useCallback(() => {
    setActiveProject(null)
    setResetSignal((s) => s + 1)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'KeyP' || e.repeat) return
      handleReset()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleReset])

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#0d0d1a]">
      <SkipToResumeLink />

      <DriveScene
        activeProject={activeProject}
        onEnterStop={(project) => {
          if (cinematicsEnabled) setActiveProject(project)
        }}
        onLeaveStop={() => setActiveProject(null)}
        resetSignal={resetSignal}
      />

      <ProjectPanel project={activeProject} />
      <CinematicToggle
        enabled={cinematicsEnabled}
        onToggle={() => setCinematicsEnabled((v) => !v)}
      />
      <ResetButton onReset={handleReset} />
    </main>
  )
}
