import { useState, useRef } from 'react'
import { usePlayer } from '../context/PlayerContext'
import LootGrid from './LootGrid'
import { ITEM_MAP } from '../data/itemMap'
import './Caches.css'
import Crafting from './Crafting'
import Axolotl from './Axolotl'
import CacheAnimation from './CacheAnimation'
import { AnimatePresence, motion } from 'framer-motion'
import AxolotlTooltip from './AxolotlTooltip'

import debounce from 'lodash.debounce'

const mergeItems = (existing, incoming) => {
  const merged = {}

  for (const item of existing) {
    merged[item.itemId] = { ...item, quantity: item.quantity ?? 1 }
  }

  for (const item of incoming) {
    if (merged[item.itemId]) {
      merged[item.itemId].quantity += item.quantity ?? 1
    } else {
      merged[item.itemId] = { ...item, quantity: item.quantity ?? 1 }
    }
  }

  //sort by item map order
  const itemOrder = Object.keys(ITEM_MAP)
  return Object.values(merged).sort((a, b) => {
    const aIndex = itemOrder.indexOf(a.itemId)
    const bIndex = itemOrder.indexOf(b.itemId)
    return aIndex - bIndex
  })
}

const Caches = ({ }) => {
  const { uid, playerData, save } = usePlayer()
  const [activeGrid, setActiveGrid] = useState(null) // loot grid currently being shown
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [hideMaxed, setHideMaxed] = useState(true)

  const [pendingItems, setPendingItems] = useState([]) //items to use in cache animation
  const [openingCacheKey, setOpeningCacheKey] = useState(null) //cache being animated
  const [isRevealing, setIsRevealing] = useState(false)

  //used to "freeze" the list of unopenedcaches while we are animating one opening
  //we save the list before opening the cache and only go back to real list when done animating
  //reduces the amount of elements jumping up and down and screen as they appear and disappear
  const [displayUnopenedCaches, setDisplayUnopenedCaches] = useState(null)
  //let's do the inventory too
  const [displayInventory, setDisplayInventory] = useState(null)

  const unopenedCaches = displayUnopenedCaches ?? playerData?.inventory?.unopenedCaches ?? []
  const inventoryItems = displayInventory ?? playerData?.inventory?.items ?? []

  const showTutorialText = (playerData?.upgrades?.distancePrecision ?? 0) <= 2
    && (playerData?.upgrades?.directionArrows ?? 0) === 0

  //debounce used for axolotl feeding
  //we debounce in axolotl's handlefeed
  //we flush in Cache's handleOpenCache, Crafting's handleFlush,
  //and Axolotl's handle functions that are not feeding
  //to prevent overwriting anything wrong
  //is this too complicated probably but it hopefully works to reduce db writes
  const pendingFeedDataRef = useRef(null)
  const debouncedFeedSave = useRef(
    debounce(() => {
      if (pendingFeedDataRef.current) {
        save(pendingFeedDataRef.current)
        pendingFeedDataRef.current = null
      }
    }, 2000)
  ).current
  const scheduleSave = (data) => {
    pendingFeedDataRef.current = data
    debouncedFeedSave()
  }
  const flushSave = () => debouncedFeedSave.flush()


  const handleOpenCache = async (cacheEntry) => {
    if (pendingItems.length > 0 || loading) return

    unfreeze() //clear previous freeze before starting another open

    //flush debounce if necessary
    flushSave()

    setLoading(true)
    setError(null)
    setActiveGrid(null)
    setOpeningCacheKey(`${cacheEntry.cacheId}-${cacheEntry.date}`)

    try {
      const res = await fetch('/api/open-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid,
          cacheId: cacheEntry.cacheId,
          date: cacheEntry.date,
        })
      })

      const data = await res.json()

      //remove cache if server says it was already opened
      if (res.status === 409) {
        const updatedUnopenedCaches = unopenedCaches.filter(
          c => !(c.cacheId === cacheEntry.cacheId && c.date === cacheEntry.date)
        )
        save({ inventory: { ...playerData.inventory, unopenedCaches: updatedUnopenedCaches } })
        setError(data.error ?? 'Cache already opened')
        setOpeningCacheKey(null)
        return
      }


      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        setOpeningCacheKey(null)
        return
      }

      setPendingItems(data.items)

      // update local playerData so UI reflects immediately
      const updatedUnopenedCaches = unopenedCaches.filter(
        c => !(c.cacheId === cacheEntry.cacheId && c.date === cacheEntry.date)
      )
      const mergedItems = mergeItems(playerData?.inventory?.items ?? [], data.items)
      //for statistics
      const totalItems = data.items.reduce((sum, item) => sum + item.quantity, 0)
      const existingOpenedCaches = playerData?.inventory?.openedCaches ?? []

      //freeze the list of unopened caches to keep the opening one on screen
      //"unfreeze" happens in handleAnimationComplete
      setDisplayUnopenedCaches(updatedUnopenedCaches)
      setDisplayInventory(playerData?.inventory?.items ?? [])

      save({
        inventory: {
          ...playerData.inventory,
          unopenedCaches: updatedUnopenedCaches,
          openedCaches: [...existingOpenedCaches, { cacheId: cacheEntry.cacheId, date: cacheEntry.date }],
          items: mergedItems,
        },
        stats: {
          ...playerData.stats,
          totalCachesOpened: (playerData.stats?.totalCachesOpened ?? 0) + 1,
          totalItemsCollected: (playerData.stats?.totalItemsCollected ?? 0) + totalItems,
        }
      })

      setActiveGrid(data.grid)

    } catch (err) {
      setError('Failed to open cache. Try again.')
      setOpeningCacheKey(null)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAnimationComplete = () => {
    setPendingItems([])
    setIsRevealing(true)
    setTimeout(() => setIsRevealing(false), 27 * 30 + 400)
  }

  const unfreeze = () => {
    setDisplayUnopenedCaches(null)
    setDisplayInventory(null)
    setOpeningCacheKey(null)
  }

  const handleCollect = () => {
    setActiveGrid(null)
    unfreeze()
  }

  const handleDebugAddCache = () => {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const newUnopenedCache = {
      cacheId: Math.round(Math.random()*999)+10000,
      date: todayStr,
      guessCount: 3,
      score: 70,
    }
    save({
      inventory: {
        ...playerData.inventory,
        unopenedCaches: [...(playerData.inventory?.unopenedCaches ?? []), newUnopenedCache],
      }
    })
  }

  const handleDebugResetUpgrades = () => {
    save({
      upgrades: {
        ...playerData.upgrades,
        craftingTable: 0,
        streakRestore: 0,
        luckTier: 0,
        distancePrecision: 0,
        directionArrows: 0,
        fishingNet: 0,
        buildHabitat: 0,
        newHire: 0,
        delveMode: 0,
        unlockTravel: 0,
      }
    })
  }

  const handleDebugResetAxolotlCollection = () => {
    const updatedAxolotls = (playerData?.axolotls ?? []).map(a => ({
      ...a,
      lastCollected: null,
      lastCollectedCount: null,
    }))
    save({ axolotls: updatedAxolotls })
  }

  const handleDebugDeduplicateOpenedCaches = () => {
    const seen = new Set()
    const dedupedOpened = (playerData?.inventory?.openedCaches ?? []).filter(c => {
      if (seen.has(c.cacheId)) return false
      seen.add(c.cacheId)
      return true
    })
    const dedupedUnopened = (playerData?.inventory?.unopenedCaches ?? []).filter(c => {
      if (seen.has(c.cacheId)) return false
      seen.add(c.cacheId)
      return true
    })
    save({
      inventory: {
        ...playerData.inventory,
        openedCaches: dedupedOpened,
        unopenedCaches: dedupedUnopened,
      }
    })
  }

  const handleDebugBreakStreak = () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const twoDaysAgoStr = twoDaysAgo.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

    save({
      stats: {
        ...playerData.stats,
        currentStreak: 1,
        previousStreak: playerData.stats?.currentStreak ?? 5,
        lastPlayedDate: twoDaysAgoStr, // last actual play was two days ago
        streakBrokeDate: yesterdayStr, // missed yesterday, so window is today
      },
      upgrades: {
        ...playerData.upgrades,
        unlocked: [...(playerData.upgrades?.unlocked ?? []).filter(f => f !== 'streakRedeemable'), 'streakRedeemable'],
      }
    })
  }

  const handleDebugShowUid = () => {
    alert(`UID: ${uid}`)
  }

  const handleDebugClearToday = () => {
    save({ today: null })
  }

  return (
    <div className="caches-container">


      {/* unopened caches list */}
      <motion.section layout className="caches-section">
        {showTutorialText && (
          <motion.p layout="position" style={{marginTop:"-24px", marginBottom:"8px"}}>
            Here you can open caches and use the items to craft upgrades.
            The first few upgrades will impact the daily game. The rest of the upgrades 
            are part of Tovle's long term progression and only affect cache loot and 
            related mechanics.

            Tap an unopened cache to get started!
          </motion.p>
        )}
        
        <motion.h2 layout="position">Unopened Caches</motion.h2>
        {unopenedCaches.length === 0 && !activeGrid && (
          <p className="caches-empty">No unopened caches. Play today's caches to earn more!</p>
        )}
        {unopenedCaches.map(cache => {
          const key = `${cache.cacheId}-${cache.date}`
          const isOpening = openingCacheKey === key

          return (
            <button
              key={key}
              className={`cache-entry-button ${loading || pendingItems.length > 0 ? 'disable-button' : ''}`}
              onClick={() => !loading && pendingItems.length === 0 && handleOpenCache(cache)}
            >
              {isOpening ? (
                <span>Opening...</span>
              ) : cache.source === 'axolotl' ? (
                <>
                  <span>{cache.axolotlName}'s Cache</span>
                  <span>{cache.date}</span>
                </>
              ) : (
                <>
                  <span>Cache #{cache.cacheId}</span>
                  <span>{cache.guessCount} {cache.guessCount === 1 ? 'guess' : 'guesses'}</span>
                  {cache.delvePointsTotal > 0 &&
                    <span>{cache.delvePointsTotal} pts</span>
                  }
                  {/* <span>{cache.score}</span> */}
                  <span>{cache.date}</span>
                </>
              )}
            </button>
          )
        })}
      </motion.section>

      {/* loot grid */}
      <AnimatePresence mode="popLayout">
        {openingCacheKey && pendingItems.length > 0 && (
          <motion.div
            key="cache-animation"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration:0.2}}
            style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <CacheAnimation
              key={openingCacheKey}
              items={pendingItems}
              onComplete={handleAnimationComplete}
            />
          </motion.div>
        )}
        {/* using pendingitems length 0 as my flag that animation is done */}
        {/* a bit scuffed */}
        {activeGrid && pendingItems.length === 0 && (
          <motion.section
            key="loot-reveal"
            className="caches-section loot-reveal"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <LootGrid grid={activeGrid} revealing={isRevealing}/>
            <button className="submit-button" onClick={handleCollect}>
              Collect
            </button>
          </motion.section>
        )}
      </AnimatePresence>
        
      
      {/* {loading && <p className="caches-loading">Opening cache...</p>} */}
      {error && <p className="caches-error">{error}</p>}

      {/* inventory */}
      <motion.section layout className="caches-section">
        <h2>Inventory</h2>
        {inventoryItems.length === 0 ? (
          <p className="caches-empty">Your inventory is empty.</p>
        ) : (
          <LootGrid grid={inventoryItems} isInventory />
        )}
      </motion.section>

      <motion.section layout className="caches-section">
        <div className="caches-section-header">
          <motion.h2 layout="position">Crafting</motion.h2>
          <motion.button
            layout="position"
            className="caches-toggle-btn"
            onClick={() => setHideMaxed(prev => !prev)}
          >
            {hideMaxed ? 'Show Maxed' : 'Hide Maxed'}
          </motion.button>
        </div>
        <Crafting hideMaxed={hideMaxed} flushSave={flushSave}/>
      </motion.section>

      {playerData?.upgrades?.newHire >= 1 && (
        <motion.section layout className="caches-section">
          <h2>
            Axolotls
            <AxolotlTooltip />
          </h2>
          <Axolotl />
        </motion.section>
      )}


      {import.meta.env.DEV && (
      <div style={{gap:"px"}}>
        <button onClick={handleDebugAddCache} className="cache-entry-button">
          [DEBUG] Add Unopened Cache
        </button>
        <button onClick={handleDebugResetUpgrades} className="cache-entry-button">
          [DEBUG] Reset Upgrades
        </button>
        <button onClick={handleDebugResetAxolotlCollection} className="cache-entry-button">
          [DEBUG] Reset Axolotl Collection Timer
        </button>
        {/* <button onClick={handleDebugDeduplicateOpenedCaches} className="cache-entry-button">
          [DEBUG] Clean inv.openedCaches on server side, remove dupes
        </button> */}
        <button onClick={handleDebugShowUid} className="cache-entry-button">
          [DEBUG] Show UID
        </button>
        <button onClick={handleDebugClearToday} className="cache-entry-button">
          [DEBUG] Reset Today's Game
        </button>
        <button onClick={handleDebugBreakStreak} className="cache-entry-button">
          [DEBUG] Simulate Broken Streak
        </button>
      </div>
      )}

    </div>
  )
}

export default Caches