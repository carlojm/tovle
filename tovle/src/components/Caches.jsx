import { useState, useRef } from 'react'
import { usePlayer } from '../context/PlayerContext'
import LootGrid from './LootGrid'
import { ITEM_MAP } from '../data/itemMap'
import './Caches.css'
import Crafting from './Crafting'
import Axolotl from './Axolotl'
import CacheAnimation from './CacheAnimation'

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

const Caches = ({ onOpenCaches }) => {
  const { uid, playerData, save } = usePlayer()
  const [activeGrid, setActiveGrid] = useState(null) // loot grid currently being shown
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [hideMaxed, setHideMaxed] = useState(false)

  const [animPhase, setAnimPhase] = useState('idle') // idle | orb | reveal | done
  const [pendingItems, setPendingItems] = useState([])
  const [openingCacheKey, setOpeningCacheKey] = useState(null)

  const [displayUnopenedCaches, setDisplayUnopenedCaches] = useState(null)

  //used to prevent interactions while animations happen
  const isAnimating = animPhase === 'orb' || animPhase === 'reveal'

  // const unopenedCaches = playerData?.inventory?.unopenedCaches ?? []
  const unopenedCaches = displayUnopenedCaches ?? playerData?.inventory?.unopenedCaches ?? []
  const inventoryItems = playerData?.inventory?.items ?? []

  const handleOpenCache = async (cacheEntry) => {
    if (isAnimating || loading) return

    setLoading(true)
    setError(null)
    setActiveGrid(null)
    setAnimPhase('orb')

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
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        setAnimPhase('idle')
        setOpeningCacheKey(null)
        return
      }

      setPendingItems(data.items)


      // update local playerData so UI reflects immediately
      const updatedUnopenedCaches = unopenedCaches.filter(
        c => !(c.cacheId === cacheEntry.cacheId && c.date === cacheEntry.date)
      )
      const existingItems = playerData?.inventory?.items ?? []
      const mergedItems = mergeItems(existingItems, data.items)

      //for statistics
      const totalItems = data.items.reduce((sum, item) => sum + item.quantity, 0)

      const existingOpenedCaches = playerData?.inventory?.openedCaches ?? []

      // set display list to current caches before save removes the opening one
      setDisplayUnopenedCaches(playerData?.inventory?.unopenedCaches ?? [])

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
      setAnimPhase('idle')
      setOpeningCacheKey(null)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCollect = () => {
    setActiveGrid(null)
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
        luckTier: 0,
        distancePrecision: 0,
        directionArrows: 0,
        fishingNet: 0,
        buildHabitat: 0,
        newHire: 0,
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

  return (
    <div className="caches-container">
      <p>SO EXTREMELY WIP</p>
      <p>data will likely be deleted often until release</p>
      <p>and here's a bunch of debug buttons to test stuff</p>

      {/* {import.meta.env.DEV && ( */}
        <>
        <button onClick={handleDebugAddCache} className="cache-entry-button">
          [DEBUG] Add Unopened Cache
        </button>
        <button onClick={handleDebugResetUpgrades} className="cache-entry-button">
          [DEBUG] Reset Upgrades
        </button>
        <button onClick={handleDebugResetAxolotlCollection} className="cache-entry-button">
          [DEBUG] Reset Axolotl Collection Timer
        </button>
        </>
      {/* )} */}


      {/* unopened caches list */}
      <section className="caches-section">
        <h2>Unopened Caches</h2>
        {unopenedCaches.length === 0 && !activeGrid && (
          <p className="caches-empty">No unopened caches. Play today's caches to earn more!</p>
        )}
        {unopenedCaches.map(cache => {
          const key = `${cache.cacheId}-${cache.date}`
          const isOpening = openingCacheKey === key

          return (
            <button
              key={key}
              className={`cache-entry-button ${loading || isAnimating ? 'disable-button' : ''}`}
              onClick={() => !loading && !isAnimating && handleOpenCache(cache)}
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
                  <span>{cache.date}</span>
                </>
              )}
            </button>
          )
        })}
      </section>

      {/* loot grid */}
      <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* <div className="co-stage-wrapper"> */}
          {animPhase === 'orb' && (
            <CacheAnimation
              items={pendingItems}
              onComplete={() => {
                setDisplayUnopenedCaches(null) //release display lock, real data takes over display
                setOpeningCacheKey(null) //remove the cache being opened's button
                setAnimPhase('reveal')
                setTimeout(() => setAnimPhase('done'), 27 * 30 + 400)
              }}
            />
          )}
        {/* </div> */}
        {activeGrid && (animPhase === 'reveal' || animPhase === 'done') && (
          <section className="caches-section loot-reveal">
            {/* <h2>Loot</h2> */}
            <LootGrid grid={activeGrid} revealing={animPhase === 'reveal'}/>
            <button className="submit-button" onClick={handleCollect}>
              Collect
            </button>
          </section>
        )}
      </div>
      
      {/* {loading && <p className="caches-loading">Opening cache...</p>} */}
      {error && <p className="caches-error">{error}</p>}

      {/* inventory */}
      <section className="caches-section">
        <h2>Inventory</h2>
        {inventoryItems.length === 0 ? (
          <p className="caches-empty">Your inventory is empty.</p>
        ) : (
          <LootGrid grid={inventoryItems} isInventory />
        )}
      </section>

      <section className="caches-section">
        <div className="caches-section-header">
          <h2>Crafting</h2>
          <button
            className="caches-toggle-btn"
            onClick={() => setHideMaxed(prev => !prev)}
          >
            {hideMaxed ? 'Show Maxed' : 'Hide Maxed'}
          </button>
        </div>
        <Crafting hideMaxed={hideMaxed}/>
      </section>

      {playerData?.upgrades?.newHire >= 1 && (
        <section className="caches-section">
          <h2>Axolotls</h2>
          <Axolotl />
        </section>
      )}

    </div>
  )
}

export default Caches