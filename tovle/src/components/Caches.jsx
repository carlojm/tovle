import { useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import LootGrid from './LootGrid'
import { ITEM_MAP } from '../data/itemMap'
import './Caches.css'

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

      save({
      inventory: {
          ...playerData.inventory,
          unopenedCaches: updatedUnopenedCaches,
          items: mergedItems,
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

  return (
    <div className="caches-container">

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
          <h2>Loot</h2>
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

    </div>
  )
}

export default Caches