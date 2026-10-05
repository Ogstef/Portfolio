'use client'

import { Suspense, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Project } from '@/data/projects'
import { projects } from '@/data/projects'
import { getNeonTexture, getPanelTexture } from '@/lib/canvasTextures'
import { ENV_ASSETS, ENV_USE_DRACO } from '@/lib/envAssets'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'
import StaticInstances, { GltfInstances, placeMatrix } from './StaticInstances'

// A small themed set piece behind each project's sign (ENVIRONMENT_PLAN.md
// Phase 4). Everything sits BEHIND the sign — further from the road than
// it — so it frames the billboard as a backdrop in the stop cutscene
// instead of blocking it (the camera parks across the road, see
// FollowCamera.tsx / SIGN_APPROACH). Visual only, no colliders; each
// diorama stays within ~12 draw calls. One sub-component per stop so any
// one can be reworked without touching the others.
//
// Local frame per stop: origin at the sign, `a` metres along the road
// (forward = direction of travel), `o` metres outward away from the road.

type Side = 1 | -1
type Vec3 = [number, number, number]

// Local (along, outward, up) → group-space position for this stop's side.
function at(side: Side, a: number, o: number, y = 0): Vec3 {
  return [o * side, y, a]
}

// Yaw that turns a model's front (+Z) to face the road / face away from it.
const faceRoad = (side: Side) => (-side * Math.PI) / 2
const faceOut = (side: Side) => (side * Math.PI) / 2

// Box geometry pre-positioned in group space, for merging static parts that
// share a material into one draw. Sizes are (along-o, height, along-a).
function box(side: Side, oSize: number, h: number, aSize: number, a: number, o: number, y: number) {
  return new THREE.BoxGeometry(oSize, h, aSize).translate(...at(side, a, o, y))
}

function merged(...parts: THREE.BufferGeometry[]) {
  // Drop uv/normal mismatch risk: every part here is a three.js primitive,
  // so attribute sets already match.
  return mergeGeometries(parts)!
}

function std(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra })
}

// Animated glow goes through a mesh ref (refs are meant to be mutated in
// useFrame; memoised materials aren't).
function setGlow(ref: React.RefObject<THREE.Mesh | null>, intensity: number) {
  const mat = ref.current?.material as THREE.MeshStandardMaterial | undefined
  if (mat) mat.emissiveIntensity = intensity
}

function useProps() {
  const { scene } = useGLTF(ENV_ASSETS.props, ENV_USE_DRACO)
  return (name: string) => scene.children.find((o) => o.name === name)!
}

// ─── LedgerX — desert data vault ──────────────────────────────────────────

function LedgerXVault({ side, accent }: { side: Side; accent: string }) {
  const reduced = usePrefersReducedMotion()
  const prop = useProps()
  const ring = useRef<THREE.Mesh>(null)
  const ledA = useRef<THREE.Mesh>(null)
  const ledB = useRef<THREE.Mesh>(null)

  const parts = useMemo(() => {
    const concrete = merged(
      box(side, 6, 3.2, 8, 2, 12, 1.6), // bunker
      box(side, 6.6, 0.3, 8.6, 2, 12, 3.35), // roof slab
      box(side, 0.5, 3.2, 0.6, -2.3, 8.9, 1.6), // door buttresses
      box(side, 0.5, 3.2, 0.6, 6.3, 8.9, 1.6),
    )
    // Vault door + spokes + handle, flush on the road-facing wall (o=9).
    const doorAxis = (g: THREE.BufferGeometry) => g.rotateZ(Math.PI / 2)
    const metal = merged(
      doorAxis(new THREE.CylinderGeometry(1.25, 1.25, 0.25, 24)).translate(...at(side, 2, 8.9, 1.5)),
      box(side, 0.1, 2.1, 0.18, 2, 8.74, 1.5),
      box(side, 0.1, 0.18, 2.1, 2, 8.74, 1.5),
      new THREE.TorusGeometry(0.42, 0.06, 6, 20).rotateY(Math.PI / 2).translate(...at(side, 2, 8.66, 1.5)),
    )
    const ring = new THREE.TorusGeometry(1.45, 0.09, 8, 40).rotateY(Math.PI / 2).translate(...at(side, 2, 8.86, 1.5))
    const racks = merged(box(side, 0.9, 2.1, 0.9, -4.2, 8, 1.05), box(side, 0.9, 2.1, 0.9, -5.3, 8, 1.05))
    // LED strips on each rack's road-facing front, split into two sets that
    // blink in antiphase.
    const led = (a: number, y: number) => box(side, 0.03, 0.06, 0.62, a, 7.53, y)
    const ledA = merged(led(-4.2, 0.6), led(-4.2, 1.6), led(-5.3, 1.1))
    const ledB = merged(led(-4.2, 1.1), led(-5.3, 0.6), led(-5.3, 1.6))
    // Satellite dish on the roof, tilted at the sky.
    const dish = new THREE.SphereGeometry(0.8, 14, 6, 0, Math.PI * 2, 0, 0.9)
      .rotateX(Math.PI)
      .rotateZ(side * 0.7)
      .translate(...at(side, 4.5, 13.5, 4.3))
    return { concrete, metal, ring, racks, ledA, ledB, dish }
  }, [side])

  const mats = useMemo(
    () => ({
      concrete: std('#8d8a84', { roughness: 1 }),
      metal: std('#9aa3ad', { metalness: 0.8, roughness: 0.35 }),
      ring: std(accent, { emissive: accent, emissiveIntensity: 1.2 }),
      racks: std('#1c222c', { roughness: 0.6, metalness: 0.4 }),
      ledA: std('#38ff9a', { emissive: '#38ff9a', emissiveIntensity: 1.5 }),
      ledB: std(accent, { emissive: accent, emissiveIntensity: 1.5 }),
      dish: std('#d8d6d0', { roughness: 0.6, side: THREE.DoubleSide }),
    }),
    [accent],
  )

  useFrame(({ clock }) => {
    if (reduced) return
    const t = clock.elapsedTime
    setGlow(ring, 0.7 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2)))
    const on = Math.floor(t * 2.5) % 2 === 0
    setGlow(ledA, on ? 1.6 : 0.15)
    setGlow(ledB, on ? 0.15 : 1.6)
  })

  const truck = useMemo(() => [placeMatrix(...at(side, 7.8, 4.6), faceRoad(side) + side * 1.2, 1.25)], [side])

  return (
    <>
      <mesh geometry={parts.concrete} material={mats.concrete} castShadow receiveShadow />
      <mesh geometry={parts.metal} material={mats.metal} castShadow />
      <mesh ref={ring} geometry={parts.ring} material={mats.ring} />
      <mesh geometry={parts.racks} material={mats.racks} castShadow />
      <mesh ref={ledA} geometry={parts.ledA} material={mats.ledA} />
      <mesh ref={ledB} geometry={parts.ledB} material={mats.ledB} />
      <mesh geometry={parts.dish} material={mats.dish} castShadow />
      <GltfInstances node={prop('truck')} matrices={truck} castShadow />
    </>
  )
}

// ─── Eurobank CRM — corporate outpost ─────────────────────────────────────

const flagGeo = new THREE.PlaneGeometry(1.6, 1).rotateY(Math.PI / 2).translate(0, 0, 0.8)

function EurobankOutpost({ side, accent }: { side: Side; accent: string }) {
  const reduced = usePrefersReducedMotion()
  const prop = useProps()
  const flag = useRef<THREE.Mesh>(null)

  const parts = useMemo(() => {
    const lot = new THREE.PlaneGeometry(6.2, 13).rotateX(-Math.PI / 2).translate(...at(side, 0, 6, 0.012))
    // Bay lines: 4 bays, 3 m wide, running outward from the road side of the lot.
    const stripes = merged(...[-6, -3, 0, 3, 6].map((a) => box(side, 4.4, 0.01, 0.1, a, 6.6, 0.02)))
    const concrete = merged(
      box(side, 5.4, 0.3, 8.4, 0, 13.5, 0.15), // floor slab
      box(side, 5.8, 0.3, 8.8, 0, 13.5, 3.55), // roof slab
    )
    const columns = merged(
      ...[-1, 1].flatMap((ca) => [-1, 1].map((co) => box(side, 0.22, 3.1, 0.22, ca * 4.05, 13.5 + co * 2.6, 1.85))),
      box(side, 0.08, 7.5, 0.08, -6.6, 9.5, 3.75), // flagpole
    )
    const glass = box(side, 5, 3.1, 8, 0, 13.5, 1.85)
    const desk = merged(box(side, 1, 0.75, 2.4, -1.2, 14.2, 0.68), box(side, 0.5, 1, 0.5, -1.2, 15, 0.8))
    const accentWall = box(side, 0.12, 2.6, 6.5, 0, 15.85, 1.6)
    // Rooftop sign on the road-facing edge.
    const panel = new THREE.PlaneGeometry(5.4, 0.95).rotateY(faceRoad(side)).translate(...at(side, 0, 10.55, 4.2))
    const panelBack = box(side, 0.12, 1.05, 5.6, 0, 10.65, 4.2)
    return { lot, stripes, concrete, columns, glass, desk, accentWall, panel, panelBack }
  }, [side])

  const mats = useMemo(() => {
    const sign = getPanelTexture('EUROBANK CRM', accent, '#ffffff')
    return {
      lot: std('#2a2a2f', { roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      stripes: std('#e8e6df', { roughness: 0.8 }),
      concrete: std('#b9b5ad'),
      columns: std('#2e3238', { metalness: 0.7, roughness: 0.35 }),
      glass: new THREE.MeshStandardMaterial({
        color: '#a8d4f0',
        transparent: true,
        opacity: 0.32,
        roughness: 0.05,
        metalness: 0.3,
        depthWrite: false,
      }),
      desk: std('#5a4632'),
      accentWall: std(accent, { emissive: accent, emissiveIntensity: 0.35 }),
      panel: std('#ffffff', { map: sign, emissiveMap: sign, emissive: '#ffffff', emissiveIntensity: 0.6 }),
      panelBack: std('#22252a'),
      flag: std(accent, { side: THREE.DoubleSide, emissive: accent, emissiveIntensity: 0.15 }),
    }
  }, [accent])

  const cars = useMemo(() => {
    const bay = (a: number) => placeMatrix(...at(side, a, 6.4), faceOut(side), 1.2)
    return { sedan: [bay(-4.5), bay(4.5)], suv: [bay(-1.5)] }
  }, [side])

  useFrame(({ clock }) => {
    if (reduced || !flag.current) return
    flag.current.rotation.y = Math.sin(clock.elapsedTime * 1.7) * 0.25
  })

  return (
    <>
      <mesh geometry={parts.lot} material={mats.lot} receiveShadow />
      <mesh geometry={parts.stripes} material={mats.stripes} />
      <mesh geometry={parts.concrete} material={mats.concrete} castShadow receiveShadow />
      <mesh geometry={parts.columns} material={mats.columns} castShadow />
      <mesh geometry={parts.desk} material={mats.desk} />
      <mesh geometry={parts.accentWall} material={mats.accentWall} />
      <mesh geometry={parts.glass} material={mats.glass} />
      <mesh geometry={parts.panel} material={mats.panel} />
      <mesh geometry={parts.panelBack} material={mats.panelBack} />
      {/* Hinged at the pole: the geometry is offset so it swings about its edge. */}
      <mesh ref={flag} position={at(side, -6.6, 9.5, 6.9)} geometry={flagGeo} material={mats.flag} castShadow />
      <GltfInstances node={prop('sedan')} matrices={cars.sedan} castShadow />
      <GltfInstances node={prop('suv')} matrices={cars.suv} castShadow />
    </>
  )
}

// ─── Trigono — roadside diner ─────────────────────────────────────────────

const BULB_COUNT = 11
const bulbGeo = new THREE.SphereGeometry(0.09, 8, 6)
const STRING_SAG = 0.8

function TrigonoDiner({ side, accent }: { side: Side; accent: string }) {
  const reduced = usePrefersReducedMotion()
  const prop = useProps()

  const parts = useMemo(() => {
    // Food-truck awning on the road-facing flank, angled down and out.
    const awning = new THREE.BoxGeometry(1.3, 0.05, 2.8)
      .rotateZ(side * 0.25) // slopes down towards the road
      .translate(...at(side, -0.2, 5.6, 2.05))
    const counter = box(side, 0.45, 0.08, 2.2, -0.2, 5.75, 1.15)
    // Picnic table set in its own frame (one geometry, instanced twice).
    const table = merged(
      new THREE.BoxGeometry(0.85, 0.07, 1.9).translate(0, 0.76, 0),
      new THREE.BoxGeometry(0.3, 0.06, 1.9).translate(0.68, 0.45, 0),
      new THREE.BoxGeometry(0.3, 0.06, 1.9).translate(-0.68, 0.45, 0),
      ...[-0.8, 0.8].flatMap((z) => [
        new THREE.BoxGeometry(0.07, 0.76, 0.07).translate(0.3, 0.38, z),
        new THREE.BoxGeometry(0.07, 0.76, 0.07).translate(-0.3, 0.38, z),
        new THREE.BoxGeometry(1.5, 0.06, 0.07).translate(0, 0.42, z),
      ]),
    )
    const posts = merged(box(side, 0.14, 3.4, 0.14, -6.2, 10, 1.7), box(side, 0.14, 3.4, 0.14, 6.2, 10, 1.7))
    // Catenary of festoon bulbs between the post tops.
    const points: Vec3[] = []
    for (let i = 0; i <= 24; i++) {
      const t = i / 24
      points.push(at(side, -6.2 + t * 12.4, 10, 3.35 - STRING_SAG * 4 * t * (1 - t)))
    }
    const bulbs: THREE.Matrix4[] = []
    for (let i = 1; i <= BULB_COUNT; i++) {
      const t = i / (BULB_COUNT + 1)
      const [x, y, z] = at(side, -6.2 + t * 12.4, 10, 3.35 - STRING_SAG * 4 * t * (1 - t) - 0.13)
      bulbs.push(placeMatrix(x, y, z))
    }
    const neon = new THREE.PlaneGeometry(1.7, 0.74).rotateY(faceRoad(side)).translate(...at(side, 0.6, 6.25, 2.5))
    return { awning, counter, table, posts, points, bulbs, neon }
  }, [side])

  const mats = useMemo(() => {
    const neon = getNeonTexture('OPEN', '#ff4f7b')
    return {
      awning: std(accent, { roughness: 0.8, emissive: accent, emissiveIntensity: 0.1 }),
      wood: std('#7d5f3f'),
      darkWood: std('#4a3626'),
      bulb: std('#ffd58a', { emissive: '#ffbf5a', emissiveIntensity: 2.2 }),
      neon: std('#ffffff', { map: neon, emissiveMap: neon, emissive: '#ffffff', emissiveIntensity: 1.4, side: THREE.DoubleSide }),
    }
  }, [accent])

  const truck = useMemo(() => [placeMatrix(...at(side, -0.2, 7.1), 0, 1.2)], [side])
  const tables = useMemo(
    () => [placeMatrix(...at(side, -5, 4.3), 0.15), placeMatrix(...at(side, 5.4, 4.6), -0.25)],
    [side],
  )

  // Neon buzz: mostly on, with short random dropouts that recover a few
  // frames later.
  const neon = useRef<THREE.Mesh>(null)
  useFrame(() => {
    if (reduced) return
    const r = Math.random()
    if (r < 0.03) setGlow(neon, 0.2)
    else if (r < 0.2) setGlow(neon, 1.4)
  })

  return (
    <>
      <GltfInstances node={prop('delivery')} matrices={truck} castShadow />
      <mesh geometry={parts.awning} material={mats.awning} castShadow />
      <mesh geometry={parts.counter} material={mats.wood} />
      <StaticInstances geometry={parts.table} material={mats.wood} matrices={tables} castShadow receiveShadow />
      <mesh geometry={parts.posts} material={mats.darkWood} castShadow />
      <Line points={parts.points} color="#1c1612" lineWidth={1.2} />
      <StaticInstances geometry={bulbGeo} material={mats.bulb} matrices={parts.bulbs} />
      <mesh ref={neon} geometry={parts.neon} material={mats.neon} />
    </>
  )
}

// ─── Gumroad — field camp ─────────────────────────────────────────────────

// Ridge tent: a triangular prism lying along local Z, base on the ground.
const TENT_R = 1.3
const tentGeo = new THREE.CylinderGeometry(TENT_R, TENT_R, 2.8, 3, 1)
  .rotateX(-Math.PI / 2) // axis along Z, apex up, base edge at y = -R/2
  .translate(0, TENT_R / 2, 0)
// Dark doorway triangle on the tent's front (+Z) end.
const tentDoorGeo = new THREE.ShapeGeometry(
  new THREE.Shape([new THREE.Vector2(-0.55, 0), new THREE.Vector2(0.55, 0), new THREE.Vector2(0, 1.25)]),
).translate(0, 0.01, 1.41)
const sandbagGeo = new THREE.CapsuleGeometry(0.17, 0.46, 2, 6).rotateX(Math.PI / 2).scale(1, 0.7, 1)
const stoneGeo = new THREE.IcosahedronGeometry(0.17, 0)
const logsGeo = mergeGeometries(
  [0, 1, 2, 3].map((i) =>
    // Base out at the stone ring, leaning in so the tops meet: a teepee.
    new THREE.CylinderGeometry(0.06, 0.07, 1.1, 5)
      .translate(0, 0.55, 0)
      .rotateZ(-0.55)
      .translate(-0.5, 0, 0)
      .rotateY((i * Math.PI) / 2),
  ),
)!
const flameGeo = new THREE.ConeGeometry(0.32, 0.95, 7).translate(0, 0.47, 0)

function GumroadCamp({ side, accent }: { side: Side; accent: string }) {
  const reduced = usePrefersReducedMotion()
  const prop = useProps()
  const flame = useRef<THREE.Mesh>(null)
  const fireLight = useRef<THREE.PointLight>(null)

  const layout = useMemo(() => {
    const tents = [
      placeMatrix(...at(side, -3.4, 10.5), faceRoad(side) + 0.35),
      placeMatrix(...at(side, 3, 12.6), faceRoad(side) - 0.3),
    ]
    // Three staggered courses of sandbags in a shallow arc on the road side.
    const sandbags: THREE.Matrix4[] = []
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 9; i++) {
        const a = -3.6 + i * 0.82 + (row % 2) * 0.41
        if (row === 2 && (i === 0 || i === 8)) continue
        const [x, y, z] = at(side, a, 5.2 + 0.035 * a * a, 0.12 + row * 0.22)
        sandbags.push(placeMatrix(x, y, z, Math.atan(0.07 * a) * side))
      }
    }
    const crate = (a: number, o: number, level: number, rot: number) =>
      placeMatrix(...at(side, a, o, level * 0.86), rot, 1.2)
    const crates = [
      crate(6.2, 9, 0, 0.1), crate(7.1, 9, 0, -0.05), crate(6.65, 9.9, 0, 0.3),
      crate(6.6, 9.2, 1, 0.2), crate(6.7, 9.6, 2, -0.15),
    ]
    const fire = at(side, 0, 8.2)
    const stones = Array.from({ length: 9 }, (_, i) => {
      const t = (i / 9) * Math.PI * 2
      return placeMatrix(fire[0] + Math.cos(t) * 0.55, 0.06, fire[2] + Math.sin(t) * 0.55, t)
    })
    return { tents, sandbags, crates, fire, stones }
  }, [side])

  const lantern = useMemo(
    () => ({
      post: merged(box(side, 0.07, 1.45, 0.07, 1.4, 10.8, 0.72), box(side, 0.07, 0.04, 0.36, 1.4, 10.8, 1.43)),
      glass: box(side, 0.22, 0.3, 0.22, 1.4, 10.8, 1.2),
    }),
    [side],
  )

  const mats = useMemo(
    () => ({
      canvas: std('#6b6b3a', { flatShading: true }),
      door: std('#25241a', { side: THREE.DoubleSide }),
      sandbag: std('#a89468', { flatShading: true }),
      stone: std('#5e544a', { flatShading: true }),
      logs: std('#3b2a1c'),
      flame: std('#ff8a2a', { emissive: '#ff6a10', emissiveIntensity: 2.4, transparent: true, opacity: 0.9 }),
      metal: std('#2b2b2b', { metalness: 0.6, roughness: 0.4 }),
      lantern: std(accent, { emissive: accent, emissiveIntensity: 2 }),
    }),
    [accent],
  )

  useFrame(({ clock }) => {
    if (reduced) return
    const t = clock.elapsedTime
    const f = 0.85 + 0.1 * Math.sin(t * 13) + 0.08 * Math.sin(t * 7.3 + 1.7)
    flame.current?.scale.set(1, f, 1)
    if (fireLight.current) fireLight.current.intensity = 18 * f
  })

  return (
    <>
      <StaticInstances geometry={tentGeo} material={mats.canvas} matrices={layout.tents} castShadow receiveShadow />
      <StaticInstances geometry={tentDoorGeo} material={mats.door} matrices={layout.tents} />
      <StaticInstances geometry={sandbagGeo} material={mats.sandbag} matrices={layout.sandbags} castShadow />
      <GltfInstances node={prop('box')} matrices={layout.crates} castShadow />
      <StaticInstances geometry={stoneGeo} material={mats.stone} matrices={layout.stones} />
      <group position={layout.fire}>
        <mesh geometry={logsGeo} material={mats.logs} />
        <mesh ref={flame} geometry={flameGeo} material={mats.flame} />
        {/* The only new real light in the environment pass — short range. */}
        <pointLight ref={fireLight} position={[0, 0.8, 0]} color="#ff8a3a" intensity={18} distance={12} decay={2} />
      </group>
      <mesh geometry={lantern.post} material={mats.metal} />
      <mesh geometry={lantern.glass} material={mats.lantern} />
    </>
  )
}

// ─── Mount ────────────────────────────────────────────────────────────────

const DIORAMAS: Record<string, (props: { side: Side; accent: string }) => React.ReactNode> = {
  ledgerx: LedgerXVault,
  'eurobank-crm': EurobankOutpost,
  trigono: TrigonoDiner,
  gumroad: GumroadCamp,
}

function StopFrame({ project }: { project: Project }) {
  const Diorama = DIORAMAS[project.id]
  if (!Diorama) return null
  const side: Side = project.signX < 0 ? -1 : 1
  const yaw = stopYaw(project, side)
  return (
    <group position={project.signPosition} rotation={[0, yaw, 0]}>
      <Diorama side={side} accent={project.accent} />
    </group>
  )
}

// Track heading at the stop, recovered exactly from the road→sign vector:
// the sign sits along the frame's right vector, right = (cos yaw, 0, -sin yaw).
function stopYaw(project: Project, side: Side) {
  const rx = (project.signPosition[0] - project.position[0]) * side
  const rz = (project.signPosition[2] - project.position[2]) * side
  return Math.atan2(-rz, rx)
}

export default function StopDiorama() {
  return (
    <Suspense fallback={null}>
      {projects.map((p) => (
        <StopFrame key={p.id} project={p} />
      ))}
    </Suspense>
  )
}
