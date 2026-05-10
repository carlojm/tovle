import { useState, useMemo } from 'react'
import { usePlayer } from '../context/PlayerContext'
import islesItems from '../data/islesItems.json'
import ItemIcon from './ItemIcon'
import './LootGrid.css'
import './EquipmentGrid.css'
import EquipmentCard from './EquipmentCard'
import EquipmentControls, { TIER_ORDER } from './EquipmentControls'

const TIER_BADGE = {
  'Tier 1': 'I',
  'Tier 2': 'II',
  'Tier 3': 'III',
  'Tier 4': 'IV',
  'Tier 5': 'V',
  'Uncommon': 'Unc',
  'Unique': 'Unq',
  'Rare': 'Rare',
  'Artifact': 'Arti',
  'Epic': 'Epic',
}

export default function EquipmentGrid() {
  const { playerData, save } = usePlayer()
  const instances = playerData?.equipment ?? []

  const [selectedId, setSelectedId] = useState(null)
  const [tooltip, setTooltip] = useState(null)

  //settings
  const [sortAxis, setSortAxis] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [filterStarred, setFilterStarred] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [filterTier, setFilterTier] = useState('')

  const selectedInstance = selectedId
    ? (instances.find(i => i.id === selectedId) ?? null)
    : null

  const handleMouseEnter = (e, slot) => {
    const itemDef = islesItems[slot.itemKey]
    if (!itemDef) return
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({
      text: itemDef.name,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    })
  }

  const handleMouseLeave = () => setTooltip(null)

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

  const count = Math.ceil(Math.max(instances.length, 9) / 9) * 9
  const slots = Array(count).fill(null)
  // instances.forEach((instance, i) => { slots[i] = instance })
  sortedFiltered.forEach((instance, i) => { slots[i] = instance })

  return (
    <>
      <EquipmentControls
        instances={instances}
        sortAxis={sortAxis} setSortAxis={setSortAxis}
        sortDir={sortDir} setSortDir={setSortDir}
        filterStarred={filterStarred} setFilterStarred={setFilterStarred}
        filterType={filterType} setFilterType={setFilterType}
        filterTier={filterTier} setFilterTier={setFilterTier}
      />

      <div className="loot-grid">
        {slots.map((slot, i) => {
          const itemDef = slot ? islesItems[slot.itemKey] : null

          return (
            <div
              key={slot ? slot.id : `empty-${i}`}
              className={`loot-slot ${slot ? 'loot-slot--filled' : ''}`}
              onClick={slot ? () => setSelectedId(slot.id) : undefined}
              onMouseEnter={slot ? (e) => handleMouseEnter(e, slot) : undefined}
              onMouseLeave={slot ? handleMouseLeave : undefined}
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

      {tooltip && (
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
      )}

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