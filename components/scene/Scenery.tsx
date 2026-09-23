'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { Instances, Instance } from '@react-three/drei'
import { TRACK_LENGTH } from '@/lib/trackPath'
import { mulberry32 } from '@/lib/random'
import { isBlocked, trackToWorld } from '@/lib/placement'

const ROAD_CLEAR_X = 6 // keep this clear of the road on both sides
const FIELD_X = 46 // how far out scenery extends
const FIELD_S_MIN = 0
const FIELD_S_MAX = TRACK_LENGTH + 15

// Shared geometries/materials hoisted to module scope (same pattern as
// GapRamp.tsx) — every item of a kind is one instanced draw per sub-mesh
// instead of its own meshes + materials.
const cactusMat = new THREE.MeshStandardMaterial({ color: '#3f6b45', roughness: 1 })
const cactusCapGeo = new THREE.SphereGeometry(0.24, 8, 8)
const cactusArmGeo = new THREE.CylinderGeometry(0.13, 0.16, 1.1, 6)
// Unit-height trunk, scaled per instance (cactus height varies with scale).
const cactusBodyGeo = new THREE.CylinderGeometry(0.24, 0.3, 1, 8)

const rockMat = new THREE.MeshStandardMaterial({ color: '#6b5b4a', roughness: 1, flatShading: true })
const rockGeo = new THREE.IcosahedronGeometry(0.5, 0)

const trunkMat = new THREE.MeshStandardMaterial({ color: '#4a3626', roughness: 1 })
const trunkGeo = new THREE.CylinderGeometry(0.1, 0.2, 1, 6)
const branchGeo = new THREE.CylinderGeometry(0.06, 0.1, 1, 6)
const canopyMat = new THREE.MeshStandardMaterial({ color: '#5c7a3f', roughness: 1, flatShading: true })
const canopyGeo = new THREE.IcosahedronGeometry(0.75, 0)
const canopySmallMat = new THREE.MeshStandardMaterial({ color: '#527038', roughness: 1, flatShading: true })
const canopySmallGeo = new THREE.IcosahedronGeometry(0.45, 0)

type Placement = { x: number; z: number; scale: number; rotY: number; hasArm: boolean; armSide: number }

function useField(count: number, seed: number, height: number): Placement[] {
  return useMemo(() => {
    const rand = mulberry32(seed)
    const items: Placement[] = []
    let guard = 0
    while (items.length < count && guard < count * 8) {
      guard++
      const side = rand() < 0.5 ? -1 : 1
      const lateral = side * (ROAD_CLEAR_X + rand() * (FIELD_X - ROAD_CLEAR_X))
      const s = THREE.MathUtils.clamp(
        FIELD_S_MIN + rand() * (FIELD_S_MAX - FIELD_S_MIN),
        0,
        TRACK_LENGTH,
      )
      const scale = 0.7 + rand() * 0.9
      const rotY = rand() * Math.PI * 2
      const hasArm = rand() < 0.35
      const armSide = rand() < 0.5 ? -1 : 1
      if (isBlocked(s, lateral, height * scale)) continue
      const p = trackToWorld(s, lateral)
      items.push({ x: p.x, z: p.z, scale, rotY, hasArm, armSide })
    }
    return items
  }, [count, seed, height])
}

function Cacti({ items }: { items: Placement[] }) {
  const armed = items.filter((c) => c.hasArm)
  return (
    <>
      <Instances geometry={cactusBodyGeo} material={cactusMat} limit={items.length} frustumCulled={false} castShadow receiveShadow>
        {items.map((c, i) => {
          const h = 2 + c.scale
          return (
            <group key={i} position={[c.x, 0, c.z]} rotation={[0, c.rotY, 0]} scale={c.scale}>
              <Instance position={[0, h / 2, 0]} scale={[1, h, 1]} />
            </group>
          )
        })}
      </Instances>
      <Instances geometry={cactusCapGeo} material={cactusMat} limit={items.length} frustumCulled={false} castShadow>
        {items.map((c, i) => (
          <group key={i} position={[c.x, 0, c.z]} rotation={[0, c.rotY, 0]} scale={c.scale}>
            <Instance position={[0, 2 + c.scale + 0.15, 0]} />
          </group>
        ))}
      </Instances>
      <Instances geometry={cactusArmGeo} material={cactusMat} limit={Math.max(armed.length, 1)} frustumCulled={false} castShadow>
        {armed.map((c, i) => (
          <group key={i} position={[c.x, 0, c.z]} rotation={[0, c.rotY, 0]} scale={c.scale}>
            <Instance position={[c.armSide * 0.32, (2 + c.scale) * 0.55, 0]} rotation={[0, 0, c.armSide * 0.9]} />
          </group>
        ))}
      </Instances>
    </>
  )
}

function Rocks({ items }: { items: Placement[] }) {
  return (
    <Instances geometry={rockGeo} material={rockMat} limit={items.length} frustumCulled={false} castShadow receiveShadow>
      {items.map((r, i) => (
        <Instance
          key={i}
          position={[r.x, 0.15 * r.scale, r.z]}
          rotation={[0.3, r.rotY, 0.1]}
          scale={[r.scale, r.scale * 0.6, r.scale]}
        />
      ))}
    </Instances>
  )
}

// Weathered desert tree — gnarled trunk + a couple of sparse canopy clumps,
// taller and more varied in silhouette than the cacti for a denser, more
// layered horizon.
function Trees({ items }: { items: Placement[] }) {
  const parts: Array<{
    geo: THREE.BufferGeometry
    mat: THREE.Material
    receive?: boolean
    place: (trunkH: number) => { position: [number, number, number]; rotation?: [number, number, number]; scale?: [number, number, number] }
  }> = [
    { geo: trunkGeo, mat: trunkMat, receive: true, place: (h) => ({ position: [0, h / 2, 0], rotation: [0, 0, 0.08], scale: [1, h, 1] }) },
    { geo: branchGeo, mat: trunkMat, place: (h) => ({ position: [0.15, h * 0.62, 0.05], rotation: [0, 0, -0.6], scale: [1, h * 0.5, 1] }) },
    { geo: canopyGeo, mat: canopyMat, place: (h) => ({ position: [0, h + 0.35, 0] }) },
    { geo: canopySmallGeo, mat: canopySmallMat, place: (h) => ({ position: [0.45, h + 0.05, 0.15] }) },
  ]
  return (
    <>
      {parts.map((part, pi) => (
        <Instances key={pi} geometry={part.geo} material={part.mat} limit={items.length} frustumCulled={false} castShadow receiveShadow={part.receive}>
          {items.map((t, i) => (
            <group key={i} position={[t.x, 0, t.z]} rotation={[0, t.rotY, 0]} scale={t.scale}>
              <Instance {...part.place(2.6 + t.scale)} />
            </group>
          ))}
        </Instances>
      ))}
    </>
  )
}

export default function Scenery() {
  const cacti = useField(70, 1001, 3)
  const rocks = useField(90, 2002, 0.3)
  const trees = useField(40, 3003, 3.6)

  return (
    <group>
      <Cacti items={cacti} />
      <Rocks items={rocks} />
      <Trees items={trees} />
    </group>
  )
}
