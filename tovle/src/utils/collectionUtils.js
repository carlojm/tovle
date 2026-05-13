import islesItems from '../data/islesItems.json'

// All items grouped by tier, computed once at module level
const ITEMS_BY_TIER = {}
for (const [key, def] of Object.entries(islesItems)) {
  if (!def.tier) continue
  if (!ITEMS_BY_TIER[def.tier]) ITEMS_BY_TIER[def.tier] = []
  ITEMS_BY_TIER[def.tier].push(key)
}

export const TIER_TOTALS = Object.fromEntries(
  Object.entries(ITEMS_BY_TIER).map(([tier, items]) => [tier, items.length])
)

// Returns { [tier]: collectedCount } for a player's equipmentCollection
export function getCollectedPerTier(collection) {
  const counts = {}
  for (const key of Object.keys(collection)) {
    const tier = islesItems[key]?.tier
    if (!tier) continue
    counts[tier] = (counts[tier] ?? 0) + 1
  }
  return counts
}

// Returns collected count for a specific tier
export function getCollectedForTier(collection, tier) {
  return getCollectedPerTier(collection)[tier] ?? 0
}