// hello everybody my name is multiplier
const DEFAULT_MULTIPLIERS = {
  global: 1.0,
  cache: 1.0,
  items: {} // item-specific multipliers keyed by itemId
}

const LOOT_TABLE = [
  {
    itemId: 'den_piece_100',
    name: '100 Den Piece',
    rolls: 1,
    baseChance: 1.0, // guaranteed,
    unique: true //only ever drop one per cache
  },
  {
    itemId: 'eye_of_viridia',
    name: 'Eye of Viridia',
    rolls: 2,
    baseChance: 0.5,
  },
  {
    itemId: 'hyperexperience',
    name: 'Hyperexperience',
    rolls: 2,
    baseChance: 0.125,
  },
  {
    itemId: 'hypercrystalline_shard',
    name: 'Hypercrystalline Shard',
    rolls: 2,
    baseChance: 0.125,
  },
  {
    itemId: 'iron_nugget',
    name: 'Iron Nugget',
    rolls: 4,
    baseChance: 0.5825, // ~2.33 average
  },
  {
    itemId: 'gold_nugget',
    name: 'Gold Nugget',
    rolls: 2,
    baseChance: 0.665, // ~1.33 average
  },
  {
    itemId: 'pulsating_emerald',
    name: 'Pulsating Emerald',
    rolls: 1,
    baseChance: 0.1667,
  },
  {
    itemId: 'gleaming_seashell',
    name: 'Gleaming Seashell',
    rolls: 1,
    baseChance: 0.1667,
  },
  {
    itemId: 'twisted_strand',
    name: 'Twisted Strand',
    rolls: 1,
    baseChance: 0.1667,
  },
  {
    itemId: 'celsian_fragment',
    name: 'Celsian Fragment',
    rolls: 1,
    baseChance: 0.1667,
  },
  {
    itemId: 'ade',
    name: 'Amalgamated Dissonant Energy',
    rolls: 1,
    baseChance: 0.1667,
  },
  {
    itemId: 'harbinger',
    name: 'Harbinger',
    rolls: 1,
    baseChance: 0.0625,
  },
  // tier 1 fish — requires fishingNet >= 1
  {
    itemId: 'viridian_cod',
    name: 'Viridian Cod',
    rolls: 2,
    baseChance: 0.4,
    requiresUpgrade: 'fishingNet',
    requiresUpgradeLevel: 1,
  },
  {
    itemId: 'brown_carp',
    name: 'Brown Carp',
    rolls: 2,
    baseChance: 0.4,
    requiresUpgrade: 'fishingNet',
    requiresUpgradeLevel: 1,
  },
  {
    itemId: 'sandy_salmon',
    name: 'Sandy Salmon',
    rolls: 2,
    baseChance: 0.4,
    requiresUpgrade: 'fishingNet',
    requiresUpgradeLevel: 1,
  },
  {
    itemId: 'tundra_trout',
    name: 'Tundra Trout',
    rolls: 2,
    baseChance: 0.4,
    requiresUpgrade: 'fishingNet',
    requiresUpgradeLevel: 1,
  },

  // tier 2 fish — requires fishingNet >= 2
  

  {
    itemId: 'coffee_catfish',
    name: 'Coffee Catfish',
    rolls: 1,
    baseChance: 0.4,
    requiresUpgrade: 'fishingNet',
    requiresUpgradeLevel: 2,
  },
  {
    itemId: 'rosefish',
    name: 'Rosefish',
    rolls: 1,
    baseChance: 0.4,
    requiresUpgrade: 'fishingNet',
    requiresUpgradeLevel: 2,
  },
  {
    itemId: 'arcane_fish',
    name: 'Arcane Fish',
    rolls: 1,
    baseChance: 0.4,
    requiresUpgrade: 'fishingNet',
    requiresUpgradeLevel: 2,
  },
  {
    itemId: 'tropical_fish',
    name: 'Tropical Fish',
    rolls: 1,
    baseChance: 0.4,
    requiresUpgrade: 'fishingNet',
    requiresUpgradeLevel: 2,
  },
]

const AXOLOTL_LOOT_TABLE = [
  ...LOOT_TABLE.filter(entry => 
    !['viridian_cod', 'brown_carp', 'coffee_catfish', 'rosefish', 
      'sandy_salmon', 'tundra_trout', 'arcane_fish', 'tropical_fish', 
      'den_piece_100'].includes(entry.itemId)
  ),
  {
    itemId: 'torn_canvas',
    name: 'Torn Canvas',
    rolls: 3,
    baseChance: 0.5,
  },
]

const FILLER_BLOCKS = [
  { itemId: 'prismarine_block',  name: 'Prismarine Block',  weight: 25 },
  { itemId: 'prismarine_brick',  name: 'Prismarine Brick',  weight: 25 },
  { itemId: 'prismarine_wall',   name: 'Prismarine Wall',   weight: 20 },
  { itemId: 'warped_stem',       name: 'Warped Stem',       weight: 15 },
  { itemId: 'warped_hyphae',     name: 'Warped Hyphae',     weight: 15 },
]

const TREE_TO_ITEM = {
  dawnbringer: 'hyperexperience',
  frostborn: 'hypercrystalline_shard',
  earthbound: 'celsian_fragment',
  windwalker: 'gleaming_seashell',
  steelsage: 'pulsating_emerald',
  shadowdancer: 'twisted_strand',
  flamecaller: 'ade',
}
// +2% per room cleared in rooms cleared PB per tree
// ex. +40% at 20 room personal best
const getDepthsleItemBonuses = (bestRoomsByTree) => {
  const bonuses = {}
  for (const [tree, itemId] of Object.entries(TREE_TO_ITEM)) {
    const rooms = bestRoomsByTree[tree] ?? 0
    const bonusPct = rooms * 0.02
    bonuses[itemId] = 1 + bonusPct
  }
  return bonuses
}

const FILLER_MIN = 9
const FILLER_MAX = 12
const FILLER_BLOCK_MAX = 4
const GRID_SLOTS = 27

const rollChance = (chance) => Math.random() < chance

const getEffectiveChance = (baseChance, itemId, multipliers) => {
  const global = multipliers.global ?? 1.0
  const specific = multipliers.items?.[itemId] ?? 1.0
  return Math.min(baseChance * global * specific, 1.0)
}

const weightedPick = (options) => {
  const total = options.reduce((sum, o) => sum + o.weight, 0)
  let r = Math.random() * total
  for (const option of options) {
    r -= option.weight
    if (r <= 0) return option
  }
  return options[options.length - 1]
}

const rollFillerBlocks = (multiplier = 1.0) => {
  const min = Math.round(FILLER_MIN * multiplier)
  const max = Math.round(FILLER_MAX * multiplier)
  const block_max = Math.ceil(FILLER_BLOCK_MAX * multiplier)
  const count = min + Math.floor(Math.random() * (max-min+1))
  const tallies = {} // itemId -> count so far
  const results = []

  for (let i = 0; i < count; i++) {
    // filter out blocks that have hit the cap
    const available = FILLER_BLOCKS.filter(b => (tallies[b.itemId] ?? 0) < block_max)
    if (available.length === 0) break // safety — shouldn't happen with 9-12 count and 5 types capped at 4
    const pick = weightedPick(available)
    tallies[pick.itemId] = (tallies[pick.itemId] ?? 0) + 1
    results.push({ itemId: pick.itemId, name: pick.name })
  }

  return results
}

const placeInGrid = (items) => {
  //generates the 3x9 grid that represents the chest view of the cache loot
  //lots of code written with help from claude to try and spread the loot
  //across all the slots as nice looking as possible

  const grid = Array(GRID_SLOTS).fill(null)

  if (items.length <= GRID_SLOTS) {
    // no stacking needed, place individually in random slots
    const slots = Array.from({ length: GRID_SLOTS }, (_, i) => i)
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[slots[i], slots[j]] = [slots[j], slots[i]]
    }
    items.forEach((item, i) => {
      grid[slots[i]] = { itemId: item.itemId, name: item.name, quantity: 1 }
    })
    return grid
  }

  // overflow case — need to stack some items to fit in 27 slots
  // count how many of each item we have
  const counts = {}
  for (const item of items) {
    if (!counts[item.itemId]) {
      counts[item.itemId] = { itemId: item.itemId, name: item.name, quantity: 0 }
    }
    counts[item.itemId].quantity++
  }

  // start with one slot per unique item
  const stacks = Object.values(counts)

  // if we still have more unique items than slots, stack the smallest quantities together
  // this is an edge case that would require enormous multipliers to hit
  while (stacks.length > GRID_SLOTS) {
    stacks.sort((a, b) => a.quantity - b.quantity)
    stacks[1].quantity += stacks[0].quantity
    stacks.shift()
  }

  // shuffle and place
  const slots = Array.from({ length: GRID_SLOTS }, (_, i) => i)
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[slots[i], slots[j]] = [slots[j], slots[i]]
  }

  stacks.forEach((stack, i) => {
    grid[slots[i]] = stack
  })

  return grid
}

const stackItems = (items) => {
  const map = {}
  for (const item of items) {
    if (map[item.itemId]) {
      map[item.itemId].quantity++
    } else {
      map[item.itemId] = { itemId: item.itemId, name: item.name, quantity: 1 }
    }
  }
  return Object.values(map)
}

//=========== main functions ===============
const rollLoot = (multipliers = DEFAULT_MULTIPLIERS, playerUpgrades = {}, source = 'cache') => {
  const items = []
  const mult = (multipliers.global ?? 1.0) * (multipliers.cache ?? 1.0)
  // console.log(mult, (multipliers.global ?? 1.0), (multipliers.cache ?? 1.0))
  const table = source === 'axolotl' ? AXOLOTL_LOOT_TABLE : LOOT_TABLE

  // roll each item in the loot table
  for (const entry of table) {
    //skip item if it needs an upgrade that player doesn't have
    if (entry.requiresUpgrade) {
      const playerLevel = playerUpgrades[entry.requiresUpgrade] ?? 0
      const requiredLevel = entry.requiresUpgradeLevel ?? 1
      if (playerLevel < requiredLevel) continue
    }

    const itemMultiplier = multipliers.items?.[entry.itemId] ?? 1.0
    const totalMultiplier = mult * itemMultiplier

    const effectiveRolls = Math.floor(entry.rolls * totalMultiplier)
    const remainder = (entry.rolls * totalMultiplier) % 1

    //the way multipliers/luck effect loot is by adding extra rolls.
    //ex. at base multiplier of 1.0, hxp is rolled twice at 12.5% chance each.
    //ex. at multiplier of 1.1, hxp is rolled twice at 12.5% and once at 2.5%.
    //ex. at multiplier of 10, hxp is rolled twice at 12.5% and 18 more times at 12.5%
    //or something like that... that's the plan anyways idk if it should be + or * base rolls

    let rollCount = 0 //track how many times an item is added

    //full rolls at base chance
    for (let i = 0; i < effectiveRolls; i++) {
      if (rollChance(entry.baseChance)) {
        if (entry.unique && rollCount >= 1) continue //skip if unique item alrdy rolled once
        items.push({ itemId: entry.itemId, name: entry.name })
        rollCount++
      }
    }

    // partial roll for the remainder
    if (remainder > 0 && !(entry.unique && rollCount >= 1)) {
      if (rollChance(entry.baseChance * remainder)) {
        items.push({ itemId: entry.itemId, name: entry.name })
      }
    }
  }

  // roll filler blocks
  // TODO if we want an upgrade for specifically the filler block loot chances we need to update this
  const fillers = rollFillerBlocks(mult)
  items.push(...fillers)

  //make a version of the items list where items are in stacks
  const stackedItems = stackItems(items)

  // place everything in the 27-slot grid
  const grid = placeInGrid(items)

  return { items: stackedItems, grid }
}

//caches will get scores based on different factors (TODO)
//with this formula, score 25 = 0.95x, score 100 = 1.4x, score 200 = 2x, + .6x per 100 score
const scoreToLuckMultiplier = (score) => {
  return 0.8 + (score / 100) * 0.6
}

export { rollLoot, scoreToLuckMultiplier, placeInGrid, getDepthsleItemBonuses }