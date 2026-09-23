'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { Instances, Instance } from '@react-three/drei'
import { mulberry32 } from '@/lib/random'

// The track (lib/trackPath.ts) runs roughly z∈[-20,340], x∈[-9,10] — this
// ring is centered on its rough midpoint, at a radius well beyond any
// scenery/ramp footprint (Scenery's FIELD_X tops out at 46) and tuned to sit
// inside the fog falloff (see DriveScene.tsx's far=150) so the peaks read as
// a hazy distant range instead of vanishing into flat fog-colored nothing —
// which is what made the world feel like open, unbounded "backrooms."
const CENTER: [number, number] = [0, 160]
const BASE_RADIUS = 250
const RADIUS_JITTER = 30
const COUNT = 52

// Unit cone scaled per peak; colour comes from the per-instance colour, so
// the material itself is white.
const peakGeo = new THREE.ConeGeometry(1, 1, 5)
const peakMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, fog: true })

type Peak = { x: number; z: number; height: number; radiusXZ: number; rotY: number; dark: number }

function usePeaks(): Peak[] {
  return useMemo(() => {
    const rand = mulberry32(7007)
    const peaks: Peak[] = []
    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2 + (rand() - 0.5) * (Math.PI / COUNT)
      const radius = BASE_RADIUS + (rand() - 0.5) * 2 * RADIUS_JITTER
      const x = CENTER[0] + Math.cos(angle) * radius
      const z = CENTER[1] + Math.sin(angle) * radius
      peaks.push({
        x,
        z,
        height: 26 + rand() * 34,
        radiusXZ: 30 + rand() * 26,
        rotY: rand() * Math.PI * 2,
        dark: rand(),
      })
    }
    return peaks
  }, [])
}

// Static ring of low-poly mountains enclosing the play area — purely visual
// (no colliders), sits outside the Physics tree in DriveScene.tsx like Sky/
// Stars/SkyLife.
export default function Horizon() {
  const peaks = usePeaks()
  return (
    <Instances geometry={peakGeo} material={peakMat} limit={COUNT} frustumCulled={false}>
      {peaks.map(({ x, z, height, radiusXZ, rotY, dark }, i) => (
        <Instance
          key={i}
          position={[x, height / 2 - 1, z]}
          rotation={[0, rotY, 0]}
          scale={[radiusXZ, height, radiusXZ * (0.8 + dark * 0.3)]}
          // Mix between two muted dusk-mountain tones for a bit of silhouette variety.
          color={dark > 0.5 ? '#4a3230' : '#5c4038'}
        />
      ))}
    </Instances>
  )
}
