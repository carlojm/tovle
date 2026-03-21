require('dotenv').config()
const express = require('express')
const app = express()

const { rollLoot, scoreToLuckMultiplier} = require('./loot')
const { db } = require('./firebase')

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
app.use(express.static('dist'))

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

const AVAILABLE_IDS = tovs.map(t => t.id).slice(0, 110) //for now, 0-110. when i get all the imgs, 0-169
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

  //shuffle ids not already claimed by scheduled slots
  const scheduledIds = scheduledSlots.filter(Boolean)
  const shuffledFallbacks = seededShuffle(
    AVAILABLE_IDS.filter(id => !scheduledIds.includes(id)),
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
    const playerRef = db.collection('players').doc(uid)
    const playerSnap = await playerRef.get()

    if (!playerSnap.exists) {
      return res.status(404).json({error: 'Player not found'})
    }

    const playerData = playerSnap.data()

    //check cache hasn't been opened already
    const unopened = playerData.inventory?.unopenedCaches ?? []
    const cacheEntry = unopened.find(c => c.cacheId === cacheId && c.date === date)

    //TODO luck score?

    if (!cacheEntry) {
      return res.status(403).json({ error: 'Cache not in unopened inventory' })
    }

    //get player's luck multipliers TODO figure out exactly what these look like
    const cacheScore = cacheEntry.score ?? 25
    const multipliers = {
      global: 1.0 + (playerData.upgrades?.luckTier ?? 0) * 0.1 * scoreToLuckMultiplier(cacheScore),
      items: {} //item specific multipliers TODO
    }

    //roll loot
    const {items, grid} = rollLoot(multipliers)

    //build updated inventory
    const updatedUnopenedCaches = unopened.filter(c => !(c.cacheId === cacheId && c.date === date))
    const openedCacheRecord = { cacheId, date, items }
    const existingOpenedCaches = playerData.inventory?.openedCaches ?? []
    const existingItems = playerData.inventory?.items ?? []

    await playerRef.update({
      'inventory.unopenedCaches': updatedUnopenedCaches,
      'inventory.openedCaches': [...existingOpenedCaches, openedCacheRecord],
      'inventory.items': [...existingItems, ...items],
    })

    res.json({grid, items})
  } catch (err) {
    console.error('Error opening cache!:', err)
    res.status(500).json({error: 'Internal server error'})
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})