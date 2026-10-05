'use client'

import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import { Instances, Instance, Line, useGLTF } from '@react-three/drei'
import { TRACK_LENGTH, getFrameAtDistance } from '@/lib/trackPath'
import { GAPS } from '@/lib/gapJump'
import {
  POLE_LATERAL,
  RAMPS,
  crossesStopSightline,
  inGapSpan,
  inStopCorridor,
  isClearanceBlocked,
  trackToWorld,
} from '@/lib/placement'
import { getChevronTexture, getJumpSignTexture } from '@/lib/canvasTextures'
import { ENV_ASSETS, ENV_USE_DRACO } from '@/lib/envAssets'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import StaticInstances, { GltfInstances, placeMatrix } from './StaticInstances'
import { wallFaceZ } from './CanyonWalls'

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
      const { position, right, yaw } = getFrameAtDistance(s)
      for (const side of [-1, 1]) {
        if (RAMPS.some((r) => r.side === side && Math.abs(s - r.s) < RAMP_CLEAR)) continue
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

// ─── Telephone line ───────────────────────────────────────────────────────
// Wooden poles down the left of the road with two sagging wires. The line
// breaks wherever a span would cross a canyon (snapped wires dangle into
// the void) or a stop camera's sightline to its sign (ends dangle loose).

const POLE_SPACING = 25
const POLE_H = 7.2
const ARM_Y = 6.6
const ARM_HALF = 0.75 // crossarm half-length; the two wires hang from its ends
const WIRE_Y = ARM_Y + 0.15
const MAX_SPAN = 32 // longer than this (a pole was skipped) → break the line
const SAG_PER_M2 = 0.0014 // catenary sag ≈ k·span², ~0.9 m on a 25 m span

const poleGeo = mergeGeometries([
  new THREE.CylinderGeometry(0.11, 0.15, POLE_H, 7).translate(0, POLE_H / 2, 0),
  new THREE.BoxGeometry(ARM_HALF * 2 + 0.2, 0.14, 0.12).translate(0, ARM_Y, 0), // crossarm across the road direction
  ...[-1, 1].map((k) => new THREE.CylinderGeometry(0.05, 0.05, 0.16, 6).translate(k * ARM_HALF, ARM_Y + 0.13, 0)),
])!
const poleMat = new THREE.MeshStandardMaterial({ color: '#4d3b2b', roughness: 1 })

type Vec3 = [number, number, number]

// Sagging wire between two points as a polyline (parabolic approximation).
// Never dips below the ground: a span that would sag into the dirt (e.g.
// down to a canyon lip) lies along it instead.
const WIRE_GROUND_Y = 0.04
function catenary(a: Vec3, b: Vec3, steps = 16): Vec3[] {
  const span = Math.hypot(b[0] - a[0], b[2] - a[2])
  const sag = SAG_PER_M2 * span * span
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    const y = a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t)
    return [a[0] + (b[0] - a[0]) * t, Math.max(WIRE_GROUND_Y, y), a[2] + (b[2] - a[2]) * t] as Vec3
  })
}

// Loose end hanging from an attach point, drifting `dir` (unit XZ) a little.
function dangle(a: Vec3, dir: [number, number], drop: number): Vec3[] {
  return [0, 0.25, 0.5, 0.75, 1].map((t) => [a[0] + dir[0] * 1.2 * t, a[1] - drop * t * t, a[2] + dir[1] * 1.2 * t] as Vec3)
}

type Pole = { s: number; x: number; z: number; yaw: number }

function buildTelephoneLine() {
  const poles: Pole[] = []
  for (let s0 = 6; s0 < TRACK_LENGTH; s0 += POLE_SPACING) {
    // A blocked slot slides up to 8 m either way before it's dropped.
    const s = [0, -3, 3, -6, 6, -8, 8].map((d) => s0 + d).find((c) => !isClearanceBlocked(c, POLE_LATERAL, POLE_H, 0.3))
    if (s === undefined) continue
    const p = trackToWorld(s, POLE_LATERAL)
    poles.push({ s, x: p.x, z: p.z, yaw: getFrameAtDistance(s).yaw })
  }

  // Wire attach points: the crossarm runs along the track's right vector.
  const attach = (pole: Pole, k: number): Vec3 => {
    const { right } = getFrameAtDistance(pole.s)
    return [pole.x + right.x * k * ARM_HALF, WIRE_Y, pole.z + right.z * k * ARM_HALF]
  }

  const segments: Vec3[] = [] // pairs, for one <Line segments> draw
  const addPolyline = (pts: Vec3[]) => {
    for (let i = 0; i < pts.length - 1; i++) segments.push(pts[i], pts[i + 1])
  }

  // Snapped wire over a canyon edge: lies over the lip, then hangs down the
  // rock face — draped just clear of the wall surface (CanyonWalls'
  // wallFaceZ), never through it. `length` = metres hanging below the lip.
  const drape = (gapIndex: number, which: 'near' | 'far', lip: Vec3, length: number): Vec3[] => {
    const out = which === 'near' ? 1 : -1 // direction into the void along Z
    const pts: Vec3[] = [[lip[0], 0.04, lip[2] + out * 0.05]]
    for (const y of [-0.15, -0.5, -1, -1.6, -2.3, -3.1, -4, -5].filter((y) => -y <= length)) {
      pts.push([lip[0] + y * 0.04, y, wallFaceZ(gapIndex, which, lip[0], y)])
    }
    return pts
  }

  for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i]
    const b = poles[i + 1]
    const gapIndex = GAPS.findIndex((g) => g.baseDistance > a.s && g.baseDistance < b.s)
    const gap = GAPS[gapIndex]
    const along: [number, number] = [(b.x - a.x) / Math.hypot(b.x - a.x, b.z - a.z), (b.z - a.z) / Math.hypot(b.x - a.x, b.z - a.z)]

    for (const k of [-1, 1]) {
      const pa = attach(a, k)
      const pb = attach(b, k)
      if (gap) {
        // Snapped over the canyon: each side sags to the lip, then hangs
        // down the wall into the void.
        const [za, zb] = gap.getVoidZBounds()
        const xAtZ = (z: number) => pa[0] + (pb[0] - pa[0]) * ((z - pa[2]) / (pb[2] - pa[2]))
        const lipA: Vec3 = [xAtZ(za), 0.04, za - 0.06]
        const lipB: Vec3 = [xAtZ(zb), 0.04, zb + 0.06]
        addPolyline([...catenary(pa, lipA), ...drape(gapIndex, 'near', lipA, 4.2 + k * 0.7)])
        addPolyline([...catenary(pb, lipB), ...drape(gapIndex, 'far', lipB, 3.4 - k * 0.6)])
      } else if (Math.hypot(b.x - a.x, b.z - a.z) > MAX_SPAN || crossesStopSightline(a.x, a.z, b.x, b.z)) {
        // Broken span (a skipped pole, or it would cut across a stop's
        // cutscene view): loose ends hang from both poles.
        addPolyline(dangle(pa, along, 2.6 + k * 0.4))
        addPolyline(dangle(pb, [-along[0], -along[1]], 2.4 - k * 0.3))
      } else {
        addPolyline(catenary(pa, pb))
      }
    }
  }

  // Yaw = track yaw puts the crossarm (local X) along the right vector,
  // i.e. across the road, matching attach().
  const poleMatrices = poles.map((p) => placeMatrix(p.x, 0, p.z, p.yaw))
  return { poleMatrices, segments }
}

const TELEPHONE = buildTelephoneLine()

function TelephoneLine() {
  return (
    <>
      <StaticInstances geometry={poleGeo} material={poleMat} matrices={TELEPHONE.poleMatrices} castShadow />
      <Line points={TELEPHONE.segments} segments color="#1a1512" lineWidth={1.1} />
    </>
  )
}

export default function RoadDressing() {
  return (
    <>
      <ReflectorPosts />
      <GapApproach />
      <TelephoneLine />
    </>
  )
}
