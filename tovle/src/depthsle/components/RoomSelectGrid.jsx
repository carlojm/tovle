import { useState } from 'react'
import './RoomSelectGrid.css'
import { ROOM_TYPES } from '../data/layouts.js'

import abilityIcon       from '../../assets/depths_icons/normal_room_with_ability_reward.png'
import eliteAbilityIcon  from '../../assets/depths_icons/elite_room_with_ability_reward.png'
import upgradeIcon       from '../../assets/depths_icons/normal_room_with_upgrade_reward.png'
import eliteUpgradeIcon  from '../../assets/depths_icons/elite_room_with_upgrade_reward.png'
import treasureIcon      from '../../assets/depths_icons/normal_room_with_treasure_reward.png'
import eliteTreasureIcon from '../../assets/depths_icons/elite_room_with_treasure_reward.png'

const ROOM_ICONS = {
  ability:        abilityIcon,
  elite_ability:  eliteAbilityIcon,
  upgrade:        upgradeIcon,
  elite_upgrade:  eliteUpgradeIcon,
  treasure:       treasureIcon,
  elite_treasure: eliteTreasureIcon,
}

const REWARD_DESC = {
  ability:  'Choose a new ability to add to your deck.',
  upgrade:  'Choose a permanent stat upgrade for this run.',
  treasure: 'Gain treasure points to end your run with more loot.',
}

export default function RoomSelectGrid({ roomOptions, onSelect }) {
  const [selected, setSelected] = useState(null)

  // Build a 27-slot array (3 rows × 9 cols), placing rooms at their fixed positions.
  const slots = Array(27).fill(null)
  for (const typeId of roomOptions) {
    const def = ROOM_TYPES[typeId]
    if (!def) continue
    const index = (def.gridRow - 1) * 9 + (def.gridCol - 1)
    slots[index] = { typeId, def }
  }

  const handleTap = (slot) => {
    if (!slot) return
    setSelected(slot.typeId)
  }

  const selectedDef = selected ? ROOM_TYPES[selected] : null

  return (
    <div className="rsg-container">

      {/* ── Grid ── */}
      <div className="rsg-grid">
        {slots.map((slot, i) => {
          const isSelected = slot && selected === slot.typeId
          return (
            <div
              key={i}
              className={`rsg-slot ${slot ? 'rsg-slot--filled' : ''} ${isSelected ? 'rsg-slot--selected' : ''}`}
              onClick={() => handleTap(slot)}
            >
              {slot && (
                <img
                  src={ROOM_ICONS[slot.typeId]}
                  alt={slot.def.label}
                  className="rsg-slot-icon"
                />
              )}
            </div>
          )
        })}
      </div>

      {/* ── Info card ── */}
      <div className={`rsg-info-card ${selectedDef ? 'rsg-info-card--visible' : ''}`}>
        {selectedDef ? (
          <>
            <div className="rsg-info-header">
              <div className="rsg-info-titles">
                <span className="rsg-info-label">{selectedDef.isElite ? 'Elite' : 'Normal'} Room</span>
                <span className="rsg-info-name">{selectedDef.reward} Reward</span>
              </div>
              {selectedDef.isElite && (
                <span className="rsg-elite-badge">Elite</span>
              )}
            </div>
            <p className="rsg-info-desc">
              {REWARD_DESC[selectedDef.reward.toLowerCase()]}
              {selectedDef.isElite && ' Tougher enemies but better rewards.'}
            </p>
            <button
              className="rsg-confirm-btn"
              onClick={() => onSelect(selected)}
            >
              Enter Room →
            </button>
          </>
        ) : (
          <p className="rsg-info-placeholder">Select a room to continue</p>
        )}
      </div>

    </div>
  )
}