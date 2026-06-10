// Seeded, serializable PRNG (mulberry32). State is a single uint32 so it
// round-trips through JSON, which is what makes runs replayable from a seed.

export interface RngState {
  s: number;
}

export function seedRng(seed: string): RngState {
  // xmur3 string hash to derive the initial state
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return { s: (h ^ (h >>> 16)) >>> 0 };
}

export function nextFloat(rng: RngState): [number, RngState] {
  const t = (rng.s + 0x6d2b79f5) >>> 0;
  let r = t;
  r = Math.imul(r ^ (r >>> 15), r | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return [value, { s: t }];
}

export function nextInt(rng: RngState, maxExclusive: number): [number, RngState] {
  const [v, next] = nextFloat(rng);
  return [Math.floor(v * maxExclusive), next];
}
