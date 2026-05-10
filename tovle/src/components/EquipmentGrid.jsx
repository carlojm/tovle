import { useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import islesItems from '../data/islesItems.json'
import ItemIcon from './ItemIcon'
import './LootGrid.css'
import './EquipmentGrid.css'
import EquipmentCard from './EquipmentCard'

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

  const selectedInstance = selectedId
  ? (playerData.equipment ?? []).find(item => item.id === selectedId) ?? null
  : null

  const count = Math.ceil(Math.max(instances.length, 9) / 9) * 9
  const slots = Array(count).fill(null)
  instances.forEach((instance, i) => { slots[i] = instance })

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


  return (
    <>
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