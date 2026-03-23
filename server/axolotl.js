const COMMON_FISH = [
  'viridian_cod',
  'brown_carp',
  'sandy_salmon',
  'tundra_trout',
]

const ALL_FISH = [
  'viridian_cod',
  'brown_carp',
  'sandy_salmon',
  'tundra_trout',
  'coffee_catfish',
  'rosefish',
  'tropical_fish',
  'arcane_fish',
]

const RARE_FISH_UNLOCK_LEVEL = 4 //level where you start needing all fish

const BASE_FISH_COUNT = 3 //level x needs 3*x fish

const generateLevelRequirements = (targetLevel, quality) => {
  const fishCount = BASE_FISH_COUNT * targetLevel * quality
  const pool = targetLevel >= RARE_FISH_UNLOCK_LEVEL ? ALL_FISH : COMMON_FISH
  const picks = {}

  for (let i = 0; i < fishCount; i++) {
    const fish = pool[Math.floor(Math.random() * pool.length)]
    picks[fish] = (picks[fish] ?? 0) + 1
  }

  // convert to array format: [{ fish: 'viridian_cod', quantity: 2 }, ...]
  return Object.entries(picks).map(([fish, quantity]) => ({ fish, quantity }))
}

const createAxolotl = () => {
  const id = `axolotl_${Date.now()}`
  return {
    id,
    name: 'Axolotl',
    level: 1,
    quality: 1,
    hunger: 0,
    lastCollected: null,
    fishEaten: {},
    levelRequirements: {
      2: generateLevelRequirements(2, 1)
    }
  }
}

module.exports = { createAxolotl, generateLevelRequirements }