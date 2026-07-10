//math helpers and consts written by claude thanks claude

const FLOAT_TIERS = [
  { name: 'Pristine',  low: 0.00, high: 0.07, multLow: 5.0, multHigh: 3.0 },
  { name: 'Untouched', low: 0.08, high: 0.15, multLow: 3.0,  multHigh: 2.0 },
  { name: 'Weathered', low: 0.16, high: 0.38, multLow: 2.0,  multHigh: 1.5 },
  { name: 'Rusted',    low: 0.39, high: 0.45, multLow: 1.5,  multHigh: 1.1 },
  { name: 'Decayed',   low: 0.46, high: 1.00, multLow: 1.1,  multHigh: 0.9 },
]

const TIER_BASE = {
  'Tier 1':   100,
  'Tier 2':   150,
  'Tier 3':   200,
  'Tier 4':   250,
  'Tier 5':   300,
  'Uncommon': 400,
  'Unique':   500,
  'Rare':     5000,
  'Artifact': 20000,
}

// Returns the float tier object for a given float value.
// Falls back to Decayed if somehow nothing matches (shouldn't happen).
const getFloatTier = (float) => {
  return FLOAT_TIERS.find(t => float >= t.low && float <= t.high) ?? FLOAT_TIERS[4]
}

// Returns the display label for a float value, e.g. "Pristine", "Rusted".
const getFloatLabel = (float) => {
  return getFloatTier(float).name
}

// Returns the den piece payout for recycling an item.
// Interpolates the multiplier within the float tier so every item
// has a unique price — lower float always yields a higher payout.
const calcRecyclePrice = (tier, float) => {
  const base = TIER_BASE[tier] ?? 100

  const ft = getFloatTier(float)

  // t goes 0 → 1 as float goes from the low end to the high end of the tier.
  // At t=0 (best float in tier) we apply multLow (highest multiplier).
  // At t=1 (worst float in tier) we apply multHigh (lowest multiplier).
  const range = ft.high - ft.low
  const t = range === 0 ? 0 : (float - ft.low) / range
  const multiplier = ft.multLow + t * (ft.multHigh - ft.multLow)

  return Math.round(base * multiplier)
}

export { getFloatLabel, calcRecyclePrice }