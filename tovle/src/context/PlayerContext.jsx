import { createContext, useContext, useState, useEffect } from "react"
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

  async function save(updates, {localOnly = false} = {}) {
    if (!uid) return
    const updated = { ...playerData, ...updates}
    setPlayerData(updated) //update state variable
    if (!localOnly) await savePlayerData(uid, updates) // update firebase document
    // console.log("saved")
  }

  return (
    <PlayerContext.Provider value={{uid, playerData, save, ready}}>
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
    }
  }
}

//