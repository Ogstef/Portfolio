import { getFrameAtDistance } from './trackPath'

// Mandatory canyon jumps the car must launch across to reach certain
// projects (see data/projects.ts and GAPS below for which). Each one sits on
// a straight-enough stretch of the curve — see the per-gap comments — so its
// linear ramp/gap/ramp structure lines up cleanly with the curved road on
// both sides.
//
// Sized deliberately short/close (small `gapWidth`) rather than wide and
// dramatic: the goal is a jump that's *reliably* clearable at a normal
// approach speed, not a low-probability stunt — a jump you almost always
// make is what makes it feel like a real obstacle course rather than a coin
// flip.

export type GapJump = {
  baseDistance: number
  run: number
  topH: number
  thick: number
  platThick: number
  platD: number
  gapWidth: number
  roadWidth: number
  angle: number
  cy: number
  topY: number
  platCy: number
  upRampEnd: number
  launchPlatEnd: number
  landingPlatStart: number
  landingPlatEnd: number
  downRampEnd: number
  respawnDistance: number
  getVoidZBounds: () => [number, number]
}

type GapJumpConfig = {
  baseDistance: number
  respawnOffset?: number
}

// Same rise/run ratio as the tuned side-ramps in Ramps.tsx (2/9, ≈12.5°) for
// every gap jump — reused deliberately so none of these introduce an
// untested launch angle into a jump every playthrough must clear.
const RISE_RUN_RATIO = 2 / 9
const THICK = 0.5
const PLAT_THICK = 0.4
const ROAD_WIDTH = 8 // matches Road.tsx's ROAD_WIDTH so the jump surface lines up with the ribbon

// Every mandatory jump uses this exact same ramp — deliberately, not just
// "the same angle" like the side-ramps. A shorter version of this (run=5)
// used to gate Trigono and got the car stuck on approach; this size is the
// one that's been driven and confirmed clean, so both gates use it, full stop.
const RUN = 11
const GAP_WIDTH = 5
const PLAT_D = 2.5

function createGapJump({ baseDistance, respawnOffset = 8 }: GapJumpConfig): GapJump {
  const run = RUN
  const gapWidth = GAP_WIDTH
  const platD = PLAT_D
  const topH = run * RISE_RUN_RATIO
  const angle = Math.atan2(topH, run)
  const cy = (run / 2) * Math.sin(angle) - (THICK / 2) * Math.cos(angle)
  const topY = cy + (run / 2) * Math.sin(angle) + (THICK / 2) * Math.cos(angle)
  const platCy = topY + PLAT_THICK / 2

  const upRampEnd = baseDistance + run
  const launchPlatEnd = upRampEnd + platD
  const landingPlatStart = launchPlatEnd + gapWidth
  const landingPlatEnd = landingPlatStart + platD
  const downRampEnd = landingPlatEnd + run

  // A few units back from the ramp base — where a car that falls into this
  // canyon gets teleported back to, so a missed jump is a quick retry rather
  // than a long drive back from spawn. `respawnOffset` is tunable per-gap so
  // a tightly-boxed-in gap (see TRIGONO_GAP) doesn't back the respawn point
  // into the previous stop's trigger radius.
  const respawnDistance = baseDistance - respawnOffset

  return {
    baseDistance,
    run,
    topH,
    thick: THICK,
    platThick: PLAT_THICK,
    platD,
    gapWidth,
    roadWidth: ROAD_WIDTH,
    angle,
    cy,
    topY,
    platCy,
    upRampEnd,
    launchPlatEnd,
    landingPlatStart,
    landingPlatEnd,
    downRampEnd,
    respawnDistance,
    // World-space bounds of the actual void (no ground/road at all), used by
    // Ground.tsx to split its collider. The straight stretch each gap sits
    // on keeps tangent.x ≈ 0 there, so approximating the void as an
    // axis-aligned world-Z band (rather than an oriented strip) is safe.
    getVoidZBounds(): [number, number] {
      const a = getFrameAtDistance(launchPlatEnd).position.z
      const b = getFrameAtDistance(landingPlatStart).position.z
      return [Math.min(a, b), Math.max(a, b)]
    },
  }
}

// Gates the Trigono stop (data/projects.ts, distance 187) — base sits 42
// units past the Eurobank stop's trigger radius (90+8=98), real runway to
// build speed back up after that stop's sign-mode cutscene stops the car
// dead. Sits on the dead-straight run at distance ~135-178 (see the
// control-point comment in trackPath.ts).
export const TRIGONO_GAP = createGapJump({ baseDistance: 140 })

// Gates the Gumroad stop (data/projects.ts, distance 307) — base sits 65
// units past Trigono's trigger radius (187+8=195), on the dead-straight run
// at distance ~258-305 (see the control-point comment in trackPath.ts).
export const GUMROAD_GAP = createGapJump({ baseDistance: 260 })

// Ordered by distance along the track — components that need to enumerate
// every gap (Road, Ground, Scenery, FallSafety) rely on this order.
export const GAPS: GapJump[] = [TRIGONO_GAP, GUMROAD_GAP]
