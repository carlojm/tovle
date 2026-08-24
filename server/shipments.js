import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import path from 'path'

import { rollMultiplier } from './trades.js'
import { ITEM_WEIGHTS, WANT_ONLY_ITEMS, TRADEABLE_ITEMS } from './data/itemWeights.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const islesItems = JSON.parse(readFileSync(path.join(__dirname, 'data/islesItems.json'), 'utf-8'))

const MAX_TIER_BY_FORUM = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6, // unlocks Uncommon
  7: 7, // unlocks Unique
}

// ordered from lowest to highest
const TIER_ORDER = [
  'Tier 1',
  'Tier 2', 
  'Tier 3',
  'Tier 4',
  'Tier 5',
  'Uncommon',
  'Unique',
]

// converts reputation (0 to infinity) into a 0-1 luck value
// uses sqrt curve so early reputation has more impact than late reputation
// MAX_REP is the reputation at which you effectively hit max luck (luck ~= 1.0)
const MAX_REP = 10000

const reputationToLuck = (reputation) => {
  return Math.min(1, Math.sqrt(reputation / MAX_REP))
}


// preprocess items JSON into a lookup by tier
// runs once when the server starts, not on every shipment roll
// result looks like:
// {
//   'Tier 1': ['item key 1', 'item key 2', ...],
//   'Tier 2': [...],
//   ...
// }
const buildItemsByTier = () => {
  const byTier = {}

  // initialize empty arrays for all tiers
  for (const tier of TIER_ORDER) {
    byTier[tier] = []
  }

  // populate from islesItems
  for (const [key, item] of Object.entries(islesItems)) {
    if (byTier[item.tier] !== undefined) {
      byTier[item.tier].push(key)
    }
    // items with tiers not in TIER_ORDER (like Rare, Artifact, Epic)
    // are silently skipped here they're handled separately via jackpots
  }

  return byTier
}

// build once at module load time
const ITEMS_BY_TIER = buildItemsByTier()

// separate pools for jackpot tiers, not part of the sliding distribution
const JACKPOT_TIERS = ['Rare', 'Artifact']

const JACKPOT_ITEMS_BY_TIER = {}
for (const tier of JACKPOT_TIERS) {
  JACKPOT_ITEMS_BY_TIER[tier] = Object.entries(islesItems)
    .filter(([key, item]) => item.tier === tier)
    .map(([key]) => key)
}


//generate tier weights based on reputation and max unlocked tier
//as luck increases, distribution peak slides toward higher tiers
//lower tiers never reach exactly 0 though
const FALLOFF = 1.4
const getTierWeights = (reputation, forumTier) => {
  const luck = reputationToLuck(reputation)

  // always calculate over the full tier range
  const fullTierCount = TIER_ORDER.length
  const center = luck * (fullTierCount - 1)

  // calculate weights for all tiers
  const allWeights = {}
  let total = 0

  for (let i = 0; i < fullTierCount; i++) {
    const distance = Math.abs(i - center)
    const weight = Math.pow(FALLOFF, -distance)
    allWeights[TIER_ORDER[i]] = weight
    total += weight
  }

  // normalize
  for (const key of Object.keys(allWeights)) {
    allWeights[key] = allWeights[key] / total
  }

  // cap at forum tier — collapse locked tiers into highest unlocked
  const maxTierIndex = (MAX_TIER_BY_FORUM[forumTier] ?? 1) - 1
  const highestUnlocked = TIER_ORDER[maxTierIndex]

  const cappedWeights = {}
  for (let i = 0; i < fullTierCount; i++) {
    const tier = TIER_ORDER[i]
    if (i <= maxTierIndex) {
      cappedWeights[tier] = allWeights[tier]
    } else {
      // add locked tier's weight to highest unlocked
      cappedWeights[highestUnlocked] = (cappedWeights[highestUnlocked] ?? 0) + allWeights[tier]
    }
  }

  return {
    // what the server actually uses for rolling
    effective: cappedWeights,
    // what the frontend displays (full uncapped distribution)
    display: allWeights,
    // so frontend knows where to draw the cutoff
    maxTierIndex,
  }
}

// picks a random element from an array
const pickRandom = (arr) => {
  if (!arr || arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

// given a weights object like { 'Tier 1': 0.35, 'Tier 2': 0.41, 'Tier 3': 0.24 }
// rolls a random tier using those weights
// works by picking a random point along the cumulative sum
const rollItemTier = (weights) => {
  const roll = Math.random()
  let cumulative = 0

  for (const [tier, weight] of Object.entries(weights)) {
    cumulative += weight
    if (roll < cumulative) return tier
  }

  // fallback for floating point rounding edge cases
  // same pattern as the weighted pick in trades.js
  return Object.keys(weights).at(-1)
}



// jackpot chances per forum tier
// checked before normal roll. if jackpot hits, skip the tier distribution entirely
const JACKPOT_CHANCE = {
  1: { Artifact: 0.001, Rare: 0.01  },
  2: { Artifact: 0.002, Rare: 0.02  },
  3: { Artifact: 0.004, Rare: 0.03  },
  4: { Artifact: 0.006, Rare: 0.04  },
  5: { Artifact: 0.008, Rare: 0.05  },
  6: { Artifact: 0.010, Rare: 0.06  },
  7: { Artifact: 0.012, Rare: 0.07  },
}

// rolls a single item for a shipment
// returns an item key from islesItems.json
const rollShipmentItem = (reputation, forumTier) => {
  const jackpots = JACKPOT_CHANCE[forumTier] ?? {}

  // check jackpot first — single roll covers both
  // artifact threshold is checked first since it's rarer
  const jackpotRoll = Math.random()
  if (jackpotRoll < (jackpots.Artifact ?? 0)) {
    const item = pickRandom(JACKPOT_ITEMS_BY_TIER['Artifact'])
    if (item) return { itemKey: item, tier: 'Artifact' }
  } else if (jackpotRoll < (jackpots.Artifact ?? 0) + (jackpots.Rare ?? 0)) {
    const item = pickRandom(JACKPOT_ITEMS_BY_TIER['Rare'])
    if (item) return { itemKey: item, tier: 'Rare' }
  }

  // normal roll — use effective weights for actual tier selection
  const { effective } = getTierWeights(reputation, forumTier)
  const tier = rollItemTier(effective)
  const item = pickRandom(ITEMS_BY_TIER[tier])

  // fallback if somehow tier pool is empty
  if (!item) {
    const fallback = pickRandom(ITEMS_BY_TIER['Tier 1'])
    return { itemKey: fallback, tier: 'Tier 1' }
  }

  return { itemKey: item, tier }
}


// how many items a shipment contains
const getShipmentSize = (reputation) => {
  // base grows slowly with reputation
  const base = 1 + Math.floor(Math.sqrt(reputation) / 12)

  // bonus rolls, chance to add 1 more item
  // more bonus rolls available at higher reputation
  // rep 0 = 1 bonus roll, rep 10000 = 5 bonus rolls
  const bonusRolls = 2 + Math.floor(Math.sqrt(reputation) / 19)

  // each bonus roll has a 50% chance to add 1 item
  // this creates a right-skewed distribution — usually near base, occasionally much higher
  let bonus = 0
  for (let i = 0; i < bonusRolls; i++) {
    if (Math.random() < 0.5) bonus++
  }

  return base + bonus
}

// generates a unique item id that doesn't collide with existing equipment
const generateItemId = (existingEquipment) => {
  const existingIds = new Set((existingEquipment ?? []).map(e => e.id))
  let id
  do {
    id = Math.random().toString(36).slice(2, 10)
  } while (existingIds.has(id))
  return id
}







// ── Filler + currency rolling for the shipment board minigame ────────────

const FILLER_QTY_DIVISOR = 5 // board quantities read smaller/more casual than trade-window asks
const DEN_PILE_CHANCE = 0.15
const DEN_PILE_MIN = 10

function rollFillerItem(townLevel) {
  const pool = TRADEABLE_ITEMS.filter(id => !WANT_ONLY_ITEMS.has(id) && id !== 'harbinger')
  const itemId = pool[Math.floor(Math.random() * pool.length)]
  const weight = ITEM_WEIGHTS[itemId]
  const baseQty = Math.max(1, Math.round(12 / Math.sqrt(weight)))
  // Math.random is a valid drop-in for rollMultiplier's rng param — it just
  // needs a no-arg function returning [0,1), same shape as the seeded rng
  // trades.js normally passes in. No seeding needed here since this gets
  // rolled once and committed to Firestore, unlike trade generation which
  // has to regenerate identically within a trade window.
  const multiplier = rollMultiplier(Math.random, townLevel)
  const quantity = Math.max(1, Math.round((baseQty * multiplier) / FILLER_QTY_DIVISOR))
  return { itemId, quantity }
}

function rollDenPile(reputation) {
  // separate from den_piece_100 (the archaic Monumenta token) — this is the
  // fiat currency, meant to show up here as one of the few non-combat ways
  // to earn it
  const luck = Math.min(1, Math.sqrt(reputation / MAX_REP))
  const max = Math.round(DEN_PILE_MIN + 190 * luck) // 10 -> 200 as rep climbs
  const quantity = DEN_PILE_MIN + Math.floor(Math.random() * (max - DEN_PILE_MIN + 1))
  return { itemId: 'den_pieces', quantity }
}

function generateFillerId(existingFiller) {
  const existingIds = new Set((existingFiller ?? []).map(f => f.id))
  let id
  do {
    id = 'f' + Math.random().toString(36).slice(2, 10)
  } while (existingIds.has(id))
  return id
}

// rolls the filler pile set for a shipment board.
// count scales with equipment count so bigger shipments get proportionally
// more filler, with a little randomness so it doesn't feel mechanical —
// minimum 3 regardless of equipment count.
function rollShipmentFiller(reputation, townLevel, equipmentCount) {
  const jitter = Math.floor(Math.random() * 5) - 2 // -2 to +2
  const fillerCount = Math.max(3, Math.round(equipmentCount / 2) + jitter)

  const filler = []
  for (let i = 0; i < fillerCount; i++) {
    const rolled = Math.random() < DEN_PILE_CHANCE
      ? rollDenPile(reputation)
      : rollFillerItem(townLevel)
    filler.push({ id: generateFillerId(filler), ...rolled })
  }
  return filler
}

// top-level entry point for the shipment board minigame — rolls both
// equipment and filler in one call. Board layout (walls, tiles, item
// placement) is generated client-side from this list; this function only
// owns the parts with real economic weight.
const rollShipmentContents = (reputation, forumTier, townLevel, townId, existingEquipment, todayStr) => {
  const equipment = rollShipment(reputation, forumTier, townId, existingEquipment, todayStr)
  const filler = rollShipmentFiller(reputation, townLevel, equipment.length)
  return { equipment, filler }
}






// rolls a full shipment for a town
// returns array of equipment instances ready to add to playerData.equipment
const rollShipment = (reputation, forumTier, townId, existingEquipment, todayStr) => {
  const size = getShipmentSize(reputation)
  const items = []

  for (let i = 0; i < size; i++) {
    const rolled = rollShipmentItem(reputation, forumTier)
    if (!rolled) continue

    // generate a unique id for this specific instance
    // pass all existing equipment plus items already rolled this shipment
    // to avoid collisions within the same shipment
    const allEquipment = [...(existingEquipment ?? []), ...items]
    const id = generateItemId(allEquipment)

    items.push({
      id,
      itemKey: rolled.itemKey,
      tier: rolled.tier,
      float: Math.random(),         // 0.0 to 1.0, cosmetic for now
      obtainedDate: todayStr,
      obtainedFrom: townId,
    })
  }

  return items
}



// exports for use in index.js
export { rollShipment, getTierWeights, getShipmentSize, rollShipmentContents}

// ─── tester ───────────────────────────────────────────────────────────────────
// run with: node server/shipments.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('=== Shipment System Test ===\n')

  // ── tier weight distributions ──────────────────────────────────────────────
  console.log('── Tier Weight Distributions ──')
  console.log('Shows effective (capped) and display (full) weights at different rep/forum tier combos\n')

  const testCases = [
    { rep: 0,    forumTier: 1, label: 'Rep 0, Forum 1' },
    { rep: 100,  forumTier: 1, label: 'Rep 100, Forum 1' },
    { rep: 100,  forumTier: 3, label: 'Rep 100, Forum 3' },
    { rep: 400,  forumTier: 3, label: 'Rep 400, Forum 3' },
    { rep: 900,  forumTier: 5, label: 'Rep 900, Forum 5' },
    { rep: 2500, forumTier: 5, label: 'Rep 2500, Forum 5' },
    { rep: 2500, forumTier: 7, label: 'Rep 2500, Forum 7' },
  ]

  for (const { rep, forumTier, label } of testCases) {
    const { effective, display, maxTierIndex } = getTierWeights(rep, forumTier)
    console.log(`${label} (luck: ${reputationToLuck(rep).toFixed(2)}):`)

    for (let i = 0; i < TIER_ORDER.length; i++) {
      const tier = TIER_ORDER[i]
      const displayPct = ((display[tier] ?? 0) * 100).toFixed(1)
      const effectivePct = ((effective[tier] ?? 0) * 100).toFixed(1)
      const locked = i > maxTierIndex ? ' [LOCKED → collapsed into highest]' : ''
      const bar = '█'.repeat(Math.round(parseFloat(effectivePct) / 2))
      console.log(`  ${tier.padEnd(12)} display: ${displayPct.padStart(5)}%  effective: ${effectivePct.padStart(5)}%  ${bar}${locked}`)
    }
    console.log()
  }

  // ── shipment sizes ─────────────────────────────────────────────────────────
  console.log('── Shipment Sizes ──')
  const repValues = [0, 200, 600, 1200, 2000, 3000, 4000, 6000, 8000, 10000, 12000, 20000, 100000]
  for (const rep of repValues) {
    console.log(`  Rep ${String(rep).padEnd(5)} → ${getShipmentSize(rep)} items`)
  }
  console.log()

  // ── jackpot chances ────────────────────────────────────────────────────────
  console.log('── Jackpot Chances ──')
  for (let tier = 1; tier <= 7; tier++) {
    const j = JACKPOT_CHANCE[tier] ?? {}
    const rare = ((j.Rare ?? 0) * 100).toFixed(1)
    const artifact = ((j.Artifact ?? 0) * 100).toFixed(2)
    console.log(`  Forum Tier ${tier} → Rare: ${rare}%  Artifact: ${artifact}%`)
  }
  console.log()

  // ── simulated shipment rolls ───────────────────────────────────────────────
  console.log('── Simulated Shipment Rolls (100 shipments each) ──')
  const simCases = [
    { rep: 0,    forumTier: 1 },
    { rep: 400,  forumTier: 3 },
    { rep: 1200, forumTier: 5 },
    { rep: 2500, forumTier: 7 },
    { rep: 5000, forumTier: 7 },
    { rep: 10000, forumTier: 7 },
  ]

  for (const { rep, forumTier } of simCases) {
    const tierCounts = {}
    let totalItems = 0

    for (let i = 0; i < 100; i++) {
      const shipment = rollShipment(rep, forumTier, 'alnera', [], '2026-05-01')
      for (const item of shipment) {
        tierCounts[item.tier] = (tierCounts[item.tier] ?? 0) + 1
        totalItems++
      }
    }

    console.log(`\n  Rep ${rep}, Forum Tier ${forumTier} (${totalItems} total items across 100 shipments):`)
    const allTiers = [...TIER_ORDER, 'Rare', 'Artifact']
    for (const tier of allTiers) {
      const count = tierCounts[tier] ?? 0
      if (count === 0) continue
      const pct = ((count / totalItems) * 100).toFixed(1)
      const bar = '█'.repeat(Math.round(parseFloat(pct) / 2))
      console.log(`    ${tier.padEnd(12)} ${String(count).padStart(4)} (${pct.padStart(5)}%)  ${bar}`)
    }
  }

  // ── sample shipment ────────────────────────────────────────────────────────
  console.log('\n── Sample Shipment (Rep 400, Forum Tier 3) ──')
  const sample = rollShipment(400, 3, 'alnera', [], '2026-05-01')
  for (const item of sample) {
    console.log(`  [${item.tier}] ${item.itemKey} (float: ${item.float.toFixed(4)}, id: ${item.id})`)
  }

  // ── sample shipment ────────────────────────────────────────────────────────
  console.log('\n── Sample Shipment (Rep 10000, Forum Tier 7) ──')
  const sample2 = rollShipment(10000, 5, 'alnera', [], '2026-05-01')
  for (const item of sample2) {
    console.log(`  [${item.tier}] ${item.itemKey} (float: ${item.float.toFixed(4)}, id: ${item.id})`)
  }

  console.log('\n=== Test Complete ===')
}