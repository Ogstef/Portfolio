'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { ENV_ASSETS, ENV_USE_DRACO } from '@/lib/envAssets'

// Compiles every material in the scene up front, while the boot intro is
// still on screen. Without this, three.js compiles each shader the first
// time its object is drawn — so dioramas, the finale and other things off
// screen at spawn would each cause a hitch the first time they came into
// view mid-drive.
//
// Suspends until the env models are loaded so the meshes built from them
// exist; then waits two frames for sibling Suspense boundaries waiting on
// the same (now cached) files to mount, and compiles. compileAsync uses
// KHR_parallel_shader_compile where available, so it doesn't block.
export default function ShaderWarmup() {
  useGLTF(ENV_ASSETS.nature, ENV_USE_DRACO)
  useGLTF(ENV_ASSETS.props, ENV_USE_DRACO)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    let cancelled = false
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        if (!cancelled) gl.compileAsync(scene, camera).catch(() => {})
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [gl, scene, camera])

  return null
}
