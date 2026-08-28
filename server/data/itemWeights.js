//thank you claude gpt for making item weight values based on loot table in loot.js
//used for generating trades

// server/data/itemWeights.js
// Trade value weights derived from loot table expected drops per cache.
// Higher weight = rarer = more valuable in trades.
// Formula: weight ≈ 1 / (rolls × baseChance), normalized to iron_nugget = 1.
// Items excluded: den_piece_100 (unique score token), prismarine_crystals,
//   prismarine_shard, heart_of_the_sea (separate currency system).

const ITEM_WEIGHTS = {

  // ── Core drops ───────────────────────────────────────────────────────────
  // iron_nugget: 4 × 0.5825 ≈ 2.33 avg/cache → baseline weight 1
  iron_nugget:            1,

  // gold_nugget: 2 × 0.665 ≈ 1.33 avg/cache
  gold_nugget:            2,

  // eye_of_viridia: 2 × 0.5 = 1.0 avg/cache
  eye_of_viridia:         3,

  // hyperexperience: 2 × 0.125 = 0.25 avg/cache
  hyperexperience:        10,

  // hypercrystalline_shard: 2 × 0.125 = 0.25 avg/cache
  hypercrystalline_shard: 10,

  // pulsating_emerald: 1 × 0.1667 ≈ 0.17 avg/cache
  pulsating_emerald:      12,

  // gleaming_seashell: 1 × 0.1667 ≈ 0.17 avg/cache
  gleaming_seashell:      12,

  // twisted_strand: 1 × 0.1667 ≈ 0.17 avg/cache
  twisted_strand:         12,

  // celsian_fragment: 1 × 0.1667 ≈ 0.17 avg/cache
  celsian_fragment:       12,

  // ade: 1 × 0.1667 ≈ 0.17 avg/cache
  ade:                    12,

  // harbinger: 1 × 0.0625 = 0.06 avg/cache — rarest core drop
  harbinger:              35,

  // ── Fish (tier 1, requires fishingNet ≥ 1) ───────────────────────────────
  // 2 × 0.4 = 0.8 avg/cache
  viridian_cod:           4,
  brown_carp:             4,
  sandy_salmon:           4,
  tundra_trout:           4,

  // ── Fish (tier 2, requires fishingNet ≥ 2) ───────────────────────────────
  // 1 × 0.4 = 0.4 avg/cache
  coffee_catfish:         12,
  rosefish:               12,
  arcane_fish:            12,
  tropical_fish:          12,

  // ── Axolotl loot ─────────────────────────────────────────────────────────
  // torn_canvas: 3 × 0.5 = 1.5 avg/cache (axolotl source only)
  // Slightly above gold_nugget since it requires the axolotl system
  torn_canvas:            6,

  // ── Filler blocks ────────────────────────────────────────────────────────
  // Very common, low value. Good for the "want" side of trades.
  // Probably shouldn't appear on the "offer" side — feels bad to receive.
  prismarine_block:       1,
  prismarine_brick:       1,
  prismarine_wall:        1,
  warped_stem:            1,
  warped_hyphae:          1,
}

// Items that should only appear on the WANT side of trades (not given as rewards).
// Getting filler blocks back from a trade feels unrewarding.
const WANT_ONLY_ITEMS = new Set([
  'prismarine_block',
  'prismarine_brick',
  'prismarine_wall',
  'warped_stem',
  'warped_hyphae',
])

// Convenience: all tradeable item IDs
const TRADEABLE_ITEMS = Object.keys(ITEM_WEIGHTS)

export { ITEM_WEIGHTS, WANT_ONLY_ITEMS, TRADEABLE_ITEMS }