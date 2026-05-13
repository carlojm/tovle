export const calculatePrestigeHearts = (stats = {}) => {
  const tower = stats.bestPrestigeTowerHeight ?? 0
  const crystals = stats.totalPrestigeCrystalsEarned ?? 0
  const shards = stats.totalPrestigeShardsEarned ?? 0
  const fuel = stats.totalPrestigeFuelSpent ?? 0

  const raw = tower * 0.01 + crystals * 0.001 + shards * 0.01 + fuel * 0.01
  return Math.floor(Math.sqrt(raw) * 10) / 10
}

const SPEED_EXPONENT_BASE = 1.15
const SPEED_EXPONENT_FLOOR = 1.03
const SPEED_EXPONENT_REDUCTION = (SPEED_EXPONENT_BASE - SPEED_EXPONENT_FLOOR) / 20

export const computeForumUnlocks = (upgrades = {}) => {
  const level = (id) => upgrades[id] ?? 0

  // speed curb — 4 nodes x 5 levels = 20 total levels
  const totalSpeedLevels = level('speed_curb_1') + level('speed_curb_2') + level('speed_curb_3') + level('speed_curb_4')
  const speedExponent = Math.max(SPEED_EXPONENT_FLOOR, SPEED_EXPONENT_BASE - totalSpeedLevels * SPEED_EXPONENT_REDUCTION)

  //prestige upgrades
  //these are not passed to the game, we calculate the bonuses here in this file in other vars
  const crystalMultiplierPermanent = Math.pow(1.5, level('crystal_multiplier_permanent'))
  const luckMultiplierPermanent = 1 + level('luck_multiplier_permanent') * 0.15
  //this one is passed to the game
  const fuelSaverPermanent = level('fuel_saver_permanent') * 0.20

  // crystal gain multiplier — stacks multiplicatively across tiers
  const crystalMultiplier =
    Math.pow(1.5, level('crystal_gain_1')) *
    Math.pow(1.5, level('crystal_gain_2')) *
    Math.pow(1.5, level('crystal_gain_3')) *
    crystalMultiplierPermanent

  // active crystal gain — bonus crystals per active trigger (perfect, anchor, crit)
  // multiplied by crystal multiplier at end of game
  // const activeCrystalGain = level('crystal_active_gain_1') + level('crystal_active_gain_2')
  const activeCrystalGain = 
    (level('crystal_active_gain_1') + 
    level('crystal_active_gain_2')) * 
    crystalMultiplierPermanent

  // anchor chance — 0 before unlock, 5% base after unlock, +3% per level
  const anchorUnlocked = level('anchor_unlock') >= 1
  const anchorChance = anchorUnlocked ? (0.05 + level('anchor_chance_1') * 0.05) + luckMultiplierPermanent : 0

  // perfect placement
  const perfectPlacementUnlocked = level('perfect_placement') >= 1
  const perfectThreshold = perfectPlacementUnlocked
    ? 0.05 + level('perfect_threshold_1') * 0.0075  // 0.05 to 0.875 over 5 levels
    : 0.05 // default threshold even without unlock, just no width preservation

  // perfect anchor
  // triggers on perfect placement, grows the block
  const perfectAnchorUnlocked = level('perfect_anchor') >= 1
  const perfectAnchorChance = perfectAnchorUnlocked ? (0.1 + level('perfect_anchor_chance_1') * 0.1) + luckMultiplierPermanent : 0
  const perfectAnchorGrowthFactor = 0.1 + level('perfect_anchor_growth_1') * 0.05 // 0.1 to 0.35

  // bubbles / crits
  const bubblesUnlocked = level('bubble_unlock') >= 1
  const bubbleChance = bubblesUnlocked ? (0.2 + level('bubble_chance_1') * 0.10) + luckMultiplierPermanent : 0
  const bubbleAmount = bubblesUnlocked ? 1 + level('bubble_amount_1') : 0
  const critChainChance = bubblesUnlocked ? (level('crit_chain_1') * 0.1) + luckMultiplierPermanent : 0

  // crit anchor
  const critAnchorUnlocked = level('crit_anchor_unlock') >= 1
  const critAnchorChance = critAnchorUnlocked ? (0.1 + level('crit_anchor_chance_1') * 0.1) + luckMultiplierPermanent : 0
  const critAnchorGrowth = critAnchorUnlocked ? 0.1 + level('crit_anchor_growth_1') * 0.05 : 0

  // starting width
  const startingWidth = 100 + level('starting_width') * 10  // 100 to 150

  // fuel
  const fuelCapacity = level('fuel_cap_3') >= 1 ? 250
    : level('fuel_cap_2') >= 1 ? 100
    : level('fuel_cap_1') >= 1 ? 50
    : 20
  // note: we only have fuel_cap_1 as one node right now, expand as we add more

  const fuelEfficiencyMultiplier = 1 + level('fuel_efficiency_1') * 0.1  // 1.0 to 1.5

  // meta unlocks
  const reviveUnlocked = level('revive') >= 1
  // maxBlocksPerTap: 1 = locked (default), 2-5 = unlocked tiers
  // level 0 = not bought = max 1 block per tap (hidden in modal)
  // level 1 = max 2 blocks per tap, level 2 = max 3, etc.
  const maxBlocksPerTap = 1 + level('blocks_per_tap_1')
  const dailyRefundUnlocked = level('daily_runs_1') >= 1

  // travel unlocks
  const forumTier = level('forum_core') >= 1
    ? level('forum_tier_1') >= 1 ? 1 : 0
    : 0
  const alneraUnlocked = level('alnera_unlock') >= 1
  const axolotl3Unlocked = level('axolotl_3') >= 1
  const autoFeedUnlocked = level('auto_feed') >= 1
  const bulkCacheOpenUnlocked = level('bulk_cache_open') >= 1

  // shard unlocks
  const shardsUnlocked = level('shards_unlock') >= 1
  const heartsUnlocked = level('hearts_unlock') >= 1
  const activeShardGain = shardsUnlocked ? (1 + level('shard_active_gain_1') + level('shard_active_gain_2')) : 0
  // const shardPassiveGain = level('shard_passive_gain_1')
  const shardPassiveGainUnlocked = level('shard_passive_gain_1') >= 1
  const shardPassiveGain = shardPassiveGainUnlocked ? Math.pow(1.5, level('shard_passive_gain_1')) : 0

  // prestige
  const prestigeUnlocked = heartsUnlocked // alias for clarity at call sites

  return {
    // speed
    speedExponent,

    // crystals
    crystalMultiplier,
    activeCrystalGain,

    // perfect placement
    perfectPlacementUnlocked,
    perfectThreshold,

    // anchor
    anchorUnlocked,
    anchorChance,

    // perfect anchor
    perfectAnchorUnlocked,
    perfectAnchorChance,
    perfectAnchorGrowthFactor,

    // bubbles
    bubblesUnlocked,
    bubbleChance,
    bubbleAmount,
    critChainChance,

    // crit anchor
    critAnchorUnlocked,
    critAnchorChance,
    critAnchorGrowth,

    // starting width
    startingWidth,

    // fuel
    fuelCapacity,
    fuelEfficiencyMultiplier,

    // meta
    reviveUnlocked,
    maxBlocksPerTap,
    dailyRefundUnlocked,

    // travel
    forumTier,
    alneraUnlocked,
    axolotl3Unlocked,
    autoFeedUnlocked,
    bulkCacheOpenUnlocked,

    // currencies
    shardsUnlocked,
    heartsUnlocked,
    activeShardGain,
    shardPassiveGain,

    //prestige
    prestigeUnlocked,
    fuelSaverPermanent,
  }
}