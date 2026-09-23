import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { GAPS } from '@/lib/gapJump'

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

export default function Ground() {
  return (
    <>
      {SLABS.map(([start, end], i) => {
        const halfZ = (end - start) / 2
        const centerZ = start + halfZ
        return (
          <RigidBody key={i} type="fixed">
            <CuboidCollider args={[1000, 0.05, halfZ]} position={[0, -0.05, centerZ]} />
            <mesh position={[0, -0.05, centerZ]} receiveShadow>
              <boxGeometry args={[2000, 0.1, halfZ * 2]} />
              <meshStandardMaterial color="#5a3e28" roughness={1} />
            </mesh>
          </RigidBody>
        )
      })}
    </>
  )
}
