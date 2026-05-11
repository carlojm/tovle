// Frontend copy of backend tier weight logic
// Keep in sync with server/shipments.js

const MAX_REP = 10000
const FALLOFF = 1.4

export const TIER_ORDER = [
  'Tier 1',
  'Tier 2',
  'Tier 3',
  'Tier 4',
  'Tier 5',
  'Uncommon',
  'Unique',
]

export const MAX_TIER_BY_FORUM = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6, // unlocks Uncommon
  7: 7, // unlocks Unique
}

export const JACKPOT_CHANCE = {
  1: { Artifact: 0.001, Rare: 0.01  },
  2: { Artifact: 0.002, Rare: 0.02  },
  3: { Artifact: 0.004, Rare: 0.03  },
  4: { Artifact: 0.006, Rare: 0.04  },
  5: { Artifact: 0.008, Rare: 0.05  },
  6: { Artifact: 0.010, Rare: 0.06  },
  7: { Artifact: 0.012, Rare: 0.07  },
}

export const TIER_GLOW = {
  'Tier 1':   'rgba(80,80,80,0.4)',
  'Tier 2':   'rgba(110,110,110,0.5)',
  'Tier 3':   'rgba(160,160,160,0.6)',
  'Tier 4':   'rgba(200,200,200,0.7)',
  'Tier 5':   'rgba(255,255,255,0.8)',
  'Uncommon': 'rgba(100,220,100,0.8)',
  'Unique':   'rgba(220,180,220,0.8)',
  'Rare':     'rgba(140,80,220,0.85)',
  'Artifact': 'rgba(220,60,60,0.9)',
  'Epic':     'rgba(220,120,40,0.95)',
}

// solid versions for chest glow during shake
export const TIER_GLOW_SOLID = {
  'Tier 1':   '#505050',
  'Tier 2':   '#6e6e6e',
  'Tier 3':   '#a0a0a0',
  'Tier 4':   '#c8c8c8',
  'Tier 5':   '#ffffff',
  'Uncommon': '#64dc64',
  'Unique':   '#dcb4dc',
  'Rare':     '#8c50dc',
  'Artifact': '#dc3c3c',
  'Epic':     '#dc7828',
}

const reputationToLuck = (reputation) =>
  Math.min(1, Math.sqrt(reputation / MAX_REP))

export function getTierWeights(reputation, forumTier) {
  const luck = reputationToLuck(reputation)
  const fullTierCount = TIER_ORDER.length
  const center = luck * (fullTierCount - 1)

  const allWeights = {}
  let total = 0
  for (let i = 0; i < fullTierCount; i++) {
    const distance = Math.abs(i - center)
    const weight = Math.pow(FALLOFF, -distance)
    allWeights[TIER_ORDER[i]] = weight
    total += weight
  }
  for (const key of Object.keys(allWeights)) {
    allWeights[key] = allWeights[key] / total
  }

  const maxTierIndex = (MAX_TIER_BY_FORUM[forumTier] ?? 1) - 1
  const highestUnlocked = TIER_ORDER[maxTierIndex]
  const cappedWeights = {}
  for (let i = 0; i < fullTierCount; i++) {
    const tier = TIER_ORDER[i]
    if (i <= maxTierIndex) {
      cappedWeights[tier] = allWeights[tier]
    } else {
      cappedWeights[highestUnlocked] = (cappedWeights[highestUnlocked] ?? 0) + allWeights[tier]
    }
  }

  return {
    effective: cappedWeights,
    display: allWeights,
    maxTierIndex,
  }
}

// ── Batching logic ────────────────────────────────────────────────────────────

const ALWAYS_INDIVIDUAL = ['Rare', 'Artifact', 'Epic']

// defines which tiers get grouped together per forum tier
// to tweak, each inner array is one batch, highest tier = glow color
function getBatchGroups(forumTier) {
  if (forumTier <= 2) return [
    ['Tier 1'],
    ['Tier 2'],
  ]
  if (forumTier <= 4) return [
    ['Tier 1', 'Tier 2', 'Tier 3'],
    ['Tier 4'],
  ]
  if (forumTier === 5) return [
    ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'],
    ['Tier 5'],
  ]
  if (forumTier === 6) return [
    ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'],
    ['Tier 5'],
    ['Uncommon'],
  ]
  // 7+
  return [
    ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5'],
    ['Uncommon'],
    ['Unique'],
  ]
}

// returns sequence steps for the animation
// each step: { type: 'batch'|'individual', items: [...], tier: string, shakeConfig }
export function buildSequence(items, forumTier) {
  const SHAKE = {
    batch_low:       { shakes: 2, shakeDur: 220, pauseDur: 120 },
    batch_mid:       { shakes: 3, shakeDur: 260, pauseDur: 180 },
    batch_high:      { shakes: 4, shakeDur: 290, pauseDur: 240 },
    individual_rare: { shakes: 5, shakeDur: 310, pauseDur: 380 },
    individual_arti: { shakes: 6, shakeDur: 330, pauseDur: 500 },
    individual_epic: { shakes: 7, shakeDur: 350, pauseDur: 620 },
  }

  // all individual if 3 or fewer items
  if (items.length <= 3) {
    return items.map(item => {
      const t = item.tier
      const cfg = t === 'Epic' ? SHAKE.individual_epic
        : t === 'Artifact' ? SHAKE.individual_arti
        : t === 'Rare' ? SHAKE.individual_rare
        : SHAKE.batch_low
      return { type: 'individual', items: [item], tier: t, shakeConfig: cfg }
    })
  }

  const individuals = items.filter(i => ALWAYS_INDIVIDUAL.includes(i.tier))
  const batchable   = items.filter(i => !ALWAYS_INDIVIDUAL.includes(i.tier))
  const groups = getBatchGroups(forumTier)

  const batches = groups
    .map((tiers, idx) => {
      const batchItems = batchable.filter(i => tiers.includes(i.tier))
      if (!batchItems.length) return null
      const highestTier = tiers[tiers.length - 1]
      // pick shake config by position in group list
      const cfg = idx === 0 ? SHAKE.batch_low
        : idx === 1 ? SHAKE.batch_mid
        : SHAKE.batch_high
      return { type: 'batch', items: batchItems, tier: highestTier, shakeConfig: cfg }
    })
    .filter(Boolean)

  const individualSteps = individuals.map(item => {
    const t = item.tier
    const cfg = t === 'Epic' ? SHAKE.individual_epic
      : t === 'Artifact' ? SHAKE.individual_arti
      : SHAKE.individual_rare
    return { type: 'individual', items: [item], tier: t, shakeConfig: cfg }
  })

  return [...batches, ...individualSteps]
}

// pre-calculate non-overlapping positions for all items in the cloud area
export function calcItemPositions(count, cloudHeightPx, modalWidthPx, itemSize, minGap) {
  const padding = itemSize
  const positions = []
  let attempts = 0
  const maxAttempts = count * 200

  while (positions.length < count && attempts < maxAttempts) {
    attempts++
    const x = padding + Math.random() * (modalWidthPx - padding * 2)
    const y = padding + Math.random() * (cloudHeightPx - padding * 2)
    const overlaps = positions.some(p =>
      Math.hypot(p.x - x, p.y - y) < itemSize + minGap
    )
    if (!overlaps) positions.push({ x, y })
  }

  // if we couldn't fit everything without overlap, fill remaining with best effort
  while (positions.length < count) {
    positions.push({
      x: padding + Math.random() * (modalWidthPx - padding * 2),
      y: padding + Math.random() * (cloudHeightPx - padding * 2),
    })
  }

  return positions
}