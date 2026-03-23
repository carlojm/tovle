import { useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import LootGrid from './LootGrid'
import { ITEM_MAP } from '../data/itemMap'
import './Caches.css'
import Crafting from './Crafting'
import Axolotl from './Axolotl'

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

  const unopenedCaches = playerData?.inventory?.unopenedCaches ?? []
  const inventoryItems = playerData?.inventory?.items ?? []

  const handleOpenCache = async (cacheEntry) => {
    setLoading(true)
    setError(null)

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
        return
      }

      // update local playerData so UI reflects immediately
      const updatedUnopenedCaches = unopenedCaches.filter(
        c => !(c.cacheId === cacheEntry.cacheId && c.date === cacheEntry.date)
      )
      const existingItems = playerData?.inventory?.items ?? []
      const mergedItems = mergeItems(existingItems, data.items)

      //for statistics
      const totalItems = data.items.reduce((sum, item) => sum + item.quantity, 0)

      save({
      inventory: {
          ...playerData.inventory,
          unopenedCaches: updatedUnopenedCaches,
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
      distancePrecision: 0,
      directionArrows: 0,
      luckTier: 0,
    }
  })
}

  return (
    <div className="caches-container">
      <p>SO EXTREMELY WIP</p>
      <p>data will likely be deleted often until release</p>
      <p>all of this ui will change. icons are placeholders</p>

      {import.meta.env.DEV && (
        <>
        <button onClick={handleDebugAddCache} className="cache-entry-button">
          [DEBUG] Add Unopened Cache
        </button>
        <button onClick={handleDebugResetUpgrades} className="cache-entry-button">
          [DEBUG] Reset Upgrades
        </button>
        </>
      )}


      {/* unopened caches list */}
      <section className="caches-section">
        <h2>Unopened Caches</h2>
        {unopenedCaches.length === 0 && !activeGrid && (
          <p className="caches-empty">No unopened caches. Play today's caches to earn more!</p>
        )}
        {unopenedCaches.map(cache => (
          <button
            key={`${cache.cacheId}-${cache.date}`}
            className={`cache-entry-button ${loading ? 'disable-button' : ''}`}
            onClick={() => !loading && !activeGrid && handleOpenCache(cache)}
          >
            <span>Cache #{cache.cacheId}</span>
            <span>{cache.guessCount} {cache.guessCount === 1 ? 'guess' : 'guesses'}</span>
            <span>{cache.date}</span>
          </button>
        ))}
      </section>

      {/* loot grid */}
      {loading && <p className="caches-loading">Opening cache...</p>}
      {error && <p className="caches-error">{error}</p>}
      {activeGrid && (
        <section className="caches-section">
          {/* <h2>Loot</h2> */}
          <LootGrid grid={activeGrid} />
          <button className="submit-button" onClick={handleCollect}>
            Collect
          </button>
        </section>
      )}

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
        <h2>Crafting</h2>
        <Crafting />
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