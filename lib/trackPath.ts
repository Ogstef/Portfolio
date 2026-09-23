import * as THREE from 'three'

// Single source of truth for the curved road centerline — consumed by the
// road mesh, project placement, scenery placement, and ramp placement.
//
// Point 0 and point 1 sit on a straight +Z line through the origin so the
// car's spawn heading (Car.tsx SPAWN_POSITION, facing +Z) stays valid before
// any curving starts.
//
// Distance ~135-178 (after Eurobank, before the bend toward Trigono) and
// ~258-305 (before the bend toward Gumroad) are dead straight — three
// collinear-ish control points each (constant x) — because lib/gapJump.ts's
// two mandatory jumps are now identical in size (same ramp, per design) and
// that structure needs a good 32 units of genuinely flat road to sit on
// without visibly splitting away from the curving ribbon on either side.
// They also double as runway: a car stopped dead by a sign-mode cutscene
// needs real distance to build speed again before the next jump, which is
// why each gate's base sits a good 40+ units past the previous stop's
// trigger radius, not right on top of it.
const TRACK_CONTROL_POINTS: THREE.Vector3[] = [
  new THREE.Vector3(0, 0, -20),
  new THREE.Vector3(0, 0, 20),
  new THREE.Vector3(6, 0, 50),
  new THREE.Vector3(8, 0, 78),
  new THREE.Vector3(8, 0, 115),
  new THREE.Vector3(8, 0, 155),
  new THREE.Vector3(8, 0, 178),
  new THREE.Vector3(0, 0, 203),
  new THREE.Vector3(-8, 0, 228),
  new THREE.Vector3(-8, 0, 258),
  new THREE.Vector3(-8, 0, 293),
  new THREE.Vector3(-3, 0, 320),
  new THREE.Vector3(0, 0, 340),
]

const trackCurve = new THREE.CatmullRomCurve3(TRACK_CONTROL_POINTS, false, 'centripetal')

export const TRACK_LENGTH = trackCurve.getLength()

const WORLD_UP = new THREE.Vector3(0, 1, 0)

export type TrackFrame = {
  position: THREE.Vector3
  tangent: THREE.Vector3
  right: THREE.Vector3
  yaw: number
}

// Not THREE.Curve.computeFrenetFrames(): it parallel-transports frames along
// the curve and can flip its normal/binormal sign abruptly on straight or
// inflection sections. `right = cross(WORLD_UP, tangent)` is stateless per
// sample — nothing propagates between samples, so nothing can flip — and is
// only valid because the track stays flat (tangent.y ≈ 0 always, never near
// parallel to WORLD_UP). Any future elevation work needs a different frame.
export function getFrameAtDistance(distance: number): TrackFrame {
  const u = THREE.MathUtils.clamp(distance, 0, TRACK_LENGTH) / TRACK_LENGTH
  const position = trackCurve.getPointAt(u)
  const tangent = trackCurve.getTangentAt(u)
  const right = new THREE.Vector3().crossVectors(WORLD_UP, tangent).normalize()
  const yaw = Math.atan2(tangent.x, tangent.z)
  return { position, tangent, right, yaw }
}

export function sampleTrack(step: number): Array<{ position: THREE.Vector3; right: THREE.Vector3 }> {
  return sampleTrackRange(0, TRACK_LENGTH, step)
}

// Same as sampleTrack, but bounded to [start, end] — used by Road.tsx to
// build the ribbon in two pieces around the mandatory gap jump (see
// lib/gapJump.ts) instead of one continuous strip across it.
export function sampleTrackRange(
  start: number,
  end: number,
  step: number,
): Array<{ position: THREE.Vector3; right: THREE.Vector3 }> {
  const samples: Array<{ position: THREE.Vector3; right: THREE.Vector3 }> = []
  for (let s = start; s < end; s += step) {
    const { position, right } = getFrameAtDistance(s)
    samples.push({ position, right })
  }
  const last = getFrameAtDistance(end)
  samples.push({ position: last.position, right: last.right })
  return samples
}
