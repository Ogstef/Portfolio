'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { TRACK_LENGTH, getFrameAtDistance, sampleTrackRange } from '@/lib/trackPath'
import { GAPS } from '@/lib/gapJump'

// Road follows the curved centerline defined in lib/trackPath.ts, starting
// just behind spawn and ending past the last stop. It breaks into a ribbon
// segment per gap in GAPS — GapRamp.tsx fills each of those spans with a
// mandatory canyon-jump ramp instead of flat road.

const ROAD_WIDTH    = 8
const SEGMENT_LENGTH = 2

const DASH_LENGTH  = 2
const DASH_GAP     = 6.5
const DASH_COUNT   = Math.floor(TRACK_LENGTH / (DASH_LENGTH + DASH_GAP))

function buildRibbonGeometry(
  samples: Array<{ position: THREE.Vector3; right: THREE.Vector3 }>,
  centerOffset: number,
  width: number,
  y: number,
) {
  const positions: number[] = []
  const indices: number[] = []

  for (const sample of samples) {
    const center = sample.position.clone().addScaledVector(sample.right, centerOffset)
    const left = center.clone().addScaledVector(sample.right, -width / 2)
    const right = center.clone().addScaledVector(sample.right, width / 2)
    positions.push(left.x, y, left.z, right.x, y, right.z)
  }

  for (let i = 0; i < samples.length - 1; i++) {
    const a = i * 2
    const b = a + 1
    const c = a + 2
    const d = a + 3
    indices.push(a, c, b, b, c, d)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

// [start, end] arc-length ranges the flat ribbon covers — the whole track
// minus every mandatory gap-jump span (see lib/gapJump.ts).
const ROAD_RANGES: Array<[number, number]> = (() => {
  const ranges: Array<[number, number]> = []
  let cursor = 0
  for (const gap of GAPS) {
    ranges.push([cursor, gap.baseDistance])
    cursor = gap.downRampEnd
  }
  ranges.push([cursor, TRACK_LENGTH])
  return ranges
})()

export default function Road() {
  const sampleSets = useMemo(
    () => ROAD_RANGES.map(([start, end]) => sampleTrackRange(start, end, SEGMENT_LENGTH)),
    [],
  )

  const surfaceGeometries = useMemo(
    () => sampleSets.map((samples) => buildRibbonGeometry(samples, 0, ROAD_WIDTH, 0.01)),
    [sampleSets],
  )
  const leftEdgeGeometries = useMemo(
    () => sampleSets.map((samples) => buildRibbonGeometry(samples, -ROAD_WIDTH / 2, 0.12, 0.02)),
    [sampleSets],
  )
  const rightEdgeGeometries = useMemo(
    () => sampleSets.map((samples) => buildRibbonGeometry(samples, ROAD_WIDTH / 2, 0.12, 0.02)),
    [sampleSets],
  )

  const dashes = useMemo(() => {
    const items: Array<{ x: number; z: number; yaw: number; key: number }> = []
    for (let i = 0; i < DASH_COUNT; i++) {
      const s = DASH_GAP + i * (DASH_LENGTH + DASH_GAP) + DASH_LENGTH / 2
      if (GAPS.some((gap) => s >= gap.baseDistance && s <= gap.downRampEnd)) continue
      const { position, yaw } = getFrameAtDistance(s)
      items.push({ x: position.x, z: position.z, yaw, key: i })
    }
    return items
  }, [])

  return (
    <group>
      {/* Road surface */}
      {surfaceGeometries.map((geometry, i) => (
        <mesh key={i} geometry={geometry} receiveShadow>
          <meshStandardMaterial color="#111122" />
        </mesh>
      ))}

      {/* Road edges */}
      {leftEdgeGeometries.map((geometry, i) => (
        <mesh key={i} geometry={geometry}>
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
        </mesh>
      ))}
      {rightEdgeGeometries.map((geometry, i) => (
        <mesh key={i} geometry={geometry}>
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
        </mesh>
      ))}

      {/* Dashed centre line */}
      {dashes.map(({ x, z, yaw, key }) => (
        <mesh key={key} position={[x, 0.02, z]} rotation={[0, yaw, 0]}>
          <boxGeometry args={[0.08, 0.02, DASH_LENGTH]} />
          <meshStandardMaterial color="#ffdd55" emissive="#ffdd55" emissiveIntensity={0.4} />
        </mesh>
      ))}
    </group>
  )
}
