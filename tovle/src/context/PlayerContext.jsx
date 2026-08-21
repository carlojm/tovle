import { createContext, useContext, useState, useEffect, useRef } from "react"
import { initAuth } from "../firebase/auth"
import { loadPlayerData, savePlayerData } from "../firebase/db"

//time to learn a new react thing
//we want to share the firebase uid with lots of different components
//we can use a context to let any component grab the value, like a global variable kind of

//we wrap the app with this PlayerProvider to provide the context, see main.jsx

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const [uid, setUid] = useState(null)
  const [playerData, setPlayerData] = useState(null)
  const [ready, setReady] = useState(false) //flips to true once auth and data loading are done

  const lastRefresh = useRef(0)

  useEffect(() => {
    initAuth(async (user) => {
      setUid(user.uid)

      //the function we made to fetch the document
      const existing = await loadPlayerData(user.uid)
      if (existing) {
        setPlayerData(existing) //save to state variable
      } else {
        const fresh = buildFreshPlayerData() //see below
        await savePlayerData(user.uid, fresh)
        setPlayerData(fresh)
      }

      setReady(true)
    })
  }, [])

  async function save(updates, { localOnly = false } = {}) {
    if (!uid) return
    setPlayerData(prev => applyDotNotation(prev, updates))
    if (!localOnly) await savePlayerData(uid, updates)
  }

  function applyDotNotation(obj, updates) {
    const result = structuredClone(obj)
    for (const [path, value] of Object.entries(updates)) {
      const keys = path.split('.')
      let cur = result
      for (let i = 0; i < keys.length - 1; i++) {
        if (cur[keys[i]] === undefined) cur[keys[i]] = {}
        cur = cur[keys[i]]
      }
      cur[keys[keys.length - 1]] = value
    }
    return result
  }

  async function refreshPlayer() {
    if (!uid) return
    const now = Date.now()
    if (now - lastRefresh.current < 60000) return // don't refresh if within 60 seconds
    //do i need to rate limit this? idk but might as well
    //currently only used when stats component loads to try and get a up to date version.
    lastRefresh.current = now
    const data = await loadPlayerData(uid)
    if (data) setPlayerData(data)
  }

  return (
    <PlayerContext.Provider value={{uid, playerData, save, ready, refreshPlayer}}>
      {children}
    </PlayerContext.Provider>
  )
}

//TODO
export function usePlayer() {
  return useContext(PlayerContext)
}

//this is our source of truth for what a new player looks like
function buildFreshPlayerData() {
  return {
    stats: {
      currentStreak: 0,
      bestStreak: 0,
      totalCachesSolved: 0,
      totalDaysPlayed: 0,
      totalCachesOpened: 0,
      totalItemsCollected: 0,
      lastPlayedDate: null,
      createdDate: new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
      guessDistribution: {},
      averageGuesses: 0,
      totalTradesExecuted: 0,
      tradesByTown: {},
      totalItemsTraded: 0,
      itemsTradedByTown: {},
      totalItemsReceived: 0,
      itemsReceivedByTown: {},
      totalReputationEarned: 0,
      reputationEarnedByTown: {},
      totalShipmentsOpened: 0,
      bestTowerHeight: 0,
      totalTowerBlocks: 0,
      totalForumRuns: 0,
      totalCrystalsEarned: 0,
      totalShardsEarned: 0,
      totalAnchors: 0,
      totalPerfects: 0,
      totalCrits: 0,
      totalBubblesPopped: 0,
      totalPrestiges: 0,
      totalHeartsEarned: 0,
      //for prestige
      bestPrestigeTowerHeight: 0,
      totalPrestigeCrystalsEarned: 0,
      totalPrestigeShardsEarned: 0,
      totalPrestigeFuelSpent: 0,
    },
    today: {
      date: null,
      caches: [],
      delvePoints: {},
    },
    inventory: {
      unopenedCaches: [],
      currencies: {denPieces: 0},
      items: []
    },
    upgrades: {
      craftingTable: 0,
      luckTier: 0,
      distancePrecision: 0,
      directionArrows: 0,
      delveMods: 0,
      fishingNet: 0,
      buildHabitat: 0,
      newHire: 0,
      unlocked: [],
    },
    travel: {
      forum: {
        xp: 0,
        fuel: 0,
        name: 'The Fallen Forum',
        tier: 0,
        currencies: { crystals: 0, shards: 0, hearts: 0 },
        upgrades: {},
      },
      towns: {
        alnera:    { reputation: 0, lastShipment: null, unlocked: false },
        frostgate: { reputation: 0, lastShipment: null, unlocked: false },
        mistport:  { reputation: 0, lastShipment: null, unlocked: false },
        steelmeld: { reputation: 0, lastShipment: null, unlocked: false },
      }
    },
    equip: {
      slots: [
        { slotId: 'slot_001', type: 'helmet',     itemId: null, infusions: [] },
        { slotId: 'slot_002', type: 'chestplate', itemId: null, infusions: [] },
        { slotId: 'slot_003', type: 'leggings',   itemId: null, infusions: [] },
        { slotId: 'slot_004', type: 'boots',       itemId: null, infusions: [] },
        { slotId: 'slot_005', type: 'mainhand',   itemId: null, infusions: [] },
        { slotId: 'slot_006', type: 'offhand',    itemId: null, infusions: [] },
      ]
    },
    depthsle: {
      lastPlayed: null,
      bestScore: 0,
      bestRooms: 0,
      totalRuns: 0,
      lastResult: null,
    }
  }
}

//