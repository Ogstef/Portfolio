import { useMemo } from 'react'
import * as THREE from 'three'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { Instances, Instance } from '@react-three/drei'
import { GAPS } from '@/lib/gapJump'
import { TRACK_LENGTH } from '@/lib/trackPath'
import { getBlotchTexture, getGroundTexture } from '@/lib/canvasTextures'
import { mulberry32, pick, range } from '@/lib/random'
import { inGapSpan, trackToWorld } from '@/lib/placement'

// Ground is split into a slab per gap in GAPS, each pair separated by that
// gap's void (see lib/gapJump.ts) — there is no ground at all between them,
// so a canyon can't be driven around, only jumped.
const VOID_Z_BOUNDS = GAPS.map((gap) => gap.getVoidZBounds()).sort((a, b) => a[0] - b[0])

const SLABS: Array<[number, number]> = (() => {
  const slabs: Array<[number, number]> = []
  let cursor = -1000
  for (const [start, end] of VOID_Z_BOUNDS) {
    slabs.push([cursor, start])
    cursor = end
  }
  slabs.push([cursor, 1000])
  return slabs
})()

const SLAB_WIDTH = 2000
const GROUND_TILE = 10 // metres per repeat of the ground texture

// Box with UVs scaled so the shared ground texture repeats every GROUND_TILE
// metres on every slab, whatever its length — one texture, no per-slab clones.
function slabGeometry(depth: number) {
  const geo = new THREE.BoxGeometry(SLAB_WIDTH, 0.1, depth)
  const uv = geo.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * (SLAB_WIDTH / GROUND_TILE), uv.getY(i) * (depth / GROUND_TILE))
  }
  return geo
}

// Large soft colour patches so the dirt isn't one uniform tone. Kept off the
// road (and its shoulder) and away from canyon lips so none overhang a void.
const PATCH_COUNT = 36
const PATCH_TONES = ['#6f4e33', '#7a5a3c', '#4a311f', '#433018']
const patchGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)

type Patch = { x: number; z: number; sx: number; sz: number; rotY: number; color: string }

function usePatches(): Patch[] {
  return useMemo(() => {
    const rand = mulberry32(4242)
    const patches: Patch[] = []
    let guard = 0
    while (patches.length < PATCH_COUNT && guard++ < PATCH_COUNT * 10) {
      const size = range(rand, 8, 25)
      const s = range(rand, -20, TRACK_LENGTH + 30)
      const side = rand() < 0.5 ? -1 : 1
      // A stretched (≤1.4×) blotch's visible edge reaches ~0.65×size from
      // its centre, so this keeps even the largest clear of the shoulder.
      const lateral = side * range(rand, size * 0.7 + 6, 90)
      const rotY = rand() * Math.PI * 2
      const stretch = range(rand, 0.6, 1.4)
      const color = pick(rand, PATCH_TONES)
      if (inGapSpan(s, size * 0.7 + 4)) continue
      const p = trackToWorld(s, lateral)
      patches.push({ x: p.x, z: p.z, sx: size * stretch, sz: size / stretch, rotY, color })
    }
    return patches
  }, [])
}

export default function Ground() {
  const groundMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: getGroundTexture(), roughness: 1 }),
    [],
  )
  const patchMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        alphaMap: getBlotchTexture(),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        roughness: 1,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    [],
  )
  const slabGeos = useMemo(() => SLABS.map(([start, end]) => slabGeometry(end - start)), [])
  const patches = usePatches()

  return (
    <>
      {SLABS.map(([start, end], i) => {
        const halfZ = (end - start) / 2
        const centerZ = start + halfZ
        return (
          <RigidBody key={i} type="fixed">
            <CuboidCollider args={[1000, 0.05, halfZ]} position={[0, -0.05, centerZ]} />
            <mesh position={[0, -0.05, centerZ]} geometry={slabGeos[i]} material={groundMat} receiveShadow />
          </RigidBody>
        )
      })}

      <Instances geometry={patchGeo} material={patchMat} limit={PATCH_COUNT} frustumCulled={false} receiveShadow>
        {patches.map((p, i) => (
          <Instance key={i} position={[p.x, 0.004, p.z]} rotation={[0, p.rotY, 0]} scale={[p.sx, 1, p.sz]} color={p.color} />
        ))}
      </Instances>
    </>
  )
}
