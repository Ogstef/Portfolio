import * as THREE from 'three'
import { TRACK_LENGTH, getFrameAtDistance } from './trackPath'
import { GAPS } from './gapJump'
import { projects } from '@/data/projects'

// Single source of truth for where decoration may NOT go. Every scenery /
// dressing component funnels its candidate positions through isBlocked() so
// nothing ever lands on a ramp, over a canyon void, on the road, in spawn,
// or between a stop's cutscene camera and its sign.

// Ramps (see Ramps.tsx) occupy roughly lateral offset in [3,37] (mirrored —
// the largest, scale=1.4 ramp reaches ROAD_EDGE + RAMP_RUN*1.4 + PLAT_D*1.4 =
// 4+19.6+12.6=36.2) around these arc-length distances
export const RAMP_S = [22, 55, 75, 335]

const ROAD_CLEAR = 6
const ROAD_CLEAR_TALL = 7.5
const TALL = 1 // metres — anything above this can block a cutscene view
const SPAWN_RADIUS = 8
const SIGN_RADIUS = 18 // clears each stop's diorama (StopDiorama.tsx reaches ~17.5 m from the sign)
const CAMERA_CORRIDOR = 3 // half-width of the camera→sign sightline

// Beyond either end of the road, s keeps going in a straight line along the
// end tangent, so scenery can be laid out past the finale and behind spawn
// instead of piling up on the end frame.
export function trackToWorld(s: number, lateral: number, y = 0) {
  const clamped = THREE.MathUtils.clamp(s, 0, TRACK_LENGTH)
  const { position, tangent, right } = getFrameAtDistance(clamped)
  const over = s - clamped
  return new THREE.Vector3(
    position.x + tangent.x * over + right.x * lateral,
    y,
    position.z + tangent.z * over + right.z * lateral,
  )
}

function nearRamp(s: number, lateral: number, radius: number) {
  const al = Math.abs(lateral)
  if (al < 3 - radius || al > 37 + radius) return false
  return RAMP_S.some((rs) => Math.abs(s - rs) < 6 + radius)
}

// Every mandatory gap-jump's void spans the full lateral width there (see
// Ground.tsx) — skip those bands regardless of offset, or items on the far
// side would render floating over open air.
export function inGapSpan(s: number, margin = 4) {
  return GAPS.some((gap) => s >= gap.baseDistance - margin && s <= gap.downRampEnd + margin)
}

// The ground itself is missing over each canyon as an axis-aligned world-Z
// band spanning the full map width (Ground.tsx) — so far off to the side of
// a curve, a point can be over the void even when its arc length s is
// nowhere near a gap. This checks the actual world position.
const VOID_Z_BOUNDS = GAPS.map((gap) => gap.getVoidZBounds())
export function overVoid(z: number, margin = 4) {
  return VOID_Z_BOUNDS.some(([a, b]) => z > a - margin && z < b + margin)
}

// Distance from point p to segment ab in the XZ plane.
function distToSegmentXZ(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax
  const dz = bz - az
  const lenSq = dx * dx + dz * dz
  const t = lenSq > 0 ? THREE.MathUtils.clamp(((px - ax) * dx + (pz - az) * dz) / lenSq, 0, 1) : 0
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz))
}

// Is world point (x,z) inside any stop's sign radius or cutscene sightline?
// Tall things are blocked from both; short things only from the sign itself
// (a low rock under the camera line doesn't hide anything).
export function inStopCorridor(x: number, z: number, height: number, radius = 0) {
  return projects.some((p) => {
    const [sx, , sz] = p.signPosition
    const [cx, , cz] = p.cameraApproach
    if (Math.hypot(x - sx, z - sz) < SIGN_RADIUS + radius) return true
    return height > TALL && distToSegmentXZ(x, z, cx, cz, sx, sz) < CAMERA_CORRIDOR + radius
  })
}

// `radius` is the item's footprint radius — every clearance is measured to
// its edge, not its centre, so a wide boulder can't overhang the road.
export function isBlocked(s: number, lateral: number, height = 0, radius = 0) {
  const al = Math.abs(lateral)
  if (al - radius < (height > TALL ? ROAD_CLEAR_TALL : ROAD_CLEAR)) return true
  if (nearRamp(s, lateral, radius)) return true
  if (inGapSpan(s, 4 + radius)) return true
  const p = trackToWorld(s, lateral)
  if (overVoid(p.z, 4 + radius)) return true
  if (Math.hypot(p.x, p.z) < SPAWN_RADIUS + radius) return true
  return inStopCorridor(p.x, p.z, height, radius)
}
