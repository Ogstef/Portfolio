'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { Instances, Instance } from '@react-three/drei'
import { TRACK_LENGTH, getFrameAtDistance } from '@/lib/trackPath'
import { RAMP_S, inGapSpan } from '@/lib/placement'

// Roadside furniture — visual only, no colliders (ENVIRONMENT_PLAN.md §2.1).

// Reflector posts: thin white posts with a glowing orange cap either side of
// the road. Skipped over canyon spans and at ramp mouths — side ramps start
// right at the road edge (Ramps.tsx ROAD_EDGE=4) and are up to ~11 wide, so
// a post at ±5.2 there would stand on the ramp's driving surface.
const POST_SPACING = 12
const POST_LATERAL = 5.2
const POST_H = 0.9
const RAMP_CLEAR = 8

const postGeo = new THREE.BoxGeometry(0.1, POST_H, 0.1)
const postMat = new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: 0.7 })
const capGeo = new THREE.BoxGeometry(0.12, 0.14, 0.12)
const capMat = new THREE.MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff6a00', emissiveIntensity: 1.2 })

type Post = { x: number; z: number; yaw: number }

function usePosts(): Post[] {
  return useMemo(() => {
    const posts: Post[] = []
    for (let s = POST_SPACING / 2; s < TRACK_LENGTH; s += POST_SPACING) {
      if (inGapSpan(s, 2)) continue
      if (RAMP_S.some((rs) => Math.abs(s - rs) < RAMP_CLEAR)) continue
      const { position, right, yaw } = getFrameAtDistance(s)
      for (const side of [-1, 1]) {
        posts.push({
          x: position.x + right.x * side * POST_LATERAL,
          z: position.z + right.z * side * POST_LATERAL,
          yaw,
        })
      }
    }
    return posts
  }, [])
}

function ReflectorPosts() {
  const posts = usePosts()
  return (
    <>
      <Instances geometry={postGeo} material={postMat} limit={posts.length} frustumCulled={false} castShadow>
        {posts.map((p, i) => (
          <Instance key={i} position={[p.x, POST_H / 2, p.z]} rotation={[0, p.yaw, 0]} />
        ))}
      </Instances>
      <Instances geometry={capGeo} material={capMat} limit={posts.length} frustumCulled={false}>
        {posts.map((p, i) => (
          <Instance key={i} position={[p.x, POST_H + 0.07, p.z]} rotation={[0, p.yaw, 0]} />
        ))}
      </Instances>
    </>
  )
}

export default function RoadDressing() {
  return <ReflectorPosts />
}
