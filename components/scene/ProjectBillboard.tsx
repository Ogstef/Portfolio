'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text, Image } from '@react-three/drei'
import * as THREE from 'three'
import type { Project } from '@/data/projects'
import { createProjectThumbnail } from '@/lib/canvasTextures'
import { SIGN_Y } from './sceneConstants'

const BOB_SPEED = 0.6
const BOB_AMOUNT = 0.12

// Card layout — computed, not eyeballed, so the picture/title/card/rim all
// actually line up instead of drifting apart into the hazy misaligned mess
// the old (image offset one way, card centered a different way) version had.
const IMG_W = 4.4
const IMG_H = (IMG_W * 9) / 16
const PAD = 0.18
const TITLE_H = 0.5
const CARD_W = IMG_W + PAD * 2
const CARD_H = IMG_H + TITLE_H + PAD * 3
const RIM_W = CARD_W + 0.1
const RIM_H = CARD_H + 0.1
const IMAGE_Y = CARD_H / 2 - PAD - IMG_H / 2
const TITLE_Y = IMAGE_Y - IMG_H / 2 - PAD - TITLE_H / 2

type Props = {
  project: Project
}

export default function ProjectBillboard({ project: p }: Props) {
  const texture = useMemo(() => createProjectThumbnail(p), [p])
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])
  const billboardRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!billboardRef.current) return
    billboardRef.current.position.y = SIGN_Y + Math.sin(clock.elapsedTime * BOB_SPEED + phase) * BOB_AMOUNT
  })

  return (
    <group position={[p.signX, 0, 0]}>
      {/* Pole */}
      <mesh position={[0, 3, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.12, 6, 8]} />
        <meshStandardMaterial color="#3a3a4a" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Accent cap */}
      <mesh position={[0, 6, 0]}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshStandardMaterial color={p.accent} emissive={p.accent} emissiveIntensity={0.8} />
      </mesh>

      {/* Billboard — auto-faces the camera, gently bobs for a bit of life */}
      <Billboard ref={billboardRef} position={[0, SIGN_Y, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {/* Accent rim — solid & opaque, reads as a crisp frame edge instead of a glowing haze */}
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[RIM_W, RIM_H]} />
          <meshStandardMaterial color={p.accent} emissive={p.accent} emissiveIntensity={0.35} fog={false} />
        </mesh>

        {/* Backing card — solid & opaque */}
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[CARD_W, CARD_H]} />
          <meshStandardMaterial color="#0a0a16" fog={false} />
        </mesh>

        {/* Screenshot-style thumbnail */}
        <Image texture={texture} position={[0, IMAGE_Y, 0.01]} scale={[IMG_W, IMG_H]} radius={0.06} transparent />

        {/* Project title — tagline/description live in the 2D panel once you're close, no need to repeat it here */}
        <Text position={[0, TITLE_Y, 0.01]} fontSize={0.32} color="#ffffff" anchorX="center" anchorY="middle" maxWidth={CARD_W - PAD * 2}>
          {p.title}
        </Text>
      </Billboard>
    </group>
  )
}
