'use client'

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GAPS, type GapJump } from '@/lib/gapJump'
import { getFrameAtDistance } from '@/lib/trackPath'
import { createNoise2D, mulberry32, range } from '@/lib/random'
import StaticInstances, { placeMatrix } from './StaticInstances'

// Turns each gap-jump void (lib/gapJump.ts) from a hole in a table into a
// canyon: jagged strata walls down both edges, a dark floor with a dry
// riverbed, and broken rock along the lips. Visual only — NO colliders: a
// car that misses still falls past FallSafety's FALL_Y (-8) and respawns
// long before it would reach the floor at -30.
//
// The void is an axis-aligned world-Z band spanning the whole map width
// (Ground.tsx), so the walls run along world X, centred on the road and
// long enough to reach the fog line either way.

const HALF_SPAN = 150 // walls/floor extend ±this along X from the road
const DEPTH = 31 // walls run from y=0 down past the floor
const FLOOR_Y = -30
const STEP_X = 2.5
const STEP_Y = 1.55
const MAX_BULGE = 1.1 // how far a wall juts into the void (the void is only 5 m)
const RIM_SPAN = 60 // rim dressing extends ±this along X
const ROAD_CLEAR = 6 // no rim rocks/roots this close to the road crossing

const wallMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide })
const floorMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })
const rockGeo = new THREE.IcosahedronGeometry(0.5, 0)
const rockMat = new THREE.MeshStandardMaterial({ color: '#5e4a3a', roughness: 1, flatShading: true })
const rootGeo = new THREE.CylinderGeometry(0.03, 0.06, 1, 4).translate(0, -0.5, 0) // hangs down from its top
const rootMat = new THREE.MeshStandardMaterial({ color: '#2e2219', roughness: 1 })

const ROCK_DARK = new THREE.Color('#4a3628')
const ROCK_MID = new THREE.Color('#5c4432')
const BAND_LIGHT = new THREE.Color('#8a6a4e')
const BAND_MID = new THREE.Color('#6e5240')
const LIP = new THREE.Color('#7a5a40')

function voidCenterX(gap: GapJump) {
  return getFrameAtDistance((gap.launchPlatEnd + gap.landingPlatStart) / 2).position.x
}

// One wall as an indexed grid in the X/Y plane at z = `edgeZ`, displaced
// `facing` (+1 = towards +Z) into the void by layered noise. The top row is
// pinned to the edge so it meets the ground slab without a seam.
function buildWall(cx: number, edgeZ: number, facing: 1 | -1, seed: number) {
  const noise = createNoise2D(seed)
  const cols = Math.round((HALF_SPAN * 2) / STEP_X)
  const rows = Math.round(DEPTH / STEP_Y)
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const c = new THREE.Color()

  for (let r = 0; r <= rows; r++) {
    const y = -(r / rows) * DEPTH
    for (let k = 0; k <= cols; k++) {
      const x = cx - HALF_SPAN + k * STEP_X
      const n =
        noise(x * 0.12, y * 0.18) * 0.6 + noise(x * 0.35, y * 0.5) * 0.3 + noise(x * 1.1, y * 1.3) * 0.1
      // Pinned at the lip, full bulge from ~3 m down.
      const reach = Math.min(1, -y / 3)
      const bulge = n * MAX_BULGE * reach
      positions.push(x + (noise(x * 0.5 + 9, y * 0.5) - 0.5) * 0.8 * reach, y, edgeZ + facing * bulge)

      // Strata: wavy horizontal bands, darker with depth.
      const wobble = (noise(x * 0.05, 3.3) - 0.5) * 2.2
      const d = -y + wobble
      if (r === 0 || -y < 0.7) c.copy(LIP)
      else if (d > 5 && d < 7) c.copy(BAND_LIGHT)
      else if (d > 13.5 && d < 15) c.copy(BAND_MID)
      else c.copy(ROCK_DARK).lerp(ROCK_MID, n)
      c.multiplyScalar(THREE.MathUtils.lerp(1, 0.4, -y / DEPTH))
      colors.push(c.r, c.g, c.b)
    }
  }

  const stride = cols + 1
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const a = r * stride + k
      const b = a + 1
      const d = a + stride
      const e = d + 1
      if (facing === 1) indices.push(a, d, b, b, d, e)
      else indices.push(a, b, d, b, e, d)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

// Floor plane across the void plus a faint blue dry-riverbed strip down
// its middle, both vertex-coloured so they merge into one draw.
function buildFloor(cx: number, za: number, zb: number) {
  const paint = (geo: THREE.BufferGeometry, hex: string) => {
    const col = new THREE.Color(hex)
    const n = geo.attributes.position.count
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) col.toArray(arr, i * 3)
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    geo.deleteAttribute('uv')
    return geo
  }
  const width = zb - za
  const floor = paint(new THREE.PlaneGeometry(HALF_SPAN * 2, width + MAX_BULGE * 2).rotateX(-Math.PI / 2), '#2a1f17')
  floor.translate(cx, FLOOR_Y, (za + zb) / 2)
  const river = paint(new THREE.PlaneGeometry(HALF_SPAN * 2, width * 0.28).rotateX(-Math.PI / 2), '#34465a')
  river.translate(cx, FLOOR_Y + 0.04, (za + zb) / 2)
  return [floor, river]
}

type Dressing = { rocks: THREE.Matrix4[]; roots: THREE.Matrix4[] }

function buildDressing(): Dressing {
  const rand = mulberry32(6060)
  const rocks: THREE.Matrix4[] = []
  const roots: THREE.Matrix4[] = []

  for (const gap of GAPS) {
    const cx = voidCenterX(gap)
    const [za, zb] = gap.getVoidZBounds()

    // Broken rock along both lips — mostly on solid ground, a few hanging
    // over the edge.
    for (const [edge, out] of [[za, -1], [zb, 1]] as const) {
      for (let x = cx - RIM_SPAN; x < cx + RIM_SPAN; x += range(rand, 1.4, 4)) {
        if (Math.abs(x - cx) < ROAD_CLEAR) continue
        const sc = range(rand, 0.3, 1)
        const z = edge + out * range(rand, -0.15, 1.3)
        rocks.push(placeMatrix(x, sc * 0.15, z, rand() * Math.PI * 2, [sc * range(rand, 0.9, 1.6), sc * 0.7, sc]))
      }
      // Dead roots dangling down the wall face.
      for (let i = 0; i < 9; i++) {
        let x = cx + range(rand, -RIM_SPAN, RIM_SPAN)
        if (Math.abs(x - cx) < ROAD_CLEAR) x += Math.sign(x - cx || 1) * ROAD_CLEAR
        const m = placeMatrix(x, -0.05, edge - out * 0.08, 0, [1, range(rand, 0.8, 2.6), 1])
        // Tilt the free end out over the void, away from the wall face.
        m.multiply(new THREE.Matrix4().makeRotationX(out * range(rand, 0.05, 0.35)))
        roots.push(m)
      }
    }

    // A few boulders on the canyon floor.
    for (let i = 0; i < 7; i++) {
      const sc = range(rand, 0.8, 1.8)
      rocks.push(
        placeMatrix(cx + range(rand, -40, 40), FLOOR_Y + sc * 0.2, range(rand, za + 0.5, zb - 0.5), rand() * Math.PI * 2, [sc, sc * 0.6, sc]),
      )
    }
  }

  return { rocks, roots }
}

// Deterministic — built once per page load.
const WALLS = mergeGeometries(
  GAPS.flatMap((gap, i) => {
    const cx = voidCenterX(gap)
    const [za, zb] = gap.getVoidZBounds()
    return [buildWall(cx, za, 1, 900 + i * 2), buildWall(cx, zb, -1, 901 + i * 2)]
  }),
)!
const FLOORS = mergeGeometries(
  GAPS.flatMap((gap) => {
    const [za, zb] = gap.getVoidZBounds()
    return buildFloor(voidCenterX(gap), za, zb)
  }),
)!
const DRESSING = buildDressing()

export default function CanyonWalls() {
  return (
    <group>
      <mesh geometry={WALLS} material={wallMat} />
      <mesh geometry={FLOORS} material={floorMat} />
      <StaticInstances geometry={rockGeo} material={rockMat} matrices={DRESSING.rocks} castShadow receiveShadow />
      <StaticInstances geometry={rootGeo} material={rootMat} matrices={DRESSING.roots} />
    </group>
  )
}
