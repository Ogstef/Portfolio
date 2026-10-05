import { useGLTF } from '@react-three/drei'

// Every environment GLB in one place (ENVIRONMENT_PLAN.md §2.6). All are
// meshopt-compressed — drei's useGLTF already bundles that decoder, so
// unlike Draco there's no extra decoder download or CDN fetch.
// Sources and licences: public/models/env/CREDITS.md.
export const ENV_ASSETS = {
  nature: '/models/env/nature.glb',
  props: '/models/env/props.glb',
} as const

// No Draco in any env asset — pass false so drei never wires up its
// CDN-hosted Draco decoder for these.
export const ENV_USE_DRACO = false

// Kicked off from BootSequence (via dynamic import, so drei/three stay out
// of the first-load bundle) so the models download behind the typewriter
// intro rather than after "Start Engine".
export function preloadEnvAssets() {
  for (const url of Object.values(ENV_ASSETS)) useGLTF.preload(url, ENV_USE_DRACO)
}
