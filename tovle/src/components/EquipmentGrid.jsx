import { useState, useMemo, useRef } from 'react'
import { usePlayer } from '../context/PlayerContext'
import islesItems from '../data/islesItems.json'
import ItemIcon from './ItemIcon'
import './LootGrid.css'
import './EquipmentGrid.css'
import EquipmentCard from './EquipmentCard'
import EquipmentControls, { TIER_ORDER } from './EquipmentControls'

function EquipmentTooltip({ tooltip }) {
  if (!tooltip) return null
  return (
    <div
      className="loot-tooltip"
      style={{
        left: tooltip.x,
        top: tooltip.y,
        transform: 'translate(-50%, -100%)',
        position: 'fixed',
      }}
    >
      {tooltip.text}
    </div>
  )
}

const TIER_BADGE = {
  'Tier 1': 'I',
  'Tier 2': 'II',
  'Tier 3': 'III',
  'Tier 4': 'IV',
  'Tier 5': 'V',
  'Uncommon': 'Unc',
  'Unique': 'Unq',
  'Rare': 'R',
  'Artifact': 'A',
  'Epic': 'E',
}

const ROWS_PER_PAGE = 6
const ITEMS_PER_PAGE = ROWS_PER_PAGE * 9

export default function EquipmentGrid() {
  const { playerData, save } = usePlayer()
  const instances = playerData?.equipment ?? []

  const [selectedId, setSelectedId] = useState(null)
  const tooltipRef = useRef(null)
  const tooltipElRef = useRef(null)

  //settings
  const [sortAxis, setSortAxis] = useState('tier')
  const [sortDir, setSortDir] = useState('desc')
  const [filterStarred, setFilterStarred] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [filterTier, setFilterTier] = useState('')

  const [currentPage, setCurrentPage] = useState(0)

  const handleSetSortAxis = (v) => { setSortAxis(v); setCurrentPage(0) }
  const handleSetSortDir = (v) => { setSortDir(v); setCurrentPage(0) }
  const handleSetFilterStarred = (v) => { setFilterStarred(v); setCurrentPage(0) }
  const handleSetFilterType = (v) => { setFilterType(v); setCurrentPage(0) }
  const handleSetFilterTier = (v) => { setFilterTier(v); setCurrentPage(0) }

  const selectedInstance = selectedId
  ? (instances.find(i => i.id === selectedId) ?? null)
  : null

  const isTouchDevice = window.matchMedia('(hover: none)').matches

  const handleMouseEnter = (e, slot) => {
    const itemDef = islesItems[slot.itemKey]
    if (!itemDef) return
    const rect = e.currentTarget.getBoundingClientRect()
    if (tooltipElRef.current) {
      tooltipElRef.current.style.left = `${rect.left + rect.width / 2}px`
      tooltipElRef.current.style.top = `${rect.top - 8}px`
      tooltipElRef.current.style.display = 'block'
      tooltipElRef.current.textContent = itemDef.name
    }
  }


  const handleMouseLeave = () => {
    if (tooltipElRef.current) {
      tooltipElRef.current.style.display = 'none'
    }
  }

  const handleStar = (instance) => {
    const updatedEquipment = (playerData.equipment ?? []).map(item =>
      item.id === instance.id ? { ...item, starred: !item.starred } : item
    )
    save({ equipment: updatedEquipment })
  }

  const sortedFiltered = useMemo(() => {
    let result = [...instances]

    // apply filters
    if (filterStarred) result = result.filter(i => i.starred)
    if (filterType) result = result.filter(i => {
      const def = islesItems[i.itemKey]
      return def?.type === filterType
    })
    if (filterTier) result = result.filter(i => i.tier === filterTier)

    // sort helper: alphabetical by item name as tiebreaker
    const alpha = (a, b) => {
      const nameA = islesItems[a.itemKey]?.name ?? a.itemKey
      const nameB = islesItems[b.itemKey]?.name ?? b.itemKey
      return nameA.localeCompare(nameB)
    }

    const dir = sortDir === 'asc' ? 1 : -1

    result.sort((a, b) => {
      // starred always first within their group
      if (a.starred && !b.starred) return -1
      if (!a.starred && b.starred) return 1

      if (!sortAxis) return alpha(a, b)

      if (sortAxis === 'date') {
        const diff = (a.obtainedDate ?? '').localeCompare(b.obtainedDate ?? '')
        return diff !== 0 ? diff * dir : alpha(a, b)
      }
      if (sortAxis === 'tier') {
        const diff = (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99)
        return diff !== 0 ? diff * dir : alpha(a, b)
      }
      if (sortAxis === 'float') {
        const diff = (a.float ?? 0) - (b.float ?? 0)
        return diff !== 0 ? diff * dir : alpha(a, b)
      }

      return alpha(a, b)
    })

    return result
  }, [instances, sortAxis, sortDir, filterStarred, filterType, filterTier])
  
  
  const totalPages = Math.ceil(sortedFiltered.length / ITEMS_PER_PAGE) || 1
  const pageItems = sortedFiltered.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  )
  // on last page, size dynamically (1-6 rows). on other pages, always full 6 rows
  const slotCount = totalPages === 1
    ? Math.ceil(Math.max(pageItems.length, 9) / 9) * 9
    : ITEMS_PER_PAGE

  const slots = Array(slotCount).fill(null)
  pageItems.forEach((instance, i) => { slots[i] = instance })

  return (
    <>
      <EquipmentControls
        instances={instances} 
        sortAxis={sortAxis} setSortAxis={handleSetSortAxis}
        sortDir={sortDir} setSortDir={handleSetSortDir}
        filterStarred={filterStarred} setFilterStarred={handleSetFilterStarred}
        filterType={filterType} setFilterType={handleSetFilterType}
        filterTier={filterTier} setFilterTier={handleSetFilterTier}
      />

      <div className="loot-grid">
        {slots.map((slot, i) => {
          const itemDef = slot ? islesItems[slot.itemKey] : null

          return (
            <div
              key={slot ? slot.id : `empty-${i}`}
              className={`loot-slot ${slot ? 'loot-slot--filled' : ''}`}
              onClick={slot ? () => setSelectedId(slot.id) : undefined}
              onMouseEnter={slot && !isTouchDevice ? (e) => handleMouseEnter(e, slot) : undefined}
              onMouseLeave={slot && !isTouchDevice ? handleMouseLeave : undefined}
            >
              {slot && itemDef && (
                <>
                  {slot.starred && (
                    <span className="eq-badge eq-badge--topleft">⭐</span>
                  )}
                  <span className="eq-badge eq-badge--topright">
                    {TIER_BADGE[slot.tier] ?? slot.tier}
                  </span>
                  <ItemIcon itemKey={slot.itemKey} />
                  {slot.equipped && (
                    <span className="eq-badge eq-badge--bottomleft">E</span>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="eq-pagination">
          <button
            className="eq-page-btn"
            onClick={() => setCurrentPage(p => p - 1)}
            disabled={currentPage === 0}
          >
            ‹
          </button>
          <span className="eq-page-label">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            className="eq-page-btn"
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={currentPage === totalPages - 1}
          >
            ›
          </button>
        </div>
      )}

      <div
        ref={tooltipElRef}
        className="loot-tooltip"
        style={{
          display: 'none',
          position: 'fixed',
          transform: 'translate(-50%, -100%)',
        }}
      />

      {selectedInstance && (
        <EquipmentCard
          instance={selectedInstance}
          onClose={() => setSelectedId(null)}
          onStar={handleStar}
          onEquip={(instance) => console.log('equip', instance)}
          onRecycle={(instance) => console.log('recycle', instance)}
        />
      )}
    </>
  )
}