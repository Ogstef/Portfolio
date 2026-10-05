'use client'

import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import { Instances, Instance, useGLTF } from '@react-three/drei'
import { TRACK_LENGTH, getFrameAtDistance } from '@/lib/trackPath'
import { GAPS } from '@/lib/gapJump'
import { RAMP_S, inGapSpan, inStopCorridor, trackToWorld } from '@/lib/placement'
import { getChevronTexture, getJumpSignTexture } from '@/lib/canvasTextures'
import { ENV_ASSETS, ENV_USE_DRACO } from '@/lib/envAssets'
import StaticInstances, { GltfInstances, placeMatrix } from './StaticInstances'

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

// ─── Gap-jump approach ─────────────────────────────────────────────────────
// Build-up to each mandatory canyon jump: two "JUMP AHEAD" signs counting
// down, chevron boards either side of the up-ramp, and a cone-lined run-in.

const SIGN_DISTANCES = [40, 20] as const
const SIGN_LATERAL = 7.2
const SIGN_W = 1.4
const SIGN_H = SIGN_W * (340 / 256) // matches getJumpSignTexture's canvas
const SIGN_CENTER_Y = 2.2
const CHEVRON_W = 1.2
const CHEVRON_H = 0.75
const CHEVRON_CENTER_Y = 0.95
const CHEVRON_LATERAL = 4.9
const CHEVRON_S = [-0.5, 5] // relative to each gap's baseDistance
const CONE_LATERAL = 4.6 // cone radius ~0.31 at this scale — clear of the road edge at 4
const CONE_SCALE = 1.3
const CONE_RUN = 16 // metres of cones before the ramp
const CONE_SPACING = 3

const signPostGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0) // scaled per instance
const signPostMat = new THREE.MeshStandardMaterial({ color: '#8c9096', roughness: 0.5, metalness: 0.6 })
const signGeo = new THREE.PlaneGeometry(SIGN_W, SIGN_H)
const chevronGeo = new THREE.PlaneGeometry(CHEVRON_W, CHEVRON_H)

function boardMaterial(map: THREE.Texture) {
  // A touch of self-illumination stands in for retroreflective sheeting so
  // the signs still read at dusk and through the fog.
  return new THREE.MeshStandardMaterial({
    map,
    emissiveMap: map,
    emissive: '#ffffff',
    emissiveIntensity: 0.25,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    roughness: 0.6,
  })
}

type Approach = {
  posts: THREE.Matrix4[]
  signs: Record<(typeof SIGN_DISTANCES)[number], THREE.Matrix4[]>
  chevrons: { left: THREE.Matrix4[]; right: THREE.Matrix4[] }
  cones: THREE.Matrix4[]
}

// Board facing the approaching car (whose heading is the track tangent).
function facingCar(s: number, lateral: number, y: number) {
  const { yaw } = getFrameAtDistance(s)
  const p = trackToWorld(s, lateral)
  return { p, yaw, board: placeMatrix(p.x, y, p.z, yaw + Math.PI) }
}

function buildApproach(): Approach {
  const out: Approach = { posts: [], signs: { 40: [], 20: [] }, chevrons: { left: [], right: [] }, cones: [] }

  for (const gap of GAPS) {
    for (const d of SIGN_DISTANCES) {
      const s = gap.baseDistance - d
      for (const side of [-1, 1]) {
        const lateral = side * SIGN_LATERAL
        const { p, yaw, board } = facingCar(s, lateral, SIGN_CENTER_Y)
        // Tall: keep it out of every stop's cutscene sightline.
        if (inStopCorridor(p.x, p.z, SIGN_CENTER_Y + SIGN_H / 2, SIGN_W / 2)) continue
        out.signs[d].push(board)
        // Post just behind the board, from the ground to its top edge.
        const back = trackToWorld(s + 0.04, lateral)
        out.posts.push(placeMatrix(back.x, 0, back.z, yaw, [0.08, SIGN_CENTER_Y + SIGN_H / 2 - 0.2, 0.08]))
      }
    }

    for (const ds of CHEVRON_S) {
      const s = gap.baseDistance + ds
      for (const side of [-1, 1]) {
        const lateral = side * CHEVRON_LATERAL
        const { p, yaw, board } = facingCar(s, lateral, CHEVRON_CENTER_Y)
        if (inStopCorridor(p.x, p.z, CHEVRON_CENTER_Y + CHEVRON_H / 2)) continue
        // The track's "right" vector is the driver's left, so boards on the
        // negative side sit on the driver's right and point left (inwards).
        out.chevrons[side < 0 ? 'left' : 'right'].push(board)
        const back = trackToWorld(s + 0.04, lateral)
        out.posts.push(placeMatrix(back.x, 0, back.z, yaw, [0.07, CHEVRON_CENTER_Y, 0.07]))
      }
    }

    for (let s = gap.baseDistance - CONE_RUN; s < gap.baseDistance - 0.5; s += CONE_SPACING) {
      for (const side of [-1, 1]) {
        const p = trackToWorld(s, side * CONE_LATERAL)
        out.cones.push(placeMatrix(p.x, 0, p.z, s * 1.7 + side, CONE_SCALE))
      }
    }
  }
  return out
}

const APPROACH = buildApproach()

function Cones() {
  const { scene } = useGLTF(ENV_ASSETS.props, ENV_USE_DRACO)
  const cone = useMemo(() => scene.children.find((o) => o.name === 'cone')!, [scene])
  return <GltfInstances node={cone} matrices={APPROACH.cones} castShadow />
}

function GapApproach() {
  const mats = useMemo(
    () => ({
      sign40: boardMaterial(getJumpSignTexture('40 m')),
      sign20: boardMaterial(getJumpSignTexture('20 m')),
      chevronLeft: boardMaterial(getChevronTexture('left')),
      chevronRight: boardMaterial(getChevronTexture('right')),
    }),
    [],
  )
  return (
    <>
      <StaticInstances geometry={signPostGeo} material={signPostMat} matrices={APPROACH.posts} castShadow />
      <StaticInstances geometry={signGeo} material={mats.sign40} matrices={APPROACH.signs[40]} castShadow />
      <StaticInstances geometry={signGeo} material={mats.sign20} matrices={APPROACH.signs[20]} castShadow />
      <StaticInstances geometry={chevronGeo} material={mats.chevronLeft} matrices={APPROACH.chevrons.left} castShadow />
      <StaticInstances geometry={chevronGeo} material={mats.chevronRight} matrices={APPROACH.chevrons.right} castShadow />
      <Suspense fallback={null}>
        <Cones />
      </Suspense>
    </>
  )
}

export default function RoadDressing() {
  return (
    <>
      <ReflectorPosts />
      <GapApproach />
    </>
  )
}
