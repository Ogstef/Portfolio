import * as THREE from 'three'
import { getPlankTexture } from '@/lib/canvasTextures'

// Wood-plank look shared by the side ramps (Ramps.tsx) and the gap-jump
// ramps (GapRamp.tsx), so both read as built structures, not dirt mounds.

const PLANK_TILE = 2.4 // metres per texture repeat (6 boards → 0.4 m boards)

let material: THREE.MeshStandardMaterial | null = null

export function getPlankMaterial() {
  return (material ??= new THREE.MeshStandardMaterial({ map: getPlankTexture(), roughness: 0.85, metalness: 0 }))
}

// BoxGeometry whose UVs are scaled to the box's real size, so planks stay
// the same width on every box. The texture's boards run along U; on the top
// and bottom faces U follows X, so `boardsAlong: 'z'` swaps U/V there to lay
// the boards along Z instead — always choose the axis ACROSS the direction
// of travel, so it reads like a boardwalk.
//
// BoxGeometry's 24 vertices are 6 faces × 4, in the order +X −X +Y −Y +Z −Z;
// each face's (U,V) spans: ±X → (d,h), ±Y → (w,d), ±Z → (w,h).
export function plankBox(w: number, h: number, d: number, boardsAlong: 'x' | 'z') {
  const geo = new THREE.BoxGeometry(w, h, d)
  const uv = geo.attributes.uv as THREE.BufferAttribute
  const spans: Array<[number, number]> = [
    [d, h], [d, h],
    [w, d], [w, d],
    [w, h], [w, h],
  ]
  for (let face = 0; face < 6; face++) {
    const [su, sv] = spans[face]
    const swap = boardsAlong === 'z' && (face === 2 || face === 3)
    for (let v = face * 4; v < face * 4 + 4; v++) {
      const u0 = uv.getX(v)
      const v0 = uv.getY(v)
      if (swap) uv.setXY(v, (v0 * sv) / PLANK_TILE, (u0 * su) / PLANK_TILE)
      else uv.setXY(v, (u0 * su) / PLANK_TILE, (v0 * sv) / PLANK_TILE)
    }
  }
  return geo
}
