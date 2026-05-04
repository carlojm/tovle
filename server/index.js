require('dotenv').config()
const express = require('express')
const app = express()
const path = require('path')

const {createAxolotl, generateLevelRequirements} = require('./axolotl')
const { rollLoot, scoreToLuckMultiplier} = require('./loot')
const { admin, db } = require('./firebase')

const { 
  generateTrades, 
  getCurrentWindowIndex,
  getNumSlots,
  getTradeLimit,
  getSecondsUntilNextWindow
} = require('./trades')
const { getTownLevel } = require('../tovle/src/utils/townUtils.js')


//env
const PORT = process.env.PORT || 3001
const REQUIRED_ENV = [] //todo keys for firebase and whatev
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key])
if (missingEnv.length > 0) {
  console.error(`[startup] Missing required environment variables: ${missingEnv.join(', ')}`)
  process.exit(1)
}

const schedule = require('./data/schedule.json')
const tovs = require('./data/tovs.json')

app.use(express.json())

//serve static files with long cache for hashed assets
//should help with performance, specifically for the map image
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, filePath) => {
    // Vite-hashed assets (have a hash in filename) can be cached forever
    if (/\.[a-f0-9]{8,}\.(js|css|png|webp|svg|woff2?)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    } else {
      // index.html and unhashed files should not be cached
      res.setHeader('Cache-Control', 'no-cache')
    }
  }
}))

//logging middleware
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} -> ${req.statusCode} (${duration}ms)`)
  })
  next()
})

//date helper
const getEasternDateString = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  // en-CA locale gives YYYY-MM-DD format
}

//turn date string into a integer seed
const dateToSeed = (dateString) => {
  return dateString.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
}

//seeded pseudo random generator
//idk this one is gpt's idea https://en.wikipedia.org/wiki/Linear_congruential_generator
//returns a function that produces a new number each time it's called
const makeSeededRng = (seed) => {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return Math.abs(s)
  }
}

//seeded shuffle, returns a new array
const seededShuffle = (array, seed) => {
  const rng = makeSeededRng(seed)
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng() % (i+1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const AVAILABLE_IDS = tovs.map(t => t.id).slice(0, 169) //all the imgs, 0-169
const DAILY_CACHE_COUNT = 4


//return the scheduled id for a date, or null if none is scheduled
const getScheduledId = (dateString) => {
  const entry = schedule.find(item => item.date === dateString)
  if (!entry || entry.id === 'fallback') return null
  if (entry.id === 'random') return AVAILABLE_IDS[Math.floor(Math.random() * AVAILABLE_IDS.length)]
  return entry.id
}

//return an array of DAILY_CACHE_COUNT unique ids for the given date
//cache 0 is scheduled or fallback (random) if no schedule
//cache 1-3 are fallback (random)

// raw version, no recent exclusion — used to compute history
const getDailyIds_raw = (dateString) => {
  const seed = dateToSeed(dateString)
  const entry = schedule.find(item => item.date === dateString)

  const scheduledSlots = Array.from({length: DAILY_CACHE_COUNT}, (_, i) => {
    const val = entry?.ids?.[i]
    if (val === undefined || val === 'random') return null
    return Number(val)
  })

  const scheduledIds = scheduledSlots.filter(Boolean)
  const shuffledFallbacks = seededShuffle(
    AVAILABLE_IDS.filter(id => !scheduledIds.includes(id)),
    seed
  )

  let fallbackIndex = 0
  return scheduledSlots.map(id => {
    if (id !== null) return id
    return shuffledFallbacks[fallbackIndex++]
  })
}

const getDailyIds = (dateString) => {
  const seed = dateToSeed(dateString)
  const entry = schedule.find(item => item.date === dateString)

  //normalize scheduled slots to DAILY_CACHE_COUNT length
  //treat missing and "random" entries as null
  //ex "ids" : [10] --> [10, null, null, null]
  //ex "ids" : [20, "random", 14] --> [20, null, 14, null]
  const scheduledSlots = Array.from({length: DAILY_CACHE_COUNT}, (_, i) => {
    //use fancy ? shorthand to get undefined if doesn't exist
    //necessary for situations like no schedule entry for a day exists
    const val = entry?.ids?.[i]
    if (val === undefined || val === 'random') return null
    return Number(val)
  })

  // exclude IDs from the past 7 days
  const recentIds = new Set()
  for (let i = 1; i <= 7; i++) {
    const past = new Date(dateString + 'T12:00:00') // noon to avoid DST edge cases
    past.setDate(past.getDate() - i)
    const pastStr = past.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    getDailyIds_raw(pastStr).forEach(id => recentIds.add(id))
  }

  //shuffle ids not already claimed by scheduled slots
  const scheduledIds = scheduledSlots.filter(Boolean)
  const shuffledFallbacks = seededShuffle(
    AVAILABLE_IDS.filter(id => !scheduledIds.includes(id) && !recentIds.has(id)),
    seed
  )

  //at this point scheduledSlots looks like ex. [4, null, 10, null]
  //replace nulls with values from the shuffled list of available cache ids.
  let fallbackIndex = 0
  return scheduledSlots.map(id => {
    if (id !== null) return id
    return shuffledFallbacks[fallbackIndex++] //increments after indexing
  })
}

const mergeItems = (existing, incoming) => {
  const map = {}
  for (const item of [...existing, ...incoming]) {
    if (map[item.itemId]) {
      map[item.itemId].quantity += item.quantity
    } else {
      map[item.itemId] = { ...item }
    }
  }
  return Object.values(map)
}

// --- routes -------------------------------------------
app.get('/api/daily', (request, response) => {
  const today = getEasternDateString()
  const ids = getDailyIds(today)
  const caches = ids.map(id => tovs.find(t => t.id === id)).filter(Boolean)

  if (caches.length !== DAILY_CACHE_COUNT) {
    return response.status(404).json({error: `only ${caches.length} caches found for today`})
  }

  response.json({ date: today, caches })
})


app.post('/api/open-cache', async(req, res) => {
  const { uid, cacheId, date} = req.body

  if (!uid || !cacheId || !date) {
    return res.status(400).json({ error: 'Missing uid, cacheId, or date' })
  }

  try {
    let lootResult = null

    await db.runTransaction(async (t) => {
      const playerRef = db.collection('players').doc(uid)
      const playerSnap = await t.get(playerRef)

      if (!playerSnap.exists) {
        throw Object.assign(new Error('Player not found'), { status: 404 })
      }

      const playerData = playerSnap.data()

      //check cache hasn't been opened already
      //idempotency!
      const openedCaches = playerData.inventory?.openedCaches ?? []
      if (openedCaches.some(c => c.cacheId === cacheId && c.date === date)) {
        throw Object.assign(new Error('Already opened'), { status: 409, alreadyOpened: true })
      }

      //check if in unopened inventory
      const unopened = playerData.inventory?.unopenedCaches ?? []
      const cacheEntry = unopened.find(c => c.cacheId === cacheId && c.date === date)
      if (!cacheEntry) {
        throw Object.assign(new Error('Cache not in unopened inventory'), { status: 403 })
      }

      //get player's luck multipliers TODO figure out exactly what these look like
      const cacheScore = cacheEntry.score ?? 25
      const multipliers = {
        global: 1.0 + (playerData.upgrades?.luckTier ?? 0),
        cache: scoreToLuckMultiplier(cacheScore),
        items: {} //item specific multipliers TODO
      }
      //roll loot
      const isAxolotlCache = String(cacheId).startsWith('axolotl_')
      lootResult = rollLoot(multipliers, playerData.upgrades ?? {}, isAxolotlCache ? 'axolotl' : 'cache')


      //build updated inventory
      const updatedUnopenedCaches = unopened.filter(c => !(c.cacheId === cacheId && c.date === date))
      const existingItems = playerData.inventory?.items ?? []

      t.update(playerRef, {
        'inventory.unopenedCaches': updatedUnopenedCaches,
        'inventory.openedCaches': [...openedCaches, { cacheId, date }],
        'inventory.items': mergeItems(existingItems, lootResult.items),
      })
    })

    res.json({ grid: lootResult.grid, items: lootResult.items })
  } catch (err) {
    if (err.alreadyOpened) return res.status(409).json({ alreadyOpened: true })
    if (err.status === 404) return res.status(404).json({ error: err.message })
    if (err.status === 403) return res.status(403).json({ error: err.message })
    console.error('Error opening cache!:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/create-axolotl', async (req, res) => {
  const { uid } = req.body
  if (!uid) return res.status(400).json({ error: 'Missing uid' })

  try {
    const playerRef = db.collection('players').doc(uid)
    const playerSnap = await playerRef.get()
    if (!playerSnap.exists) return res.status(404).json({ error: 'Player not found' })

    const axolotl = createAxolotl()
    res.json({ axolotl })
  } catch (err) {
    console.error('Error creating axolotl:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/level-axolotl', async (req, res) => {
  const { uid, axolotlId } = req.body
  if (!uid || !axolotlId) return res.status(400).json({ error: 'Missing uid or axolotlId' })

  try {
    const playerRef = db.collection('players').doc(uid)
    const playerSnap = await playerRef.get()
    if (!playerSnap.exists) return res.status(404).json({ error: 'Player not found' })

    const playerData = playerSnap.data()
    const axolotls = playerData.axolotls ?? []
    const axolotl = axolotls.find(a => a.id === axolotlId)
    if (!axolotl) return res.status(404).json({ error: 'Axolotl not found' })

    const nextLevel = axolotl.level + 2 // generate requirements for level after next
    const newRequirements = generateLevelRequirements(nextLevel, axolotl.quality)

    res.json({ nextLevel, requirements: newRequirements })
  } catch (err) {
    console.error('Error leveling axolotl:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/trades/:townId', async (req, res) => {
  const {townId} = req.params
  const {uid} = req.query

  const VALID_TOWNS = ['alnera', 'frostgate', 'mistport', 'steelmeld']
  if (!VALID_TOWNS.includes(townId)) {
    return res.status(400).json({ error: 'Invalid town ID' })
  }
  if (!uid) {
    return res.status(400).json({ error: 'Missing uid' })
  }

  try {
    //verify player exists
    const playerRef = db.collection('players').doc(uid)
    const playerSnap = await playerRef.get()
    if (!playerSnap.exists) {
      return res.status(404).json({ error: 'Player not found' })
    }

    const playerData = playerSnap.data()
    const townData = playerData.travel?.towns?.[townId] ?? {}

    //derive town level from reputation
    const reputation = townData.reputation ?? 0
    const townLevel = getTownLevel(reputation)

    //figure out number of trade slots player has unlocked
    const numSlots = getNumSlots(townLevel)

    // console.log({ reputation, townLevel, numSlots }) 

    //generate the trades
    const trades = generateTrades(townId, townLevel, numSlots)

    //figure out how many times each trade has been done already in this window
    //from player's townData
    const currentWindow = getCurrentWindowIndex()
    const storedWindow = townData.tradeWindow
    const tradeCounts = storedWindow?.windowIndex === currentWindow
      ? storedWindow.tradeCounts
      : new Array(numSlots).fill(0) //new trade set = reset history

    // how many times can each trade be done per window?
    const tradeLimit = getTradeLimit(playerData)

    res.json({
      townId,
      reputation,
      townLevel,
      trades: trades.map((trade, i) => ({
        ...trade,
        timesCompleted: tradeCounts[i] ?? 0,
        limit: tradeLimit,
        canTrade: (tradeCounts[i] ?? 0) < tradeLimit
      })),
      windowIndex: currentWindow,
      nextWindowIn: getSecondsUntilNextWindow()
    })

  } catch (err) {
    console.error('Error fetching trades:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/execute-trade', async (req, res) => {
  const {uid, townId, tradeIndex, executionNumber} = req.body

  //validate request
  const VALID_TOWNS = ['alnera', 'frostgate', 'mistport', 'steelmeld']
  if (!uid || !townId || tradeIndex === undefined || executionNumber === undefined) {
    return res.status(400).json({ error: 'Missing uid, townId, tradeIndex, or executionNumber' })
  }
  if (!VALID_TOWNS.includes(townId)) {
    return res.status(400).json({ error: 'Invalid town ID' })
  }

  try {
    let result = null

    await db.runTransaction(async (t) => {
      //read player data
      const playerRef = db.collection('players').doc(uid)
      const playerSnap = await t.get(playerRef)
      if (!playerSnap.exists) {
        throw Object.assign(new Error('Player not found'), { status: 404 })
      }

      const playerData = playerSnap.data()
      const townData = playerData.travel?.towns?.[townId] ?? {}

      //derive level and regenerate trades server-side
      const reputation = townData.reputation ?? 0
      const townLevel = getTownLevel(reputation)
      const numSlots = getNumSlots(townLevel)
      const tradeLimit = getTradeLimit(playerData)
      const trades = generateTrades(townId, townLevel, numSlots)

      //validate tradeIndex
      if (tradeIndex < 0 || tradeIndex >= trades.length) {
        throw Object.assign(new Error('Invalid trade index'), { status: 400 })
      }
      const trade = trades[tradeIndex]

      //check trade limit for this window
      const currentWindow = getCurrentWindowIndex()

      if (req.body.windowIndex !== currentWindow) {
        throw Object.assign(new Error('Trade window has expired'), {
          status: 409,
          windowExpired: true
        })
      }
      
      const storedWindow = townData.tradeWindow
      const tradeCounts = storedWindow?.windowIndex === currentWindow
        ? [...storedWindow.tradeCounts]
        : new Array(numSlots).fill(0)
      
      //for idempotency, make sure currentCount === executionNumber
      const currentCount = tradeCounts[tradeIndex] ?? 0
      if (executionNumber !== currentCount) {
        throw Object.assign(new Error('Trade already executed or invalid execution number'), {
          status: 409,
          alreadyExecuted: true
        })
      }
      if (currentCount >= tradeLimit) {
        throw Object.assign(new Error('Trade limit reached for this window'), { status: 409 })
      }

      //check player has enough of wanted item
      const playerItems = playerData.inventory?.items ?? []
      const playerItem = playerItems.find(i => i.itemId === trade.want.itemId)
      const playerQty = playerItem?.quantity ?? 0
      if (playerQty < trade.want.quantity) {
        throw Object.assign(new Error('Not enough items'), { status: 400, notEnoughItems: true })
      }

      //deduct wanted items
      const updatedItems = playerItems.map(item => {
        if (item.itemId !== trade.want.itemId) return item
        return { ...item, quantity: item.quantity - trade.want.quantity }
      }).filter(item => item.quantity > 0)

      //add the offered items and reputation
      const itemsWithOffers = mergeItems(updatedItems, trade.offer.items)
      const newReputation = reputation + trade.offer.reputation

      //increment trade count for this slot
      tradeCounts[tradeIndex] = (tradeCounts[tradeIndex] ?? 0) + 1

      t.update(playerRef, {
        'inventory.items': itemsWithOffers,
        [`travel.towns.${townId}.reputation`]: newReputation,
        [`travel.towns.${townId}.tradeWindow`]: {
          windowIndex: currentWindow,
          tradeCounts
        }
      })

      result = {
        reputation: newReputation,
        townLevel: getTownLevel(newReputation),
        reputationGained: trade.offer.reputation,
        itemsGained: trade.offer.items,
        itemsSpent: [{ itemId: trade.want.itemId, quantity: trade.want.quantity }]
      }
    })

    res.json(result)

  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message })
    if (err.status === 400) return res.status(400).json({ error: err.message, notEnoughItems: err.notEnoughItems })
    if (err.status === 409) return res.status(409).json({ 
      error: err.message, 
      alreadyExecuted: err.alreadyExecuted ?? false,
      windowExpired: err.windowExpired ?? false
    })
    console.error('Error executing trade:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/auth/token', async (req, res) => {
  //we can use uid to restore account
  //this route verifies that a uid actually exists

  const {uid} = req.body
  if (!uid) return res.status(400).json({ error: 'Missing uid' })

  try {
    const doc = await db.collection('players').doc(uid).get()
    if (!doc.exists) return res.status(404).json({ error: 'No player found with that UID' })

    const token = await admin.auth().createCustomToken(uid)
    res.json({ token })
  } catch (err) {
    console.error('Error creating custom token:', err)
    res.status(500).json({ error: 'Internal server error' })
  }

})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})