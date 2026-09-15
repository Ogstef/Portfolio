'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { getCloudPuffTexture } from '@/lib/canvasTextures'

function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Puff = { x: number; y: number; z: number; scale: number; opacity: number }
type Cluster = { puffs: Puff[]; z: number; speed: number; startX: number }

const CLOUD_COUNT = 6
const FIELD_WIDTH = 260 // clouds wrap within this span so they never visibly "vanish"

function useClusters(): Cluster[] {
  return useMemo(() => {
    const rand = mulberry32(42)
    return Array.from({ length: CLOUD_COUNT }, () => {
      const puffCount = 4 + Math.floor(rand() * 3)
      const puffs: Puff[] = Array.from({ length: puffCount }, () => ({
        x: (rand() - 0.5) * 14,
        y: (rand() - 0.5) * 2.5,
        z: (rand() - 0.5) * 6,
        scale: 6 + rand() * 6,
        opacity: 0.35 + rand() * 0.3,
      }))
      return {
        puffs,
        z: 40 + rand() * 120,
        speed: 0.4 + rand() * 0.5,
        startX: rand() * FIELD_WIDTH - FIELD_WIDTH / 2,
      }
    })
  }, [])
}

function wrap(x: number, span: number) {
  const half = span / 2
  return (((x + half) % span) + span) % span - half
}

function CloudCluster({ cluster }: { cluster: Cluster }) {
  const texture = useMemo(() => getCloudPuffTexture(), [])
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    groupRef.current.position.x = wrap(cluster.startX + clock.elapsedTime * cluster.speed, FIELD_WIDTH)
  })

  return (
    <group ref={groupRef} position={[cluster.startX, 32, cluster.z]}>
      {cluster.puffs.map((p, i) => (
        <sprite key={i} position={[p.x, p.y, p.z]} scale={[p.scale, p.scale * 0.6, 1]}>
          <spriteMaterial map={texture} color="#fff3e0" transparent opacity={p.opacity} depthWrite={false} fog />
        </sprite>
      ))}
    </group>
  )
}

// Slow drifting clouds + drifting dust motes — self-contained (no external
// texture/CDN), just canvas-drawn sprites and drei's built-in Sparkles.
export default function SkyLife() {
  const clusters = useClusters()

  return (
    <>
      {clusters.map((c, i) => (
        <CloudCluster key={i} cluster={c} />
      ))}
      <Sparkles count={140} scale={[70, 12, 200]} position={[0, 6, 90]} size={2.5} speed={0.15} opacity={0.35} color="#ffcf8a" noise={1} />
    </>
  )
}
