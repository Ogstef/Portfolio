'use client'

import { EffectComposer, Bloom, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

// Subtle post-processing (ENVIRONMENT_PLAN.md Phase 6). Only loaded as its
// own lazy chunk, and only on capable devices — see PostFX.tsx.
//
// The threshold is high so only emissive surfaces bloom (reflector caps,
// lamps, the vault ring, diner neon, finale rim), not lit dirt or sky.
// EffectComposer switches the renderer's own tone mapping off, so ACES is
// re-applied here as a pass to keep colours identical to the no-FX path.
export default function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.1} intensity={0.65} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.32} darkness={0.42} />
    </EffectComposer>
  )
}
