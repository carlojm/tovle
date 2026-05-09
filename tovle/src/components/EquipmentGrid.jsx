import { useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import islesItems from '../data/islesItems.json'
import ItemIcon from './ItemIcon'
import './LootGrid.css'
import './EquipmentGrid.css'

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

export default function EquipmentGrid({ onSelectItem }) {
  const { playerData } = usePlayer()
  const instances = playerData?.equipment ?? []

  const count = Math.ceil(Math.max(instances.length, 9) / 9) * 9
  const slots = Array(count).fill(null)
  instances.forEach((instance, i) => { slots[i] = instance })

  return (
    <div className="loot-grid">
      {slots.map((slot, i) => {
        const itemDef = slot ? islesItems[slot.itemKey] : null

        return (
          <div
            key={slot ? slot.id : `empty-${i}`}
            className={`loot-slot ${slot ? 'loot-slot--filled' : ''}`}
            onClick={slot ? () => onSelectItem(slot) : undefined}
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
  )
}