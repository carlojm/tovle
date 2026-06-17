// Seeded RNG for Depthsle. All randomness is derived from the daily seed so
// every player sees the same dungeon structure on a given day.
//
// mulberry32: fast, good distribution, stateless when used via closure.
// hashCombine: mix seed with a string category + numeric index so each
// "draw type" (classSelect, enemyHp, layoutPick…) is independent.

function mulberry32(seed) {
  let s = seed >>> 0
  return function () {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Simple string hash (djb2) so category names become numeric offsets.
function hashStr(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(h, 33) ^ str.charCodeAt(i)) >>> 0
  }
  return h
}

// Combine the daily seed with a category name and index to get a
// deterministic, category-isolated seed. Call mulberry32() on the result.
export function hashCombine(seed, category, index) {
  return (seed ^ hashStr(category) ^ (index * 2654435761)) >>> 0
}

// Parse "YYYYMMDD" → integer seed.
export function buildDailySeed(dateString) {
  return parseInt(dateString.replace(/-/g, ''), 10) >>> 0
}

// Get today's date as "YYYYMMDD" in Eastern Time.
export function todayDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).replace(/-/g, '')
}

// Convenience: build a PRNG for (seed, category, index).
// Returns a () => [0,1) function.
export function deriveRng(seed, category, index) {
  return mulberry32(hashCombine(seed, category, index))
}

// Pick a random integer in [min, max] inclusive.
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1))
}

// Pick one element from an array using a seeded rng.
export function randChoice(rng, arr) {
  return arr[Math.floor(rng() * arr.length)]
}

// Shuffle an array (Fisher-Yates) using a seeded rng. Returns new array.
export function shuffle(rng, arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export { mulberry32 }
