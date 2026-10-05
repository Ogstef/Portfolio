'use client'

import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

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

// meshopt-quantised attributes are normalised ints; transforming those in
// place would re-quantise and clip, so expand to float first.
function toFloat(attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
  const n = attr.itemSize
  const out = new Float32Array(attr.count * n)
  for (let i = 0; i < attr.count; i++) {
    out[i * n] = attr.getX(i)
    if (n > 1) out[i * n + 1] = attr.getY(i)
    if (n > 2) out[i * n + 2] = attr.getZ(i)
  }
  return new THREE.BufferAttribute(out, n)
}

const bakeCache = new WeakMap<THREE.Object3D, { geometry: THREE.BufferGeometry; material: THREE.Material }>()

// Merges every mesh under a GLB node (body, wheels, doors…) into one
// geometry in the node's own frame, so a multi-part model is one draw.
// Kenney kit models all share one texture-atlas material, which is what
// makes this valid — the first mesh's material is used for the lot.
export function bakeModel(node: THREE.Object3D) {
  const cached = bakeCache.get(node)
  if (cached) return cached
  node.updateWorldMatrix(true, true)
  const toLocal = new THREE.Matrix4().copy(node.parent?.matrixWorld ?? new THREE.Matrix4()).invert()
  const parts: THREE.BufferGeometry[] = []
  let material: THREE.Material | null = null
  node.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    material ??= mesh.material as THREE.Material
    const src = mesh.geometry
    let g = new THREE.BufferGeometry()
    g.setAttribute('position', toFloat(src.attributes.position))
    g.setAttribute('normal', toFloat(src.attributes.normal))
    if (src.attributes.uv) g.setAttribute('uv', toFloat(src.attributes.uv))
    if (src.index) g.setIndex(Array.from(src.index.array))
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, mesh.matrixWorld))
    if (g.index) g = g.toNonIndexed()
    parts.push(g)
  })
  const baked = { geometry: mergeGeometries(parts)!, material: material! }
  bakeCache.set(node, baked)
  return baked
}

// Instances a whole GLB model (all its parts, baked into one geometry) at
// each placement — one draw call per model regardless of part count.
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
  const { geometry, material } = bakeModel(node)
  return (
    <StaticInstances
      geometry={geometry}
      material={material}
      matrices={matrices}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  )
}
