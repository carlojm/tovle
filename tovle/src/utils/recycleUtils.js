// src/utils/recycleUtils.js
// Mirror of server/recycle.js — keep in sync if rates change.

const FLOAT_TIERS = [
  { name: 'Pristine',  high: 0.07, multLow: 5.0, multHigh: 3.0 },
  { name: 'Untouched', high: 0.15, multLow: 3.0, multHigh: 2.0 },
  { name: 'Weathered', high: 0.38, multLow: 2.0, multHigh: 1.5 },
  { name: 'Rusted',    high: 0.45, multLow: 1.5, multHigh: 1.1 },
  { name: 'Decayed',   high: 1.00, multLow: 1.1, multHigh: 0.9 },
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

const getFloatTier = (float) => {
  return FLOAT_TIERS.find(t => float <= t.high) ?? FLOAT_TIERS[FLOAT_TIERS.length - 1]
}

export const getFloatLabel = (float) => {
  return getFloatTier(float).name
}

export const calcRecyclePrice = (tier, float) => {
  const base = TIER_BASE[tier] ?? 100
  const ft = getFloatTier(float)
  const range = ft.high - ft.low
  const t = range === 0 ? 0 : (float - ft.low) / range
  const multiplier = ft.multLow + t * (ft.multHigh - ft.multLow)
  return Math.round(base * multiplier)
}