'use client'

import { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls, Stars, Sky } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import type { EcctrlVehicleHandle } from 'ecctrl/vehicle'
import type { Project } from '@/data/projects'
import { projects } from '@/data/projects'
import { keyMap } from '@/lib/vehicleInput'
import Car, { SPAWN_POSITION } from './Car'
import Ground from './Ground'
import Road from './Road'
import StopMarkers from './StopMarkers'
import FollowCamera from './FollowCamera'
import VehicleInputBridge from './VehicleInputBridge'
import VehicleReset from './VehicleReset'
import VehicleUpright from './VehicleUpright'
import VehicleYawLimiter from './VehicleYawLimiter'
import Ramps from './Ramps'
import GapRamp from './GapRamp'
import { GAPS } from '@/lib/gapJump'
import FallSafety from './FallSafety'
import Scenery from './Scenery'
import RoadDressing from './RoadDressing'
import CanyonWalls from './CanyonWalls'
import StopDiorama from './StopDiorama'
import AmbientLife from './AmbientLife'
import DustTrail from './DustTrail'
import AfterFirstFrame from './AfterFirstFrame'
import DistantLandmarks from './DistantLandmarks'
import FinaleSign from './FinaleSign'
import EasterEgg from './EasterEgg'
import PostFX from './PostFX'
import ShaderWarmup from './ShaderWarmup'
import SkyLife from './SkyLife'
import Horizon from './Horizon'
import PhysicsDebug from './PhysicsDebug'
import SunLight from './SunLight'
import RenderStats from './RenderStats'

type Props = {
  activeProject: Project | null
  engineStarted: boolean
  onEnterStop: (project: Project) => void
  onLeaveStop: (project: Project) => void
  resetSignal: number
}

export default function DriveScene({ activeProject, engineStarted, onEnterStop, onLeaveStop, resetSignal }: Props) {
  const vehicleRef = useRef<EcctrlVehicleHandle>(null)

  return (
    <KeyboardControls map={keyMap}>
      <Canvas
        shadows
        // Capped at 1.5× pixel density: on retina screens the default 2×
        // renders ~78% more pixels (plus bloom on top) for a barely visible gain.
        dpr={[1, 1.5]}
        camera={{ position: [0, 6, -14], fov: 60 }}
        className="w-full h-full"
      >
        <fog attach="fog" args={['#c8601a', 25, 150]} />
        <ambientLight color="#ffaa60" intensity={0.6} />
        <SunLight vehicleRef={vehicleRef} />
        <directionalLight color="#6040c0" position={[-8, 4, 10]} intensity={0.4} />

        <Sky sunPosition={[1, 0.03, -0.5]} turbidity={12} rayleigh={3} mieCoefficient={0.008} mieDirectionalG={0.85} />
        <Stars radius={150} depth={60} count={3000} factor={3} fade speed={0.4} />
        <SkyLife />
        <Horizon />
        <DistantLandmarks />

        <Suspense fallback={null}>
          <Physics gravity={[0, -20, 0]}>
            <Ground />
            <Road />
            <Ramps />
            {GAPS.map((gap, i) => (
              <GapRamp key={i} gap={gap} />
            ))}
            <Suspense fallback={null}>
              <Scenery />
            </Suspense>
            <RoadDressing />
            <CanyonWalls />
            <StopDiorama />
            <FinaleSign />
            <EasterEgg />
            <Car ref={vehicleRef} />
            <StopMarkers
              projects={projects}
              vehicleRef={vehicleRef}
              onEnter={onEnterStop}
              onLeave={onLeaveStop}
            />
            <VehicleInputBridge
              vehicleRef={vehicleRef}
              locked={activeProject !== null || !engineStarted}
              onExit={() => {
                if (activeProject) onLeaveStop(activeProject)
              }}
            />
            <VehicleReset vehicleRef={vehicleRef} resetSignal={resetSignal} spawn={SPAWN_POSITION} />
            <FallSafety vehicleRef={vehicleRef} />
            <VehicleUpright vehicleRef={vehicleRef} />
            <VehicleYawLimiter vehicleRef={vehicleRef} />
            <PhysicsDebug vehicleRef={vehicleRef} />
          </Physics>
          <FollowCamera vehicleRef={vehicleRef} activeProject={activeProject} />
          <AfterFirstFrame>
            <AmbientLife />
            <DustTrail vehicleRef={vehicleRef} />
            <PostFX />
            <Suspense fallback={null}>
              <ShaderWarmup />
            </Suspense>
          </AfterFirstFrame>
          <RenderStats vehicleRef={vehicleRef} />
        </Suspense>
      </Canvas>
    </KeyboardControls>
  )
}
