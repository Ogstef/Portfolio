// Deterministic PRNG (mulberry32) so procedural layouts are stable across
// renders — unlike Math.random(), which would reshuffle everything every
// time a component re-renders.
export function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rand = () => number

export function range(rand: Rand, a: number, b: number) {
  return a + rand() * (b - a)
}

export function pick<T>(rand: Rand, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}

// Seeded 2D value noise in [0,1] — smooth, non-repeating, for displacing
// procedural geometry (canyon walls). Same seed → same field.
export function createNoise2D(seed: number) {
  const hash = (x: number, y: number) => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }
  return (x: number, y: number) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const tx = x - x0
    const ty = y - y0
    const sx = tx * tx * (3 - 2 * tx)
    const sy = ty * ty * (3 - 2 * ty)
    const a = hash(x0, y0)
    const b = hash(x0 + 1, y0)
    const c = hash(x0, y0 + 1)
    const d = hash(x0 + 1, y0 + 1)
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  }
}
