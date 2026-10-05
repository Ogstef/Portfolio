'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { EcctrlVehicleHandle } from 'ecctrl/vehicle'
import { getCloudPuffTexture } from '@/lib/canvasTextures'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'

// Dust kicked up behind the rear wheels, more the faster you go. A fixed
// pool of puffs drawn as ONE Points object with a tiny shader for per-puff
// size and fade (Sprites would be a draw call each). Skipped entirely under
// prefers-reduced-motion.

const POOL = 64
const LIFE = 1.2 // seconds
const MIN_SPEED = 2 // m/s — no dust when crawling
const RATE_PER_MS = 3 // puffs per second per m/s over MIN_SPEED
const MAX_RATE = 45
const GROUNDED_Y = 1.3 // chassis rests ~0.79; above this the car is airborne
// Rear wheel contact points in chassis space (see Car.tsx AXLE_X / AXLE_Z_R;
// the wheels' ground is ~0.78 below the chassis origin).
const REAR_WHEELS = [new THREE.Vector3(-0.9, -0.7, -1.4), new THREE.Vector3(0.9, -0.7, -1.4)]

const vertexShader = /* glsl */ `
  attribute float aAlpha;
  attribute float aSize;
  uniform float uScale;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`

type Props = {
  vehicleRef: React.RefObject<EcctrlVehicleHandle | null>
}

export default function DustTrail({ vehicleRef }: Props) {
  const reduced = usePrefersReducedMotion()
  if (reduced) return null
  return <Dust vehicleRef={vehicleRef} />
}

// Simulation state lives in a ref (mutated every frame), separate from the
// render objects; the GPU buffers are reached through the Points ref.
type Sim = { vel: Float32Array; age: Float32Array; grow: Float32Array; next: number; carry: number; side: number; tmp: THREE.Vector3 }

function createSim(): Sim {
  return {
    vel: new Float32Array(POOL * 3),
    age: new Float32Array(POOL).fill(LIFE), // all start dead
    grow: new Float32Array(POOL),
    next: 0,
    carry: 0,
    side: 0,
    tmp: new THREE.Vector3(),
  }
}

function Dust({ vehicleRef }: Props) {
  const points = useRef<THREE.Points>(null)
  const sim = useRef<Sim | null>(null)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)

  const { geometry, material } = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(POOL * 3), 3))
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(POOL), 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(POOL), 1))
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uMap: { value: getCloudPuffTexture() },
        uColor: { value: new THREE.Color('#b08a60') },
        uScale: { value: 1 },
      },
    })
    return { geometry, material }
  }, [])

  useFrame((frameState, delta) => {
    const pts = points.current
    const v = vehicleRef.current
    if (!pts || !v) return
    const state = (sim.current ??= createSim())
    const dt = Math.min(delta, 0.05)
    const attrs = pts.geometry.attributes
    const pos = attrs.position as THREE.BufferAttribute
    const alpha = attrs.aAlpha as THREE.BufferAttribute
    const sizeAttr = attrs.aSize as THREE.BufferAttribute
    const cam = frameState.camera as THREE.PerspectiveCamera
    ;(pts.material as THREE.ShaderMaterial).uniforms.uScale.value =
      (size.height * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2))

    // Emit.
    const speed = Math.hypot(v.currLinVel.x, v.currLinVel.z)
    const grounded = v.currPos.y < GROUNDED_Y
    const rate = grounded ? Math.min(MAX_RATE, Math.max(0, speed - MIN_SPEED) * RATE_PER_MS) : 0
    state.carry += rate * dt
    while (state.carry >= 1) {
      state.carry -= 1
      const i = state.next
      state.next = (state.next + 1) % POOL
      state.side ^= 1
      const p = state.tmp.copy(REAR_WHEELS[state.side]).applyQuaternion(v.currQuat).add(v.currPos)
      pos.setXYZ(i, p.x + (Math.random() - 0.5) * 0.3, Math.max(0.15, p.y), p.z + (Math.random() - 0.5) * 0.3)
      // Drift: a little backwards relative to the car, outwards and up.
      state.vel[i * 3] = -v.currLinVel.x * 0.08 + (Math.random() - 0.5) * 0.8
      state.vel[i * 3 + 1] = 0.35 + Math.random() * 0.4
      state.vel[i * 3 + 2] = -v.currLinVel.z * 0.08 + (Math.random() - 0.5) * 0.8
      state.age[i] = 0
      state.grow[i] = 1.6 + Math.random() * 1.2 + speed * 0.04
    }

    // Age, move, fade.
    for (let i = 0; i < POOL; i++) {
      const age = (state.age[i] = Math.min(LIFE, state.age[i] + dt))
      const t = age / LIFE
      if (t >= 1) {
        alpha.setX(i, 0)
        continue
      }
      pos.setXYZ(
        i,
        pos.getX(i) + state.vel[i * 3] * dt,
        pos.getY(i) + state.vel[i * 3 + 1] * dt,
        pos.getZ(i) + state.vel[i * 3 + 2] * dt,
      )
      alpha.setX(i, 0.42 * (1 - t) * Math.min(1, t * 8))
      sizeAttr.setX(i, 0.5 + state.grow[i] * t)
    }
    pos.needsUpdate = true
    alpha.needsUpdate = true
    sizeAttr.needsUpdate = true
  })

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />
}
