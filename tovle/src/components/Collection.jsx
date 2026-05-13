import { useState, useMemo, useRef } from 'react'
import { usePlayer } from '../context/PlayerContext'
import islesItems from '../data/islesItems.json'
import ItemIcon from './ItemIcon'
import EquipmentCard from './EquipmentCard'
import { TIER_ORDER } from './EquipmentControls'
import { getTypesForGroup } from '../utils/equipUtils'
import './LootGrid.css'
import './EquipmentGrid.css'
import './Collection.css'

const ITEMS_PER_PAGE = 54 // 6 rows × 9 cols

const TIER_BADGE = {
  'Tier 1': 'I', 'Tier 2': 'II', 'Tier 3': 'III', 'Tier 4': 'IV', 'Tier 5': 'V',
  'Uncommon': 'Uc', 'Unique': 'Uq', 'Rare': 'R', 'Artifact': 'A', 'Epic': 'E',
}

// All items from islesItems as a flat array, for the universe
const ALL_ITEMS = Object.entries(islesItems).map(([itemKey, def]) => ({ itemKey, ...def }))

// Derive available types and tiers from the full universe
const ALL_TYPES = [...new Set(ALL_ITEMS.map(i => i.type).filter(Boolean))].sort()
const ALL_TIERS = [...new Set(ALL_ITEMS.map(i => i.tier).filter(Boolean))]
  .sort((a, b) => (TIER_ORDER[a] ?? 99) - (TIER_ORDER[b] ?? 99))

export default function Collection() {
  const { playerData } = usePlayer()
  const collection = playerData?.stats?.equipmentCollection ?? {}

  const [filterType, setFilterType] = useState('')
  const [filterTier, setFilterTier] = useState('')
  const [filterCollected, setFilterCollected] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [selectedItem, setSelectedItem] = useState(null) // { itemKey, collectionData }

  const tooltipElRef = useRef(null)
  const isTouchDevice = window.matchMedia('(hover: none)').matches

  const handleMouseEnter = (e, itemKey) => {
    const def = islesItems[itemKey]
    if (!def || !tooltipElRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    tooltipElRef.current.style.left = `${rect.left + rect.width / 2}px`
    tooltipElRef.current.style.top = `${rect.top - 8}px`
    tooltipElRef.current.style.display = 'block'
    tooltipElRef.current.textContent = def.name
  }

  const handleMouseLeave = () => {
    if (tooltipElRef.current) tooltipElRef.current.style.display = 'none'
  }

  const sortedFiltered = useMemo(() => {
    let result = [...ALL_ITEMS]

    if (filterCollected) result = result.filter(i => !!collection[i.itemKey])

    if (filterType) result = result.filter(i => {
      if (filterType.startsWith('group:')) {
        return getTypesForGroup(filterType.replace('group:', '')).includes(i.type)
      }
      return i.type === filterType
    })

    if (filterTier) result = result.filter(i => i.tier === filterTier)

    // sort: tier asc, then type alpha, then name alpha
    result.sort((a, b) => {
      const tierDiff = (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99)
      if (tierDiff !== 0) return tierDiff
      const typeDiff = (a.type ?? '').localeCompare(b.type ?? '')
      if (typeDiff !== 0) return typeDiff
      return (a.name ?? a.itemKey).localeCompare(b.name ?? b.itemKey)
    })

    return result
  }, [filterType, filterTier, filterCollected, collection])

  const totalPages = Math.ceil(sortedFiltered.length / ITEMS_PER_PAGE) || 1
  const pageItems = sortedFiltered.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  )

  // always render full 54 slots, pad with nulls
  const slots = Array(ITEMS_PER_PAGE).fill(null)
  pageItems.forEach((item, i) => { slots[i] = item })

  const collectedCount = Object.keys(collection).length
  const totalCount = ALL_ITEMS.length

  const handleSetFilter = (setter) => (v) => { setter(v); setCurrentPage(0) }

  return (
    <div className="collection-container">
      <div className="collection-header">
        <h2>Collection</h2>
        <span className="collection-count">{collectedCount} / {totalCount}</span>
      </div>

      {/* controls */}
      <div className="eq-controls">
        <div className="eq-controls-row">
          <button
            className={`eq-control-btn ${filterCollected ? 'eq-control-btn--active' : ''}`}
            onClick={() => { setFilterCollected(f => !f); setCurrentPage(0) }}
          >
            Collected
          </button>

          <select
            className="eq-control-select"
            value={filterType}
            onChange={e => handleSetFilter(setFilterType)(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="group:mainhand">All Mainhand</option>
            <option value="group:offhand">All Offhand</option>
            <option value="group:armor">All Armor</option>
            <option value="" disabled>───</option>
            {ALL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <select
            className="eq-control-select"
            value={filterTier}
            onChange={e => handleSetFilter(setFilterTier)(e.target.value)}
          >
            <option value="">All Tiers</option>
            {ALL_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* grid */}
      <div className="loot-grid">
        {slots.map((item, i) => {
          if (!item) {
            return <div key={`empty-${i}`} className="loot-slot" />
          }

          const isCollected = !!collection[item.itemKey]

          return (
            <div
              key={item.itemKey}
              className={`loot-slot loot-slot--filled ${!isCollected ? 'collection-slot--undiscovered' : ''}`}
              onClick={() => setSelectedItem({ itemKey: item.itemKey, collectionData: collection[item.itemKey] ?? null })}
              onMouseEnter={!isTouchDevice ? (e) => handleMouseEnter(e, item.itemKey) : undefined}
              onMouseLeave={!isTouchDevice ? handleMouseLeave : undefined}
            >
              {isCollected ? (
                <>
                  <span className="eq-badge eq-badge--topright">
                    {TIER_BADGE[item.tier] ?? item.tier}
                  </span>
                  <ItemIcon itemKey={item.itemKey} />
                  {collection[item.itemKey]?.totalFound > 1 && (
                    <span className="eq-badge eq-badge--bottomleft collection-found-badge">
                      {collection[item.itemKey].totalFound}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="eq-badge eq-badge--topright collection-unknown-tier">
                    {TIER_BADGE[item.tier] ?? item.tier}
                  </span>
                  <span className="collection-unknown">?</span>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* pagination */}
      <div className="eq-pagination">
        <button
          className="eq-page-btn"
          onClick={() => setCurrentPage(p => p - 1)}
          disabled={currentPage === 0}
        >‹</button>
        <span className="eq-page-label">
          Page {currentPage + 1} of {totalPages} ({sortedFiltered.length} items)
        </span>
        <button
          className="eq-page-btn"
          onClick={() => setCurrentPage(p => p + 1)}
          disabled={currentPage === totalPages - 1}
        >›</button>
      </div>

      {/* imperative tooltip */}
      <div
        ref={tooltipElRef}
        className="loot-tooltip"
        style={{ display: 'none', position: 'fixed', transform: 'translate(-50%, -100%)' }}
      />

      {/* item card — readOnly, with collection data */}
      {selectedItem && (
        <EquipmentCard
          instance={{
            itemKey: selectedItem.itemKey,
            tier: islesItems[selectedItem.itemKey]?.tier,
            float: selectedItem.collectionData?.lowestFloat ?? null,
            starred: false,
            equipped: false,
            id: null,
          }}
          readOnly={true}
          collectionData={selectedItem.collectionData}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}