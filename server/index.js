import 'dotenv/config'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

import { createAxolotl, generateLevelRequirements } from './axolotl.js'
import { rollLoot, scoreToLuckMultiplier, placeInGrid, getDepthsleItemBonuses } from './loot.js'
import { admin, db } from './firebase.js'

import { cleanupOldOgImages } from './r2.js'
import { generateShareImage } from './share.js'

import {
  generateTrades,
  getCurrentWindowIndex,
  getTownLevel,
  getNumSlots,
  getTradeLimit,
  getSecondsUntilNextWindow
} from './trades.js'

import { rollShipmentContents } from './shipments.js'
import { calcRecyclePrice } from './recycle.js'


//env
const PORT = process.env.PORT || 3001
const REQUIRED_ENV = [] //todo keys for firebase and whatev
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key])
if (missingEnv.length > 0) {
  console.error(`[startup] Missing required environment variables: ${missingEnv.join(', ')}`)
  process.exit(1)
}

const schedule = JSON.parse(readFileSync(path.join(__dirname, 'data/schedule.json'), 'utf-8'))
const tovs = JSON.parse(readFileSync(path.join(__dirname, 'data/tovs.json'), 'utf-8'))

app.use(express.json())


//before the static file serving, the opengraphimage share link redirect
app.get('/d/:shareId', async (req, res) => {
  const { shareId } = req.params
  const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).replace(/-/g, '')
  const imageUrl = `https://images.tovle.net/og/${shareId}.png?v=${dateStr}`

  // serve the normal index.html but inject OG tags
  const html = `<!DOCTYPE html>
<html>
<head>
  <!-- <meta property="og:title" content="Depthsle" /> -->
  <!-- <meta property="og:description" content="your share id is ${shareId} and it is ${dateStr}" /> -->
  <meta property="og:image" content="${imageUrl} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="600" />
  <meta property="og:url" content="https://tovle.net/d/${shareId}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta http-equiv="refresh" content="0;url=/" />
</head>
<body>
  <script>window.location.href = '/'</script>
</body>
</html>`
    
  res.send(html)
})


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


// same formula as frontend getTownBonus in townUtils.js
const getTownBonus = (reputation) => Math.round(Math.sqrt(reputation))

// returns a loot multiplier from >= 1.0 based on hemisphere bonuses
// a cache can be in up to two hemispheres (a quadrant)
const getHemisphereMultiplier = (tov, playerData) => {
  if (!tov?.x || !tov?.z) return 1.0

  const MAP_MID_X = -680
  const MAP_MID_Z = 623

  const isEast = tov.x > MAP_MID_X
  const isWest = tov.x <= MAP_MID_X
  const isSouth = tov.z > MAP_MID_Z
  const isNorth = tov.z <= MAP_MID_Z

  const towns = playerData?.travel?.towns ?? {}

  // each hemisphere maps to a town
  const bonuses = []
  if (isEast)  bonuses.push(getTownBonus(towns.alnera?.reputation ?? 0))
  if (isWest)  bonuses.push(getTownBonus(towns.frostgate?.reputation ?? 0))
  if (isSouth) bonuses.push(getTownBonus(towns.mistport?.reputation ?? 0))
  if (isNorth) bonuses.push(getTownBonus(towns.steelmeld?.reputation ?? 0))

  // multiply bonuses together
  // e.g. 10% + 5% bonus = 1.10 * 1.05 = 1.155x
  const multiplier = bonuses.reduce((product, b) => product * (1 + b / 100), 1)
  return multiplier
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
      const tov = tovs.find(t => t.id === Number(cacheId) || t.id === cacheId)
      const hemisphereMultiplier = getHemisphereMultiplier(tov, playerData)
      const multipliers = {
        global: (1.0 + (playerData.upgrades?.luckTier ?? 0)) * hemisphereMultiplier,
        cache: scoreToLuckMultiplier(cacheScore),
        items: getDepthsleItemBonuses(playerData.depthsle?.bestRoomsByTree ?? {}),
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

app.post('/api/open-all-caches', async (req, res) => {
  const { uid } = req.body

  if (!uid) {
    return res.status(400).json({ error: 'Missing uid' })
  }

  try {
    let allItems = []
    let openedEntries = []

    await db.runTransaction(async (t) => {
      const playerRef = db.collection('players').doc(uid)
      const playerSnap = await t.get(playerRef)

      if (!playerSnap.exists) {
        throw Object.assign(new Error('Player not found'), { status: 404 })
      }

      const playerData = playerSnap.data()
      const unopened = playerData.inventory?.unopenedCaches ?? []

      if (unopened.length === 0) {
        throw Object.assign(new Error('No unopened caches'), { status: 400 })
      }

      const openedCaches = playerData.inventory?.openedCaches ?? []
      const openedSet = new Set(openedCaches.map(c => `${c.cacheId}-${c.date}`))

      // roll loot for each cache
      for (const cacheEntry of unopened) {
        const key = `${cacheEntry.cacheId}-${cacheEntry.date}`

        // skip already opened (idempotency)
        if (openedSet.has(key)) continue

        const isAxolotlCache = String(cacheEntry.cacheId).startsWith('axolotl_')
        const cacheScore = cacheEntry.score ?? 25
        const tov = isAxolotlCache ? null : tovs.find(t => t.id === Number(cacheEntry.cacheId) || t.id === cacheEntry.cacheId)
        const hemisphereMultiplier = isAxolotlCache ? 1.0 : getHemisphereMultiplier(tov, playerData)

        const multipliers = {
          global: (1.0 + (playerData.upgrades?.luckTier ?? 0)) * hemisphereMultiplier,
          cache: scoreToLuckMultiplier(cacheScore),
          items: getDepthsleItemBonuses(playerData.depthsle?.bestRoomsByTree ?? {}),
        }

        const lootResult = rollLoot(multipliers, playerData.upgrades ?? {}, isAxolotlCache ? 'axolotl' : 'cache')
        allItems.push(...lootResult.items)
        openedEntries.push({ cacheId: cacheEntry.cacheId, date: cacheEntry.date })
        openedSet.add(key)
      }

      if (openedEntries.length === 0) {
        throw Object.assign(new Error('All caches already opened'), { status: 409 })
      }

      const existingItems = playerData.inventory?.items ?? []
      const mergedItems = mergeItems(existingItems, allItems)

      t.update(playerRef, {
        'inventory.unopenedCaches': [],
        'inventory.openedCaches': [...openedCaches, ...openedEntries],
        'inventory.items': mergedItems,
      })
    })

    // merge allItems for the response (same as stackItems does internally)
    const stackedItems = allItems.reduce((map, item) => {
      if (map[item.itemId]) {
        map[item.itemId].quantity += item.quantity ?? 1
      } else {
        map[item.itemId] = { ...item, quantity: item.quantity ?? 1 }
      }
      return map
    }, {})

    const responseItems = Object.values(stackedItems)
    // re-roll the grid from the merged items for display
    const flatItems = responseItems.flatMap(item =>
      Array.from({ length: item.quantity }, () => ({ itemId: item.itemId, name: item.name }))
    )
    const grid = placeInGrid(flatItems)

    res.json({ items: responseItems, grid, cacheCount: openedEntries.length })

  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message })
    if (err.status === 404) return res.status(404).json({ error: err.message })
    if (err.status === 409) return res.status(409).json({ error: err.message })
    console.error('Error opening all caches:', err)
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

app.get('/api/trades/all', async (req, res) => {
  const { uid } = req.query
  if (!uid) return res.status(400).json({ error: 'Missing uid' })

  const VALID_TOWNS = ['alnera', 'frostgate', 'mistport', 'steelmeld']

  try {
    const playerRef = db.collection('players').doc(uid)
    const playerSnap = await playerRef.get()
    if (!playerSnap.exists) return res.status(404).json({ error: 'Player not found' })

    const playerData = playerSnap.data()
    const currentWindow = getCurrentWindowIndex()
    const tradeLimit = getTradeLimit(playerData)

    const towns = {}
    for (const townId of VALID_TOWNS) {
      const townData = playerData.travel?.towns?.[townId] ?? {}
      const reputation = townData.reputation ?? 0
      const townLevel = getTownLevel(reputation)
      const numSlots = getNumSlots(townLevel)
      const trades = generateTrades(townId, townLevel, numSlots)

      const storedWindow = townData.tradeWindow
      const tradeCounts = storedWindow?.windowIndex === currentWindow
        ? storedWindow.tradeCounts
        : new Array(numSlots).fill(0)

      towns[townId] = {
        reputation,
        townLevel,
        trades: trades.map((trade, i) => ({
          ...trade,
          timesCompleted: tradeCounts[i] ?? 0,
          limit: tradeLimit,
          canTrade: (tradeCounts[i] ?? 0) < tradeLimit
        }))
      }
    }

    res.json({
      towns,
      windowIndex: currentWindow,
      nextWindowIn: getSecondsUntilNextWindow()
    })

  } catch (err) {
    console.error('Error fetching all trades:', err)
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
  const {uid, townId, tradeIndex, windowIndex, executionNumber} = req.body

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

      if (windowIndex !== currentWindow) {
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
        },
        'stats.totalTradesExecuted': admin.firestore.FieldValue.increment(1),
        [`stats.tradesByTown.${townId}`]: admin.firestore.FieldValue.increment(1),
        'stats.totalItemsTraded': admin.firestore.FieldValue.increment(trade.want.quantity),
        [`stats.itemsTradedByTown.${townId}`]: admin.firestore.FieldValue.increment(trade.want.quantity),
        'stats.totalItemsReceived': admin.firestore.FieldValue.increment(trade.offer.items.reduce((sum, i) => sum + i.quantity, 0)),
        [`stats.itemsReceivedByTown.${townId}`]: admin.firestore.FieldValue.increment(trade.offer.items.reduce((sum, i) => sum + i.quantity, 0)),
      })

      result = {
        reputation: newReputation,
        tradeCounts,
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

app.post('/api/collect-shipment', async (req, res) => {
  const { uid, townId } = req.body

  const VALID_TOWNS = ['alnera', 'frostgate', 'mistport', 'steelmeld']
  if (!uid || !townId) {
    return res.status(400).json({ error: 'Missing uid or townId' })
  }
  if (!VALID_TOWNS.includes(townId)) {
    return res.status(400).json({ error: 'Invalid town ID' })
  }

  try {
    let responsePayload = null

    await db.runTransaction(async (t) => {
      const playerRef = db.collection('players').doc(uid)
      const playerSnap = await t.get(playerRef)

      if (!playerSnap.exists) {
        throw Object.assign(new Error('Player not found'), { status: 404 })
      }

      const playerData = playerSnap.data()
      const todayStr = getEasternDateString()
      const townData = playerData.travel?.towns?.[townId] ?? {}

      if (!townData.unlocked) {
        throw Object.assign(new Error('Town not unlocked'), { status: 403 })
      }

      // already fully finalized today — real "come back tomorrow" case
      if (townData.lastShipment === todayStr) {
        throw Object.assign(
          new Error('Shipment already collected today'),
          { status: 409, alreadyCollected: true }
        )
      }

      // a board was already rolled today and hasn't been finalized yet
      // this is a resume (reload, reopened modal, different device), not a
      // fresh roll. Return the same committed item list; do NOT roll again.
      const pending = townData.pendingShipment
      if (pending?.rolledDate === todayStr) {
        responsePayload = { equipment: pending.equipment, filler: pending.filler }
        return // no writes needed, this is a read-only resume
      }

      // fresh roll
      const forumTier = playerData.travel?.forum?.tier ?? 1
      const reputation = townData.reputation ?? 0
      const townLevel = getTownLevel(reputation)
      const existingEquipment = playerData.equipment ?? []

      const { equipment, filler } = rollShipmentContents(
        reputation, forumTier, townLevel, townId, existingEquipment, todayStr
      )

      t.update(playerRef, {
        [`travel.towns.${townId}.pendingShipment`]: { equipment, filler, rolledDate: todayStr },
      })

      responsePayload = { equipment, filler }
    })

    res.json(responsePayload)

  } catch (err) {
    if (err.alreadyCollected) return res.status(409).json({ alreadyCollected: true })
    if (err.status === 404) return res.status(404).json({ error: err.message })
    if (err.status === 403) return res.status(403).json({ error: err.message })
    console.error('Error collecting shipment:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/finalize-shipment', async (req, res) => {
  //TWO api calls for shipments now, one at the start to generate loot
  //and one at the end to confirm which loot the player collected

  const { uid, townId, collectedEquipmentIds, collectedFillerIds, extraTilesUsed, extraTilesPurchased, cutUsed, tilesPlaced } = req.body

  const VALID_TOWNS = ['alnera', 'frostgate', 'mistport', 'steelmeld']
  if (!uid || !townId || !Array.isArray(collectedEquipmentIds) || !Array.isArray(collectedFillerIds)) {
    return res.status(400).json({ error: 'Missing uid, townId, collectedEquipmentIds, or collectedFillerIds' })
  }
  //statistics
  const tilesUsed = Math.max(0, Number.isInteger(extraTilesUsed) ? extraTilesUsed : 0)
  const tilesBought = Math.max(0, Number.isInteger(extraTilesPurchased) ? extraTilesPurchased : 0)
  const didUseCut = Boolean(cutUsed)
  const tilesPlacedCount = Math.max(0, Number.isInteger(tilesPlaced) ? tilesPlaced : 0)
  if (!VALID_TOWNS.includes(townId)) {
    return res.status(400).json({ error: 'Invalid town ID' })
  }

  try {
    let result = null

    await db.runTransaction(async (t) => {
      const playerRef = db.collection('players').doc(uid)
      const playerSnap = await t.get(playerRef)

      if (!playerSnap.exists) {
        throw Object.assign(new Error('Player not found'), { status: 404 })
      }

      const playerData = playerSnap.data()
      const todayStr = getEasternDateString()
      const townData = playerData.travel?.towns?.[townId] ?? {}
      const pending = townData.pendingShipment

      if (!pending || pending.rolledDate !== todayStr) {
        throw Object.assign(new Error('No pending shipment to finalize'), { status: 409 })
      }
      // idempotency - a second finalize call for an already-finalized day
      // shouldn't double-grant anything
      if (townData.lastShipment === todayStr) {
        throw Object.assign(new Error('Shipment already finalized today'), { status: 409, alreadyCollected: true })
      }

      // never trust the client's item data, only which ids it claims;
      // cross-reference against what was actually rolled
      const collectedEquipment = pending.equipment.filter(e => collectedEquipmentIds.includes(e.id))
      const collectedFillerAll = pending.filler.filter(f => collectedFillerIds.includes(f.id))
      const equipmentLeftBehind = pending.equipment.length - collectedEquipment.length //used for stats

      // den_pieces is currency, not an inventory item; split it out
      const collectedDenPiles = collectedFillerAll.filter(f => f.itemId === 'den_pieces')
      const collectedFillerItems = collectedFillerAll.filter(f => f.itemId !== 'den_pieces')
      const denPiecesGained = collectedDenPiles.reduce((sum, f) => sum + f.quantity, 0)

      const existingEquipment = playerData.equipment ?? []
      const updatedEquipment = [...existingEquipment, ...collectedEquipment]

      // price doubles per purchase (100, 200, 400, ...)
      const extraTileCost = tilesUsed > 0 ? 100 * (Math.pow(2, tilesUsed) - 1) : 0
      const currentDenPiecesBeforeCost = playerData.inventory?.currencies?.denPieces ?? 0
      if (currentDenPiecesBeforeCost < extraTileCost) {
        throw Object.assign(new Error('Not enough den pieces for extra tiles purchased'), { status: 400 })
      }
      
      const existingItems = playerData.inventory?.items ?? []
      const updatedItems = mergeItems(existingItems, collectedFillerItems)

      const currentDenPieces = currentDenPiecesBeforeCost - extraTileCost

      // equipmentCollection stats; moved here from roll time, since we
      // only know now what was actually collected
      const collectionUpdates = {}
      for (const item of collectedEquipment) {
        const existing = playerData.stats?.equipmentCollection?.[item.itemKey] ?? null
        collectionUpdates[`stats.equipmentCollection.${item.itemKey}`] = {
          totalFound: (existing?.totalFound ?? 0) + 1,
          firstFoundDate: existing?.firstFoundDate ?? todayStr,
          lowestFloat: Math.min(existing?.lowestFloat ?? 1, item.float),
          highestFloat: Math.max(existing?.highestFloat ?? 0, item.float),
        }
      }

      t.update(playerRef, {
        equipment: updatedEquipment,
        'inventory.items': updatedItems,
        'inventory.currencies.denPieces': currentDenPieces + denPiecesGained,
        [`travel.towns.${townId}.lastShipment`]: todayStr,
        [`travel.towns.${townId}.pendingShipment`]: admin.firestore.FieldValue.delete(),
        'stats.totalShipmentsOpened': admin.firestore.FieldValue.increment(1),
        'stats.totalShipmentEquipmentCollected': admin.firestore.FieldValue.increment(collectedEquipment.length),
        'stats.totalShipmentEquipmentLeftBehind': admin.firestore.FieldValue.increment(equipmentLeftBehind),
        'stats.totalCutsUsed': admin.firestore.FieldValue.increment(didUseCut ? 1 : 0),
        'stats.totalExtraTilesBought': admin.firestore.FieldValue.increment(tilesBought),
        'stats.totalDenSpentOnExtraTiles': admin.firestore.FieldValue.increment(extraTileCost),
        'stats.totalTilesPlaced': admin.firestore.FieldValue.increment(tilesPlacedCount),
        ...collectionUpdates,
      })

      result = { 
        equipment: collectedEquipment, 
        filler: collectedFillerItems, 
        denPiecesGained, 
        extraTileCost, 
        netDenPieces: denPiecesGained - extraTileCost 
      }
    })

    res.json(result)

  } catch (err) {
    if (err.alreadyCollected) return res.status(409).json({ alreadyCollected: true })
    if (err.status === 404) return res.status(404).json({ error: err.message })
    if (err.status === 409) return res.status(409).json({ error: err.message })
    console.error('Error finalizing shipment:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/recycle-equipment', async (req, res) => {
  const { uid, itemId } = req.body

  if (!uid || !itemId) {
    return res.status(400).json({ error: 'Missing uid or itemId' })
  }

  try {
    let payout = null

    await db.runTransaction(async (t) => {
      const playerRef = db.collection('players').doc(uid)
      const playerSnap = await t.get(playerRef)

      if (!playerSnap.exists) {
        throw Object.assign(new Error('Player not found'), { status: 404 })
      }

      const playerData = playerSnap.data()
      const equipment = playerData.equipment ?? []

      const item = equipment.find(e => e.id === itemId)
      if (!item) {
        throw Object.assign(new Error('Item not found'), { status: 404 })
      }

      if (item.starred) {
        throw Object.assign(new Error('Cannot recycle a starred item'), { status: 403 })
      }

      payout = calcRecyclePrice(item.tier, item.float)

      const updatedEquipment = equipment.filter(e => e.id !== itemId)
      const currentDenPieces = playerData.inventory?.currencies?.denPieces ?? 0

      t.update(playerRef, {
        equipment: updatedEquipment,
        'inventory.currencies.denPieces': currentDenPieces + payout,
      })
    })

    res.json({ payout })

  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message })
    if (err.status === 403) return res.status(403).json({ error: err.message })
    console.error('Error recycling equipment:', err)
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

app.post('/api/depthsle/share', async (req, res) => {
  try {
    const { uid, runData } = req.body
    if (!uid) return res.status(400).json({ error: 'uid required' })

    const { shareId, url } = await generateShareImage(uid, runData)
    res.json({ ok: true, shareId, url })
  } catch (err) {
    console.error('Share generation failed:', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/admin/cleanup-og', async (req, res) => {
  const secret = req.headers['x-admin-secret']
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  try {
    const result = await cleanupOldOgImages(1) //TODO: set to like 31 or something
    res.json({ ok: true, ...result })
  } catch (err) {
    console.error('Cleanup failed:', err)
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})