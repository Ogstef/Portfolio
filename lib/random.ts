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
