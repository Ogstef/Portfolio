'use client'

import { forwardRef, useEffect } from 'react'
import { EcctrlVehicle, ShapeCastWheel, type EcctrlVehicleHandle } from 'ecctrl/vehicle'
import { CuboidCollider } from '@react-three/rapier'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const WHEEL_R  = 0.4
const WHEEL_H  = 0.3
const AXLE_X   = 0.9
const AXLE_Z_F =  1.4
const AXLE_Z_R = -1.4

export const SPAWN_POSITION: [number, number, number] = [0, 2, 0]

// Default relaxLatRate (0.1) reaches full-strength lateral grip correction
// at ~6 m/s of lateral slip, applied independently per wheel every frame.
// Braking hard enough to lock all 4 wheels at once (via space) lets any
// tiny per-wheel asymmetry (steering residual, uneven load) turn into a
// violent, uncoordinated sideways snap — "sent flying." Slowing the ramp
// (delays full grip until ~15 m/s of slip) and trimming overall grip
// smooths that out without gutting normal cornering response.
//
// Handbrake u-turns still tripped the car onto its roof: locked wheels
// grabbing hard lateral grip at speed turns sideways momentum into roll
// torque. Dropped grip and slowed the ramp further so that snap is gentler,
// and ANGULAR_DAMPING (a native Rapier body property, not custom force code
// — see the WASM-panic note below) bleeds off roll rotation before it can
// complete a flip.
//
// That grip drop was only ever needed on the rear (handbrake) wheels, but
// tireGripFactor was one shared constant across all 4 — so the front,
// driven wheels inherited it too. tireGripFactor sets longitudinal grip as
// well as lateral, so with it lowered the fronts couldn't convert engine
// torque into forward motion from a standstill: they'd spin up (logged
// slip past 30) before grip caught up, then lurch forward all at once.
// Splitting front/rear grip fixes both independently — the rear keeps the
// soft grip the handbrake needs, the front gets its grip back for a clean
// launch from a stop.
const FRONT_TIRE_GRIP = 1.3
const REAR_TIRE_GRIP = 0.95
const RELAX_LAT_RATE = 0.15
const ANGULAR_DAMPING = 0.6

// ecctrl's default maxBrakeTorque (40) snaps a rear wheel's angular
// velocity to zero in a single physics step. That one-frame swing is a
// slip-ratio discontinuity, and it's what's been showing up in every crash
// log as one wheel's friction impulse spiking 5-10x its neighbors (e.g.
// lng=3.31 while the rest sit under 0.3) — which then launches the chassis
// into a pitch/roll tumble. A softer torque locks the wheel over a few
// frames instead of one, keeping that swing (and the resulting impulse)
// small enough not to trigger it.
const REAR_BRAKE_TORQUE = 12

// Tried locking pitch/roll via enabledRotations for a hard anti-flip
// guarantee — reverted. Each wheel's suspension spring pushes the body
// independently; body rotation is how that per-wheel imbalance normally
// gets absorbed. With rotation locked, the solver had nowhere to put that
// imbalance but straight into linear velocity, so even a light throttle tap
// launched the car into the air.

// NOTE: mass/springK/dampingC/spawn height were pushed to "realistic car"
// values here and it went bottom-out -> growing oscillation -> a Rapier WASM
// panic ("recursive use of an object", i.e. a NaN corrupting the physics
// state) across three attempts. Reverted to ecctrl's untouched defaults
// (unset collider mass, default springK/dampingC on the wheels, original
// spawn height) as a known-non-crashing baseline to tune up from
// incrementally instead of jumping straight to big numbers.

// ecctrl's own DEFAULT_CAR_CONFIG.engineHorsepower is 6 — calibrated against
// its other untouched defaults (gearRatios: [10], engineMaxRPM: 6000, etc).
// ENGINE_HORSEPOWER was left at a "real car" value of 150, 25x that
// calibration, on a VELOCITY-mode controller that commands whatever torque
// it takes to close the gap to target speed. That's the actual root cause
// behind this session's launch bugs (standing-start wheelspin-then-lurch,
// the forward+brake windup) — every wheel-level tuning knob above was
// treating a symptom of an engine sized 25x past what the rest of the
// physics model expects.
const ENGINE_HORSEPOWER = 14

const Car = forwardRef<EcctrlVehicleHandle>(function Car(_props, ref) {
  const { scene } = useGLTF('/models/car.glb')

  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }, [scene])

  return (
    <EcctrlVehicle
      ref={ref}
      position={SPAWN_POSITION}
      angularDamping={ANGULAR_DAMPING}
      carConfig={{
        engineHorsepower: ENGINE_HORSEPOWER,
        maxSteerAngle: 0.55,
        steerRate: 4,
      }}
    >
      {/* Physics body — required for mass/collision */}
      <CuboidCollider args={[0.9, 0.3, 2]} />

      {/* Kenney sedan-sports body — shifted down so it sits on the physics wheels */}
      <primitive object={scene} rotation={[0, 0, 0]} position={[0, -0.35, 0]} />

      {/* ShapeCastWheels — physics + rolling visual tires.
          groundDetection="rayCast" instead of the default "shapeCast": logged
          evidence showed even ecctrl's stock config slowly builds a roll/pitch
          resonance across the 4 independently-solved wheels and eventually
          trips a Rapier WASM panic ("recursive use of an object") once
          velocities get large — simpler ray-vs-plane math is less likely to
          hit that edge case than the shapecast path.

          Front wheels are NOT brakeWheel: logged evidence (PhysicsDebug,
          space held at speed) showed a rear wheel's longitudinal friction
          impulse spiking 5-10x the others the instant all 4 wheels locked,
          sending yawRate from -70°/s to nearly -200°/s — a full spin-out.
          With all 4 wheels locked nothing is left providing steering grip to
          correct it. A real handbrake only locks the rear wheels, leaving
          the fronts free to roll and steer through the slide. */}
      <ShapeCastWheel groundDetection="rayCast" tireGripFactor={FRONT_TIRE_GRIP} relaxLatRate={RELAX_LAT_RATE} position={[-AXLE_X, 0, AXLE_Z_F]}  rayShapeR={WHEEL_R} rayShapeH={WHEEL_H} steerWheel driveWheel showWheelModel wheelModelRadius={WHEEL_R} />
      <ShapeCastWheel groundDetection="rayCast" tireGripFactor={FRONT_TIRE_GRIP} relaxLatRate={RELAX_LAT_RATE} position={[ AXLE_X, 0, AXLE_Z_F]}  rayShapeR={WHEEL_R} rayShapeH={WHEEL_H} steerWheel driveWheel showWheelModel wheelModelRadius={WHEEL_R} />
      <ShapeCastWheel groundDetection="rayCast" tireGripFactor={REAR_TIRE_GRIP} relaxLatRate={RELAX_LAT_RATE} position={[-AXLE_X, 0, AXLE_Z_R]}  rayShapeR={WHEEL_R} rayShapeH={WHEEL_H} driveWheel brakeWheel maxBrakeTorque={REAR_BRAKE_TORQUE} showWheelModel wheelModelRadius={WHEEL_R} />
      <ShapeCastWheel groundDetection="rayCast" tireGripFactor={REAR_TIRE_GRIP} relaxLatRate={RELAX_LAT_RATE} position={[ AXLE_X, 0, AXLE_Z_R]}  rayShapeR={WHEEL_R} rayShapeH={WHEEL_H} driveWheel brakeWheel maxBrakeTorque={REAR_BRAKE_TORQUE} showWheelModel wheelModelRadius={WHEEL_R} />
    </EcctrlVehicle>
  )
})

useGLTF.preload('/models/car.glb')

export default Car
