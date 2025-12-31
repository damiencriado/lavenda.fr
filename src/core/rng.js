const RNG_SEED = 1337;

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export const rng = mulberry32(RNG_SEED);

export function pickRandom(arr) {
  return arr[Math.floor(rng() * arr.length)];
}

