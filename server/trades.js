const { ITEM_WEIGHTS, WANT_ONLY_ITEMS, TRADEABLE_ITEMS } = require('./data/itemWeights.js')

//seeded rng mulberry32
function makeRng(seed) {
  let s = seed >>> 0 //unsigned 32 bit integer
  return function () {
    s += 0x6D2B79F5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 0xFFFFFFFF //divide to 0-1
  }
}

//get an integer from a string, FNV-1a hash algorithm
function hashString(str) {
  let hash = 2166136261 // magic starting number
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)         // XOR with the character code
    hash = Math.imul(hash, 16777619)  // multiply by FNV prime
    hash = hash >>> 0                 // keep it unsigned 32-bit
  }
  return hash
}

function getCurrentWindowIndex() {
  const nowET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  const d = new Date(nowET)

  //slice the day into 4 hour windows, trades reset every 4 hours
  const hoursSinceMidnight = d.getHours()
  const windowOfDay = Math.floor(hoursSinceMidnight / 4) // 0–5

  //combine the window and the date
  const dateStr = d.toLocaleDateString('en-CA') // "YYYY-MM-DD"
  const [y, m, day] = dateStr.split('-').map(Number)
  const dayIndex = y * 365 + m * 31 + day
  
  return dayIndex * 6 + windowOfDay // 6 windows per day
}

function getTradeSeed(townId) {
  const windowIndex = getCurrentWindowIndex()
  return hashString(`${townId}_${windowIndex}`)
}

function pickWantSide(rng, townLevel) {
  //every item has equal chance to appear
  const itemId = TRADEABLE_ITEMS[Math.floor(rng() * TRADEABLE_ITEMS.length)]
  const tradeWeight = ITEM_WEIGHTS[itemId]

  //quantity scales inversely with rarity
  //common items ex weight 1 are asked for in large amounts
  //rare items ex weight 35 are asked for in small amounts

  //weight 1 = 12, weight 7 = 5, weight 12 = 3, weight 35 = 2
  const baseQty = Math.max(1, Math.round(12 / Math.sqrt(tradeWeight)))

  const multiplier = rollMultiplier(rng, townLevel)
  const quantity = Math.max(1, Math.round(baseQty * multiplier))

  return { itemId, quantity, multiplier, tradeWeight}
}

function rollMultiplier(rng, townLevel) {
  const min = 1.0
  const max = Math.min(6.0, 3.0 + (townLevel - 1) * 0.3)

  // bias the roll toward the lower end at low levels,
  // flattening out to uniform as the town levels up.
  // Math.pow(rng(), exponent): exponent > 1 pulls toward 0, exponent < 1 pushes toward 1
  const exponent = Math.max(1, 3 - (townLevel - 1) * 0.2)
  const biasedRoll = Math.pow(rng(), exponent)

  const raw = min + biasedRoll * (max - min)
  // return Math.round(raw * 4) / 4
  return raw
}

function calcWantValue(itemId, quantity) {
  return ITEM_WEIGHTS[itemId] * quantity
}

function buildOfferSide(rng, wantValue, wantItemId) {
  //how much value should go to items vs reputation
  //0 = pure reputation, 1 = max items offered
  const itemFraction = rng() * 0.6 //at most 60% of value is items instead of rep

  const itemValue = Math.floor(wantValue * itemFraction)
  const repValue = wantValue - itemValue

  //rep is roughlt 1 rep per value point but with some variance
  //can tweak this as needed
  const repMultiplier = 1.6 + rng() * 0.8 //ranges 1.6x to 2.4x
  const reputation = Math.max(1, Math.round(repValue * repMultiplier))

  //build item offer if itemValue > 0
  const items = []
  if (itemValue > 0) {
    //pick an item that isn't in WANT_ONLY_ITEMS and not the requested item
    const offerPool = TRADEABLE_ITEMS.filter(id =>
      !WANT_ONLY_ITEMS.has(id) && id !== wantItemId
    )
    const itemId = offerPool[Math.floor(rng() * offerPool.length)]
    const itemWeight = ITEM_WEIGHTS[itemId]

    //quantity that roughly matches the item value budget
    const quantity = Math.max(1, Math.round(itemValue / itemWeight))
    items.push({itemId, quantity})
  }

  return {reputation, items}
}

// EXPORTED HELPER FUNCTIONS BELOW ==========================================

function generateTrades(townId, townLevel, numSlots = 2) {
  const seed = getTradeSeed(townId)
  const rng = makeRng(seed)

  const trades = []
  for (let i = 0; i < numSlots; i++) {
    const want = pickWantSide(rng, townLevel)
    const wantValue = calcWantValue(want.itemId, want.quantity)
    const offer = buildOfferSide(rng, wantValue, want.itemId)

    trades.push({ want, offer })
  }

  return trades
}

//total reputation needed to reach a given level
//could be memoized later but prob fine for now

//ALSO MAKE SURE THIS MATCHES THE SAME ONE IN src/utils/townUtils ON THE FRONTEND
function getRepForLevel(level) {
  let total = 0
  for (let i = 1; i <= level; i++) {
    const cost = i === 1
      ? 150
      : Math.round(120 * Math.sqrt(i) + (i * 30))
    total += cost
  }
  return total
}

//derive town level by total reputation
export function getTownLevel(reputation) {
  let level = 0
  while (reputation >= getRepForLevel(level + 1)) {
    level++
  }
  return level
}

//derive number of trade slots a town has based on its level
function getNumSlots(townLevel) {
  const base = 2
  const bonus = Math.floor(townLevel / 3)
  return base + bonus
}

//derive number of times a trade can be repeated based on forum level
function getTradeLimit(playerData) {
  const forumTier = playerData.travel?.forum?.tier ?? 0
  //for now tier 1 = 1 trade, tier 2 = 2 trades, ...
  return Math.max(1, forumTier)
}

//seconds until next 4-hour window boundary
//so frontend knows when to refresh
function getSecondsUntilNextWindow() {
  const nowET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  const d = new Date(nowET)
  const secondsIntoWindow = ((d.getHours() % 4) * 3600) + (d.getMinutes() * 60) + d.getSeconds()
  return (4 * 3600) - secondsIntoWindow
}

module.exports = { 
  generateTrades, 
  getCurrentWindowIndex,
  getTownLevel,
  getNumSlots,
  getTradeLimit,
  getSecondsUntilNextWindow,
}

// Run with: node server/trades.js
if (require.main === module) {
  console.log('=== Trade Generation Test ===\n')

  const towns = ['alnera', 'frostgate', 'mistport', 'steelmeld']
  const levels = [1, 3, 5, 10]

  for (const townId of towns) {
    for (const level of levels) {
      console.log(`${townId} level ${level}:`)
      const trades = generateTrades(townId, level)
      for (const trade of trades) {
        const offerItems = trade.offer.items.length > 0
          ? ` + ${trade.offer.items.map(i => `${i.quantity}x ${i.itemId}`).join(', ')}`
          : ''
        console.log(
          `  ${trade.want.quantity}x ${trade.want.itemId} (x${trade.multiplier.toFixed(2)})` +
          ` → ${trade.offer.reputation} rep${offerItems}`
        )
      }
      console.log()
    }
  }
}