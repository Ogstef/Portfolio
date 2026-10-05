'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

// Static (set-once) instanced drawing for environment props — one draw call
// per geometry/material however many copies. Unlike drei <Instances>, the
// bounding sphere is computed from the real instance transforms, so frustum
// culling stays correct without disabling it.

const UP = new THREE.Vector3(0, 1, 0)
const q = new THREE.Quaternion()
const p = new THREE.Vector3()
const s = new THREE.Vector3()

// Ground-placed transform: position, yaw, and uniform or per-axis scale.
export function placeMatrix(
  x: number,
  y: number,
  z: number,
  rotY = 0,
  scale: number | [number, number, number] = 1,
) {
  q.setFromAxisAngle(UP, rotY)
  p.set(x, y, z)
  if (typeof scale === 'number') s.setScalar(scale)
  else s.set(...scale)
  return new THREE.Matrix4().compose(p, q, s)
}

type Props = {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  matrices: THREE.Matrix4[]
  castShadow?: boolean
  receiveShadow?: boolean
}

export default function StaticInstances({ geometry, material, matrices, castShadow = false, receiveShadow = false }: Props) {
  const ref = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [matrices])

  if (matrices.length === 0) return null
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, matrices.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  )
}

// Instances every mesh under a GLB node at each placement. Each sub-mesh's
// own transform (including meshopt's dequantisation scale/offset, which
// lives on the node) is folded into its instance matrices.
export function GltfInstances({
  node,
  matrices,
  castShadow = false,
  receiveShadow = false,
}: {
  node: THREE.Object3D
  matrices: THREE.Matrix4[]
  castShadow?: boolean
  receiveShadow?: boolean
}) {
  const parts = useMemo(() => {
    node.updateWorldMatrix(true, true)
    const rootInverse = new THREE.Matrix4().copy(node.parent?.matrixWorld ?? new THREE.Matrix4()).invert()
    const out: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[] }> = []
    node.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const local = new THREE.Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld)
      out.push({
        geometry: mesh.geometry,
        material: mesh.material as THREE.Material,
        matrices: matrices.map((m) => m.clone().multiply(local)),
      })
    })
    return out
  }, [node, matrices])

  return (
    <>
      {parts.map((part, i) => (
        <StaticInstances key={i} {...part} castShadow={castShadow} receiveShadow={receiveShadow} />
      ))}
    </>
  )
}
