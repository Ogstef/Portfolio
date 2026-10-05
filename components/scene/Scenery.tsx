'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { TRACK_LENGTH } from '@/lib/trackPath'
import { mulberry32, pick, range, type Rand } from '@/lib/random'
import { isBlocked, overVoid, trackToWorld } from '@/lib/placement'
import { ENV_ASSETS, ENV_USE_DRACO } from '@/lib/envAssets'

// Desert vegetation and rocks from Kenney's Nature Kit (CC0 — see
// public/models/env/CREDITS.md), recoloured to the dusk palette. Each kind
// is baked once into a single vertex-coloured geometry normalised to unit
// height, then drawn as one InstancedMesh — one draw call per kind however
// many are placed. Visual only except the far mesas (see Mesas below).

const ROCK = { dirt: '#6b5b4a', grass: '#857260', _defaultMat: '#5c4d3f' }
const MESA = { dirt: '#8a5a3c', grass: '#a06e48', _defaultMat: '#7a4e34' }

type Kind = {
  node?: string // GLB node name; absent = procedural (see barrelGeometry)
  palette: Record<string, string> // GLB material name → colour
  height: [number, number] // metres, randomised per instance
  aspect: number // footprint diameter ÷ height of the model (measured), for clearances
  widen?: number // extra x/z scale — turns a rock pillar into a mesa
  sink?: number // fraction of height buried, so rocks sit in the dirt
  castShadow: boolean
}

const KINDS = {
  saguaroTall: { node: 'cactus_tall', palette: { leafsGreen: '#3f6b45' }, height: [3.2, 5], aspect: 0.55, castShadow: true },
  saguaroShort: { node: 'cactus_short', palette: { leafsGreen: '#46744a' }, height: [2, 3.2], aspect: 0.65, castShadow: true },
  // No CC0 barrel cactus in any pack checked — procedural stand-in.
  barrel: { palette: {}, height: [0.6, 1.1], aspect: 1, castShadow: true },
  boulderA: { node: 'rock_largeA', palette: ROCK, height: [0.7, 1.6], aspect: 3.9, sink: 0.12, castShadow: true },
  boulderC: { node: 'rock_largeC', palette: ROCK, height: [0.8, 1.8], aspect: 3.3, sink: 0.12, castShadow: true },
  boulderD: { node: 'rock_largeD', palette: ROCK, height: [1, 2.2], aspect: 1.9, sink: 0.12, castShadow: true },
  boulderF: { node: 'rock_largeF', palette: ROCK, height: [0.9, 2], aspect: 2.3, sink: 0.12, castShadow: true },
  mesa: { node: 'rock_tallE', palette: MESA, height: [6, 14], aspect: 1.2, widen: 1.8, sink: 0.04, castShadow: true },
  butte: { node: 'rock_tallB', palette: MESA, height: [7, 12], aspect: 0.9, widen: 1.5, sink: 0.04, castShadow: true },
  snag: { node: 'stump_oldTall', palette: { dirt: '#6e5a48' }, height: [3, 5], aspect: 0.56, castShadow: true },
  acacia: { node: 'tree_plateau', palette: { dirt: '#4a3626', leafsGreen: '#6b7a3f' }, height: [4, 6], aspect: 0.52, castShadow: true },
  shrub: { node: 'plant_bush', palette: { grass: '#7a7545' }, height: [0.5, 1], aspect: 1.62, castShadow: true },
  shrubDry: { node: 'plant_bushDetailed', palette: { grass: '#8a7a4a' }, height: [0.6, 1.1], aspect: 1.67, castShadow: true },
  tuft: { node: 'grass', palette: { grass: '#a08a55' }, height: [0.25, 0.45], aspect: 1.6, castShadow: false },
  tuftLarge: { node: 'grass_large', palette: { grass: '#8f7d4a' }, height: [0.3, 0.55], aspect: 1.61, castShadow: false },
} satisfies Record<string, Kind>

type KindId = keyof typeof KINDS
const KIND_IDS = Object.keys(KINDS) as KindId[]

const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })

// ─── Geometry baking ──────────────────────────────────────────────────────

// meshopt-quantised attributes are normalised ints; applyMatrix4 on those
// would re-quantise into [-1,1] and clip, so expand to float first.
function toFloat(attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
  const out = new Float32Array(attr.count * 3)
  for (let i = 0; i < attr.count; i++) {
    out[i * 3] = attr.getX(i)
    out[i * 3 + 1] = attr.getY(i)
    out[i * 3 + 2] = attr.getZ(i)
  }
  return new THREE.BufferAttribute(out, 3)
}

function paint(geo: THREE.BufferGeometry, colorOf: (y: number) => THREE.Color) {
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) colorOf(pos.getY(i)).toArray(colors, i * 3)
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

// Centre on x/z, base at y=0, height 1 — so instance scale = height in metres.
function normalise(geo: THREE.BufferGeometry) {
  geo.computeBoundingBox()
  const box = geo.boundingBox!
  const h = box.max.y - box.min.y
  geo.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2)
  geo.scale(1 / h, 1 / h, 1 / h)
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

function bakeNode(root: THREE.Object3D, palette: Record<string, string>) {
  root.updateWorldMatrix(true, true)
  const parts: THREE.BufferGeometry[] = []
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const src = mesh.geometry
    let g = new THREE.BufferGeometry()
    g.setAttribute('position', toFloat(src.attributes.position))
    g.setAttribute('normal', toFloat(src.attributes.normal))
    if (src.index) g.setIndex(Array.from(src.index.array))
    g.applyMatrix4(mesh.matrixWorld)
    if (g.index) g = g.toNonIndexed()
    const color = new THREE.Color(palette[(mesh.material as THREE.Material).name] ?? '#6b5b4a')
    paint(g, () => color)
    parts.push(g)
  })
  return normalise(mergeGeometries(parts)!)
}

// Ribbed, slightly squat sphere with a yellow flower crown.
function barrelGeometry() {
  const sphere = new THREE.SphereGeometry(0.5, 24, 10)
  const pos = sphere.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const rib = 1 + 0.07 * Math.cos(12 * Math.atan2(z, x))
    pos.setXYZ(i, x * rib, Math.max(pos.getY(i) * 1.15, -0.3), z * rib)
  }
  const geo = sphere.toNonIndexed()
  geo.deleteAttribute('uv')
  geo.computeVertexNormals()
  const green = new THREE.Color('#4f7a4a')
  const crown = new THREE.Color('#d9a441')
  paint(geo, (y) => (y > 0.52 ? crown : green))
  return normalise(geo)
}

// ─── Layout ───────────────────────────────────────────────────────────────

type Item = { kind: KindId; x: number; z: number; h: number; rotY: number }

// Scenery runs past both ends of the road (trackToWorld extrapolates) so
// the open ground beyond the finale doesn't feel like the edge of the map.
const S_MIN = -40
const S_MAX = TRACK_LENGTH + 90

const CLUSTER_COUNT = 25
const CLUSTER_SPACING = 1.4
const SINGLE_COUNT = 90
const MESA_COUNT = 8
const TUFT_COUNT = 600

const ANCHORS: KindId[] = ['saguaroTall', 'saguaroTall', 'boulderD', 'boulderF', 'acacia', 'snag']
const FILL: KindId[] = ['saguaroShort', 'barrel', 'barrel', 'shrub', 'shrubDry', 'shrub', 'boulderA', 'boulderC']
// Weighted towards tall silhouettes — they're what reads from the road.
const SINGLES: KindId[] = [
  'saguaroTall', 'saguaroTall', 'saguaroTall', 'saguaroShort', 'saguaroShort',
  'acacia', 'snag', 'barrel', 'shrub', 'shrubDry', 'boulderC', 'boulderD',
]

// Density falloff: sparse right by the road (keeps it readable), densest
// 15–45 m out, thinning again towards 90 m.
function sampleLateral(rand: Rand) {
  const r = rand()
  const mag = r < 0.15 ? range(rand, 6, 15) : r < 0.75 ? range(rand, 15, 45) : range(rand, 45, 90)
  return (rand() < 0.5 ? -1 : 1) * mag
}

function layout() {
  const rand = mulberry32(1001)
  const items: Item[] = []

  const place = (kind: KindId, s: number, lateral: number) => {
    const k: Kind = KINDS[kind]
    const h = range(rand, k.height[0], k.height[1])
    const rotY = rand() * Math.PI * 2
    const radius = (k.aspect * h * (k.widen ?? 1)) / 2
    if (isBlocked(s, lateral, h, radius)) return false
    const p = trackToWorld(s, lateral)
    items.push({ kind, x: p.x, z: p.z, h, rotY })
    return true
  }

  // Clusters — an anchor (big cactus / boulder / tree) with 2–7 smaller
  // companions around it, kept a minimum distance apart.
  for (let c = 0; c < CLUSTER_COUNT; c++) {
    const s0 = range(rand, S_MIN, S_MAX)
    const l0 = sampleLateral(rand)
    const taken: Array<[number, number]> = []
    const n = 3 + Math.floor(rand() * 6)
    for (let i = 0; i < n; i++) {
      const kind = i === 0 ? pick(rand, ANCHORS) : pick(rand, FILL)
      for (let attempt = 0; attempt < 6; attempt++) {
        const ang = rand() * Math.PI * 2
        const dist = i === 0 ? 0 : range(rand, 1.5, 6)
        const ds = Math.cos(ang) * dist
        const dl = Math.sin(ang) * dist
        if (taken.some(([a, b]) => Math.hypot(a - ds, b - dl) < CLUSTER_SPACING)) continue
        if (Math.sign(l0 + dl) !== Math.sign(l0)) continue // never spill across the road
        if (place(kind, s0 + ds, l0 + dl)) {
          taken.push([ds, dl])
          break
        }
      }
    }
  }

  for (let i = 0; i < SINGLE_COUNT; i++) place(pick(rand, SINGLES), range(rand, S_MIN, S_MAX), sampleLateral(rand))

  // Mesas: evenly spread along the route, alternating sides, far out.
  // Nudged along the route until clear of every canyon void — a mesa's
  // footprint reaches ~13 m from its centre at the largest size.
  const mesas: Item[] = []
  for (let i = 0; i < MESA_COUNT; i++) {
    const kind: KindId = rand() < 0.6 ? 'mesa' : 'butte'
    let s = S_MIN + ((i + 0.5) / MESA_COUNT) * (S_MAX - S_MIN) + range(rand, -10, 10)
    const lateral = (i % 2 === 0 ? -1 : 1) * range(rand, 60, 120)
    const [lo, hi] = KINDS[kind].height
    const h = range(rand, lo, hi)
    const rotY = rand() * Math.PI * 2
    let p = trackToWorld(s, lateral)
    while (overVoid(p.z, 16)) p = trackToWorld((s += 5), lateral)
    mesas.push({ kind, x: p.x, z: p.z, h, rotY })
  }

  // Ground tufts hugging the road edge — biased towards the shoulder.
  // Ramps and stop zones block a lot of this narrow band, so keep drawing
  // until the target count actually lands.
  for (let placed = 0, guard = 0; placed < TUFT_COUNT && guard < TUFT_COUNT * 5; guard++) {
    const kind: KindId = rand() < 0.7 ? 'tuft' : 'tuftLarge'
    const lateral = (rand() < 0.5 ? -1 : 1) * (6 + 14 * rand() ** 2)
    if (place(kind, range(rand, 0, TRACK_LENGTH), lateral)) placed++
  }

  const byKind = {} as Record<KindId, Item[]>
  for (const id of KIND_IDS) byKind[id] = []
  for (const it of [...items, ...mesas]) byKind[it.kind].push(it)
  return { byKind, mesas }
}

// Seeded and pure — computed once per page load, not per render.
const LAYOUT = layout()

// ─── Rendering ────────────────────────────────────────────────────────────

const UP = new THREE.Vector3(0, 1, 0)

function KindInstances({ kind, geometry, items }: { kind: Kind; geometry: THREE.BufferGeometry; items: Item[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const p = new THREE.Vector3()
    const s = new THREE.Vector3()
    const widen = kind.widen ?? 1
    items.forEach((it, i) => {
      p.set(it.x, -it.h * (kind.sink ?? 0.02), it.z)
      q.setFromAxisAngle(UP, it.rotY)
      s.set(it.h * widen, it.h, it.h * widen)
      mesh.setMatrixAt(i, m.compose(p, q, s))
    })
    mesh.instanceMatrix.needsUpdate = true
    // Bounds from the real instance transforms, so frustum culling is right.
    mesh.computeBoundingSphere()
  }, [kind, items])

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, items.length]}
      castShadow={kind.castShadow}
      receiveShadow
    />
  )
}

// Mesas are big enough to be worth driving to, so each gets a plain box
// collider a little inside its visual footprint (never a trimesh).
function MesaColliders({ mesas, geometries }: { mesas: Item[]; geometries: Record<KindId, THREE.BufferGeometry> }) {
  return (
    <>
      {mesas.map((m, i) => {
        const kind = KINDS[m.kind] as Kind
        const size = geometries[m.kind].boundingBox!.getSize(new THREE.Vector3())
        const widen = kind.widen ?? 1
        const hx = (size.x * m.h * widen * 0.8) / 2
        const hz = (size.z * m.h * widen * 0.8) / 2
        const hy = m.h / 2
        return (
          <RigidBody key={i} type="fixed" colliders={false} position={[m.x, 0, m.z]} rotation={[0, m.rotY, 0]}>
            <CuboidCollider args={[hx, hy, hz]} position={[0, hy, 0]} />
          </RigidBody>
        )
      })}
    </>
  )
}

export default function Scenery() {
  const { nodes } = useGLTF(ENV_ASSETS.nature, ENV_USE_DRACO)

  const geometries = useMemo(() => {
    const out = {} as Record<KindId, THREE.BufferGeometry>
    for (const id of KIND_IDS) {
      const kind: Kind = KINDS[id]
      out[id] = kind.node ? bakeNode(nodes[kind.node], kind.palette) : barrelGeometry()
    }
    return out
  }, [nodes])

  const { byKind, mesas } = LAYOUT

  return (
    <group>
      {KIND_IDS.map((id) =>
        byKind[id].length > 0 ? <KindInstances key={id} kind={KINDS[id]} geometry={geometries[id]} items={byKind[id]} /> : null,
      )}
      <MesaColliders mesas={mesas} geometries={geometries} />
    </group>
  )
}
