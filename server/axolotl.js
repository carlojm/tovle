const FISH_POOL = [
  'viridian_cod',
  'brown_carp',
  'coffee_catfish',
  'rosefish',
  'sandy_salmon',
  'tundra_trout',
  'arcane_fish',
  'tropical_fish',
]

const generateLevelRequirements = (targetLevel, quality) => {
  const fishCount = targetLevel * quality
  const picks = {}

  for (let i = 0; i < fishCount; i++) {
    const fish = FISH_POOL[Math.floor(Math.random() * FISH_POOL.length)]
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