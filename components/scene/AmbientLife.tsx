'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GAPS } from '@/lib/gapJump'
import { getFrameAtDistance } from '@/lib/trackPath'
import { LANDMARKS, trackToWorld } from '@/lib/placement'
import { mulberry32, range } from '@/lib/random'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'

// Things that move (ENVIRONMENT_PLAN.md Phase 5): tumbleweeds, circling
// vultures, a water-pump windmill and a nodding oil pumpjack. All pure
// useFrame animation — no physics, no colliders. Under prefers-reduced-
// motion everything holds its first pose.

// One steady wind for the whole map — tumbleweeds roll with it, the
// windmill faces into it.
const WIND = new THREE.Vector3(1, 0, 0.12).normalize()
const UP = new THREE.Vector3(0, 1, 0)

// Thin cylinder from a to b — for lattice towers and frames.
function strut(a: THREE.Vector3, b: THREE.Vector3, r: number) {
  const dir = new THREE.Vector3().subVectors(b, a)
  const geo = new THREE.CylinderGeometry(r, r, dir.length(), 4)
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()))
  return geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

// ─── Tumbleweeds ──────────────────────────────────────────────────────────

const TUMBLE_PATH = 110 // metres of travel per crossing before wrapping upwind
const TUMBLE_FADE = 10 // shrink in/out over this distance at each end of the path
// Arc-length points where each tumbleweed crosses the road — kept off the
// canyons so none rolls over a void.
const TUMBLE_CROSSINGS = [12, 45, 100, 122, 200, 225, 300, 340]

const tumbleGeo = mergeGeometries([
  new THREE.IcosahedronGeometry(0.5, 1),
  new THREE.IcosahedronGeometry(0.38, 1).rotateX(0.7).rotateZ(0.4),
  new THREE.IcosahedronGeometry(0.44, 0).rotateY(1.1),
])!
const tumbleMat = new THREE.MeshStandardMaterial({ color: '#a88a5c', wireframe: true })

function Tumbleweeds({ reduced }: { reduced: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const weeds = useMemo(() => {
    const rand = mulberry32(3333)
    const rollAxis = new THREE.Vector3().crossVectors(UP, WIND).normalize()
    return TUMBLE_CROSSINGS.map((s) => {
      const crossing = trackToWorld(s, 0)
      return {
        start: crossing.clone().addScaledVector(WIND, -TUMBLE_PATH / 2),
        speed: range(rand, 2.5, 4.5),
        phase: rand() * TUMBLE_PATH,
        scale: range(rand, 0.8, 1.4),
        bounceRate: range(rand, 2.2, 3.4),
        rollAxis,
      }
    })
  }, [])

  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  const sc = useMemo(() => new THREE.Vector3(), [])

  const pose = (mesh: THREE.InstancedMesh, t: number) => {
    weeds.forEach((w, i) => {
      const d = (w.phase + t * w.speed) % TUMBLE_PATH
      const r = 0.5 * w.scale
      p.copy(w.start).addScaledVector(WIND, d)
      p.y = r + Math.abs(Math.sin(t * w.bounceRate + i)) * 0.35
      q.setFromAxisAngle(w.rollAxis, d / r)
      const fade = THREE.MathUtils.smoothstep(Math.min(d, TUMBLE_PATH - d), 0, TUMBLE_FADE)
      sc.setScalar(w.scale * fade)
      mesh.setMatrixAt(i, m.compose(p, q, sc))
    })
    mesh.instanceMatrix.needsUpdate = true
  }

  useLayoutEffect(() => {
    if (ref.current) pose(ref.current, 0)
  })

  useFrame(({ clock }) => {
    if (reduced || !ref.current) return
    pose(ref.current, clock.elapsedTime)
  })

  return <instancedMesh ref={ref} args={[tumbleGeo, tumbleMat, weeds.length]} frustumCulled={false} castShadow />
}

// ─── Vultures ─────────────────────────────────────────────────────────────

// Swept wing in the XZ plane, root at the body, tip out along +X, leading
// edge towards +Z.
const wingGeo = new THREE.ShapeGeometry(
  new THREE.Shape([v3(0, 0.25, 0), v3(1.5, -0.05, 0), v3(1.35, -0.3, 0), v3(0, -0.35, 0)].map((v) => new THREE.Vector2(v.x, v.y))),
).rotateX(Math.PI / 2) // shape +Y (leading edge) → +Z, the flight direction
const wingGeoLeft = wingGeo.clone().scale(-1, 1, 1)
const birdBodyGeo = new THREE.CapsuleGeometry(0.12, 0.6, 2, 6).rotateX(Math.PI / 2)
const birdMat = new THREE.MeshStandardMaterial({ color: '#1f1a17', roughness: 1, side: THREE.DoubleSide })

type Vulture = { center: THREE.Vector3; radius: number; height: number; speed: number; phase: number; dir: 1 | -1 }

function VultureBird({ v, reduced }: { v: Vulture; reduced: boolean }) {
  const group = useRef<THREE.Group>(null)
  const left = useRef<THREE.Mesh>(null)
  const right = useRef<THREE.Mesh>(null)

  const place = (t: number) => {
    const g = group.current
    if (!g) return
    const a = v.phase + t * v.speed * v.dir
    g.position.set(v.center.x + Math.cos(a) * v.radius, v.height + Math.sin(t * 0.3 + v.phase) * 1.5, v.center.z + Math.sin(a) * v.radius)
    // Heading along the circle's tangent, banked into the turn.
    g.rotation.set(0, Math.atan2(-Math.sin(a) * v.dir, Math.cos(a) * v.dir), -0.35 * v.dir, 'YXZ')
    // Vultures mostly soar: a slight dihedral with an occasional burst of flaps.
    const burst = Math.max(0, Math.sin(t * 0.4 + v.phase * 3)) ** 8
    const flap = 0.12 + burst * 0.45 * Math.sin(t * 9)
    if (left.current) left.current.rotation.z = -flap
    if (right.current) right.current.rotation.z = flap
  }

  useLayoutEffect(() => place(0))
  useFrame(({ clock }) => {
    if (!reduced) place(clock.elapsedTime)
  })

  return (
    <group ref={group} scale={1.4}>
      <mesh geometry={birdBodyGeo} material={birdMat} />
      <mesh ref={right} geometry={wingGeo} material={birdMat} />
      <mesh ref={left} geometry={wingGeoLeft} material={birdMat} />
    </group>
  )
}

function Vultures({ reduced }: { reduced: boolean }) {
  const birds = useMemo(() => {
    const rand = mulberry32(4444)
    return GAPS.flatMap((gap) => {
      const mid = getFrameAtDistance((gap.launchPlatEnd + gap.landingPlatStart) / 2).position
      return [0, 1].map(
        (k): Vulture => ({
          center: mid,
          radius: range(rand, 16, 28),
          height: range(rand, 25, 35),
          speed: range(rand, 0.12, 0.2),
          phase: rand() * Math.PI * 2,
          dir: k === 0 ? 1 : -1,
        }),
      )
    })
  }, [])
  return (
    <>
      {birds.map((v, i) => (
        <VultureBird key={i} v={v} reduced={reduced} />
      ))}
    </>
  )
}

// ─── Windmill ─────────────────────────────────────────────────────────────

const TOWER_H = 9
const BASE_HALF = 1.3
const TOP_HALF = 0.35
const WHEEL_R = 2.1
const BLADES = 18

// Lattice tower + platform + tail vane, built in a frame where the wheel
// faces -Z (so the group is yawed to point -Z into the wind).
const towerGeo = (() => {
  const legAt = (h: number, sx: number, sz: number) => {
    const half = THREE.MathUtils.lerp(BASE_HALF, TOP_HALF, h / TOWER_H)
    return v3(sx * half, h, sz * half)
  }
  const corners: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  const parts: THREE.BufferGeometry[] = []
  corners.forEach(([sx, sz]) => parts.push(strut(legAt(0, sx, sz), legAt(TOWER_H, sx, sz), 0.07)))
  const levels = [0.6, 3, 5.6, 7.8]
  levels.forEach((h, li) => {
    corners.forEach(([sx, sz], ci) => {
      const [nx, nz] = corners[(ci + 1) % 4]
      parts.push(strut(legAt(h, sx, sz), legAt(h, nx, nz), 0.04)) // ring
      const next = levels[li + 1]
      if (next !== undefined) {
        parts.push(strut(legAt(h, sx, sz), legAt(next, nx, nz), 0.03)) // X brace
        parts.push(strut(legAt(h, nx, nz), legAt(next, sx, sz), 0.03))
      }
    })
  })
  parts.push(new THREE.BoxGeometry(1.2, 0.1, 1.2).translate(0, TOWER_H, 0)) // platform
  parts.push(new THREE.CylinderGeometry(0.16, 0.2, 0.7, 8).translate(0, TOWER_H + 0.4, 0)) // head
  parts.push(strut(v3(0, TOWER_H + 0.6, 0), v3(0, TOWER_H + 0.6, 2.4), 0.05)) // tail boom
  parts.push(new THREE.BoxGeometry(0.04, 1.1, 1.6).translate(0, TOWER_H + 0.75, 2.9)) // tail vane
  parts.push(strut(v3(0, 0, 0), v3(0, TOWER_H, 0), 0.04)) // pump rod
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => (g.deleteAttribute('uv'), g)))!
})()

// Wheel in the XY plane (axis Z): angled sail blades between two rims.
const wheelGeo = (() => {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < BLADES; i++) {
    const a = (i / BLADES) * Math.PI * 2
    parts.push(
      new THREE.BoxGeometry(0.34, WHEEL_R - 0.55, 0.02)
        .rotateY(0.45) // blade pitch
        .translate(0, (WHEEL_R + 0.55) / 2, 0)
        .rotateZ(a),
    )
  }
  parts.push(new THREE.TorusGeometry(WHEEL_R, 0.03, 4, 36), new THREE.TorusGeometry(0.6, 0.03, 4, 24))
  parts.push(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 10).rotateX(Math.PI / 2))
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => (g.deleteAttribute('uv'), g)))!
})()

const towerMat = new THREE.MeshStandardMaterial({ color: '#6d6a66', roughness: 0.8, metalness: 0.3 })
const wheelMat = new THREE.MeshStandardMaterial({ color: '#c9c4b8', roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide })

function Windmill({ reduced }: { reduced: boolean }) {
  const wheel = useRef<THREE.Group>(null)
  const { position, yaw } = useMemo(() => {
    const { s, lateral } = LANDMARKS.windmill
    // Group's -Z faces into the wind (upwind = -WIND).
    return { position: trackToWorld(s, lateral), yaw: Math.atan2(WIND.x, WIND.z) }
  }, [])

  useFrame((_, delta) => {
    if (!reduced && wheel.current) wheel.current.rotation.z += delta * 1.6
  })

  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh geometry={towerGeo} material={towerMat} castShadow />
      <group ref={wheel} position={[0, TOWER_H + 0.6, -0.45]}>
        <mesh geometry={wheelGeo} material={wheelMat} castShadow />
      </group>
    </group>
  )
}

// ─── Pumpjack ─────────────────────────────────────────────────────────────

// Local frame: walking beam pivots about X at the top of the samson post,
// horsehead at +Z over the wellhead, crank and counterweights at -Z.
const PIVOT = v3(0, 3.3, 0)
const BEAM_FRONT = 2.9
const BEAM_BACK = 2.2
const CRANK = v3(0, 1.2, -2.2)
const CRANK_R = 0.75
const NOD = 0.26 // max beam angle (rad)

const pumpFrameGeo = (() => {
  const parts: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(1.4, 0.3, 6.6).translate(0, 0.15, -0.1), // skid
    new THREE.BoxGeometry(0.9, 0.9, 1).translate(0, 0.75, -2.2), // gearbox
    new THREE.CylinderGeometry(0.22, 0.22, 0.5, 10).translate(0, 0.55, BEAM_FRONT), // wellhead
    new THREE.CylinderGeometry(0.32, 0.32, 0.08, 10).translate(0, 0.82, BEAM_FRONT),
  ]
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) parts.push(strut(v3(sx * 0.6, 0.3, sz * 0.7), v3(sx * 0.12, PIVOT.y - 0.1, 0), 0.07))
  }
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => (g.deleteAttribute('uv'), g)))!
})()

// Beam + horsehead, around the pivot (group origin = pivot).
const beamGeo = (() => {
  const parts = [
    new THREE.BoxGeometry(0.28, 0.42, BEAM_FRONT + BEAM_BACK).translate(0, 0, (BEAM_FRONT - BEAM_BACK) / 2),
    // Horsehead: a curved arc segment hanging off the front of the beam.
    new THREE.CylinderGeometry(1.15, 1.15, 0.34, 10, 1, false, -0.15, 1.3)
      .rotateZ(Math.PI / 2)
      .translate(0, -0.55, BEAM_FRONT - 0.95),
  ]
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => (g.deleteAttribute('uv'), g)))!
})()

// Crank arms + counterweights on both sides (group origin = crank axle).
const crankGeo = (() => {
  const parts: THREE.BufferGeometry[] = []
  for (const sx of [-1, 1]) {
    parts.push(new THREE.BoxGeometry(0.12, 0.25, CRANK_R + 0.3).translate(sx * 0.55, 0, -(CRANK_R + 0.3) / 2 + 0.15))
    parts.push(new THREE.BoxGeometry(0.2, 0.7, 0.75).translate(sx * 0.55, 0, -CRANK_R))
  }
  parts.push(new THREE.CylinderGeometry(0.1, 0.1, 1.3, 8).rotateZ(Math.PI / 2))
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => (g.deleteAttribute('uv'), g)))!
})()

const rodGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, 6).translate(0, -0.5, 0) // hangs down from its top
const pitmanGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 6).translate(0, 0.5, 0) // grows up from its base

const pumpBaseMat = new THREE.MeshStandardMaterial({ color: '#3a3836', roughness: 0.7, metalness: 0.4 })
const pumpBeamMat = new THREE.MeshStandardMaterial({ color: '#7a2e22', roughness: 0.6, metalness: 0.3 })
const pumpSteelMat = new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.3, metalness: 0.8 })

function Pumpjack({ reduced }: { reduced: boolean }) {
  const beam = useRef<THREE.Group>(null)
  const crank = useRef<THREE.Group>(null)
  const rod = useRef<THREE.Mesh>(null)
  const pitman = useRef<THREE.InstancedMesh>(null)

  const { position, yaw } = useMemo(() => {
    const { s, lateral } = LANDMARKS.pumpjack
    // Beam runs parallel to the road so its nod reads side-on from the car.
    return { position: trackToWorld(s, lateral), yaw: getFrameAtDistance(s).yaw }
  }, [])

  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), a: new THREE.Vector3(), b: new THREE.Vector3(), d: new THREE.Vector3(), s: new THREE.Vector3() }),
    [],
  )

  const pose = (t: number) => {
    const phi = t * 1.1
    const theta = NOD * Math.sin(phi)
    beam.current?.rotation.set(theta, 0, 0)
    crank.current?.rotation.set(phi, 0, 0)
    // Polished rod follows the horsehead's front edge up and down.
    if (rod.current) {
      const tipY = PIVOT.y - 0.55 - Math.sin(theta) * BEAM_FRONT
      rod.current.position.set(0, tipY, BEAM_FRONT + 0.1)
      rod.current.scale.set(1, Math.max(0.1, tipY - 0.85), 1)
    }
    // Pitman arms: from each crank pin to the beam's tail.
    const mesh = pitman.current
    if (mesh) {
      const tail = tmp.b.set(0, -0.21, -BEAM_BACK).applyAxisAngle(v3(1, 0, 0), theta).add(PIVOT)
      ;[-1, 1].forEach((sx, i) => {
        const pin = tmp.a.set(sx * 0.62, 0, -CRANK_R * 0.8).applyAxisAngle(v3(1, 0, 0), phi).add(CRANK)
        const end = tmp.s.set(sx * 0.62, tail.y, tail.z)
        tmp.d.subVectors(end, pin)
        tmp.q.setFromUnitVectors(UP, tmp.d.clone().normalize())
        mesh.setMatrixAt(i, tmp.m.compose(pin, tmp.q, new THREE.Vector3(1, tmp.d.length(), 1)))
      })
      mesh.instanceMatrix.needsUpdate = true
    }
  }

  useLayoutEffect(() => pose(0))
  useFrame(({ clock }) => {
    if (!reduced) pose(clock.elapsedTime)
  })

  return (
    <group position={position} rotation={[0, yaw, 0]} scale={1.15}>
      <mesh geometry={pumpFrameGeo} material={pumpBaseMat} castShadow receiveShadow />
      <group ref={beam} position={PIVOT}>
        <mesh geometry={beamGeo} material={pumpBeamMat} castShadow />
      </group>
      <group ref={crank} position={CRANK}>
        <mesh geometry={crankGeo} material={pumpBaseMat} castShadow />
      </group>
      <mesh ref={rod} geometry={rodGeo} material={pumpSteelMat} />
      <instancedMesh ref={pitman} args={[pitmanGeo, pumpSteelMat, 2]} frustumCulled={false} castShadow />
    </group>
  )
}

// ─── Mount ────────────────────────────────────────────────────────────────

export default function AmbientLife() {
  const reduced = usePrefersReducedMotion()
  return (
    <>
      <Tumbleweeds reduced={reduced} />
      <Vultures reduced={reduced} />
      <Windmill reduced={reduced} />
      <Pumpjack reduced={reduced} />
    </>
  )
}
