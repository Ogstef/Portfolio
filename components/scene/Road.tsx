'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { Instances, Instance } from '@react-three/drei'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { TRACK_LENGTH, getFrameAtDistance, sampleTrackRange } from '@/lib/trackPath'
import { GAPS } from '@/lib/gapJump'
import { getAsphaltTexture } from '@/lib/canvasTextures'

// Road follows the curved centerline defined in lib/trackPath.ts, starting
// just behind spawn and ending past the last stop. It breaks into a ribbon
// segment per gap in GAPS — GapRamp.tsx fills each of those spans with a
// mandatory canyon-jump ramp instead of flat road.

const ROAD_WIDTH    = 8
const SEGMENT_LENGTH = 2

const DASH_LENGTH  = 2
const DASH_GAP     = 6.5
const DASH_COUNT   = Math.floor(TRACK_LENGTH / (DASH_LENGTH + DASH_GAP))

// Dusty verge either side of the asphalt. Built as two outer strips rather
// than one wide ribbon under the road, so the two never overlap in depth and
// can't z-fight at a distance.
const SHOULDER_WIDTH = 1.5
const ASPHALT_TILE = 8 // metres along the road per repeat of the asphalt texture

const dashGeo = new THREE.BoxGeometry(0.08, 0.02, DASH_LENGTH)
const dashMat = new THREE.MeshStandardMaterial({ color: '#ffdd55', emissive: '#ffdd55', emissiveIntensity: 0.4 })
const edgeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.3 })
const shoulderMat = new THREE.MeshStandardMaterial({
  color: '#7a5a3c',
  roughness: 1,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
})

// `vStart`/`vTile`: when given, emits UVs — u spans 0→1 across the ribbon,
// v is arc length / vTile (offset by vStart so textures stay continuous
// across the separate segments either side of a gap).
function buildRibbonGeometry(
  samples: Array<{ position: THREE.Vector3; right: THREE.Vector3 }>,
  centerOffset: number,
  width: number,
  y: number,
  uvs?: { vStart: number; vTile: number },
) {
  const positions: number[] = []
  const uv: number[] = []
  const indices: number[] = []

  let dist = 0
  samples.forEach((sample, i) => {
    if (i > 0) dist += sample.position.distanceTo(samples[i - 1].position)
    const center = sample.position.clone().addScaledVector(sample.right, centerOffset)
    const left = center.clone().addScaledVector(sample.right, -width / 2)
    const right = center.clone().addScaledVector(sample.right, width / 2)
    positions.push(left.x, y, left.z, right.x, y, right.z)
    if (uvs) {
      const v = (uvs.vStart + dist) / uvs.vTile
      uv.push(0, v, 1, v)
    }
  })

  for (let i = 0; i < samples.length - 1; i++) {
    const a = i * 2
    const b = a + 1
    const c = a + 2
    const d = a + 3
    indices.push(a, c, b, b, c, d)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  if (uvs) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
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
    () =>
      sampleSets.map((samples, i) =>
        buildRibbonGeometry(samples, 0, ROAD_WIDTH, 0.01, { vStart: ROAD_RANGES[i][0], vTile: ASPHALT_TILE }),
      ),
    [sampleSets],
  )
  const asphaltMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: getAsphaltTexture(), roughness: 0.95 }),
    [],
  )
  // Both shoulders of every segment merged into one geometry — one draw.
  const shoulderGeometry = useMemo(() => {
    const offset = ROAD_WIDTH / 2 + SHOULDER_WIDTH / 2
    return mergeGeometries(
      sampleSets.flatMap((samples) => [
        buildRibbonGeometry(samples, -offset, SHOULDER_WIDTH, 0.005),
        buildRibbonGeometry(samples, offset, SHOULDER_WIDTH, 0.005),
      ]),
    )
  }, [sampleSets])
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
        <mesh key={i} geometry={geometry} material={asphaltMat} receiveShadow />
      ))}

      {/* Dusty shoulder */}
      <mesh geometry={shoulderGeometry} material={shoulderMat} receiveShadow />

      {/* Road edges */}
      {leftEdgeGeometries.map((geometry, i) => (
        <mesh key={i} geometry={geometry} material={edgeMat} />
      ))}
      {rightEdgeGeometries.map((geometry, i) => (
        <mesh key={i} geometry={geometry} material={edgeMat} />
      ))}

      {/* Dashed centre line */}
      <Instances geometry={dashGeo} material={dashMat} limit={dashes.length} frustumCulled={false}>
        {dashes.map(({ x, z, yaw, key }) => (
          <Instance key={key} position={[x, 0.02, z]} rotation={[0, yaw, 0]} />
        ))}
      </Instances>
    </group>
  )
}
