import { useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import islesItems from '../data/islesItems.json'
import ItemIcon from './ItemIcon'
import EquipmentCard from './EquipmentCard'
import {
  getMainSlots,
  getBonusSlots,
  getItemInSlot,
  getSlotLabel,
} from '../utils/equipUtils'
import './EquipPanel.css'

const TIER_BADGE = {
  'Tier 1': 'I',
  'Tier 2': 'II',
  'Tier 3': 'III',
  'Tier 4': 'IV',
  'Tier 5': 'V',
  'Uncommon': 'Uc',
  'Unique': 'Uq',
  'Rare': 'R',
  'Artifact': 'A',
  'Epic': 'E',
}

// ── Stat summary ──────────────────────────────────────────────────────────────

function sumEquippedStat(slots, equipment, statKey) {
  return slots.reduce((total, slot) => {
    const instance = getItemInSlot(slot, equipment)
    if (!instance) return total
    const def = islesItems[instance.itemKey]
    return total + (def?.stats?.[statKey] ?? 0)
  }, 0)
}

// ── Single slot cell ──────────────────────────────────────────────────────────

function SlotCell({ slot, instance, onTap }) {
  const isEmpty = !instance
  const itemDef = instance ? islesItems[instance.itemKey] : null

  return (
    <div
      className={`ep-slot ep-slot--${slot.type} ${isEmpty ? 'ep-slot--empty' : 'ep-slot--filled'}`}
      onClick={() => onTap(slot, instance)}
      title={getSlotLabel(slot.type)}
    >
      {isEmpty ? (
        <span className="ep-slot-label">{getSlotLabel(slot.type)}</span>
      ) : (
        <>
          <ItemIcon itemKey={instance.itemKey} />
          {/* equipped badge reuses eq-badge styling from EquipmentGrid.css */}
          <span className="eq-badge eq-badge--topright ep-tier-badge">
            {/* {instance.tier?.replace('Tier ', '') ?? ''} */}
            {TIER_BADGE[instance.tier] ?? instance.tier}
          </span>
        </>
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function EquipPanel({ onSlotTap }) {
  const { playerData } = usePlayer()
  const equipment = playerData?.equipment ?? []

  const mainSlots = getMainSlots(playerData)
  const bonusSlots = getBonusSlots(playerData)

  // Pull the 6 named slots by their fixed positions
  const [helmetSlot, chestSlot, legsSlot, bootsSlot, mainhandSlot, offhandSlot] = mainSlots

  const allSlots = [...mainSlots, ...bonusSlots]
  const armorTotal   = sumEquippedStat(allSlots, equipment, 'armor')
  const agilityTotal = sumEquippedStat(allSlots, equipment, 'agility')

  // selectedInstance drives the EquipmentCard overlay
  const [selectedInstance, setSelectedInstance] = useState(null)

  const handleSlotTap = (slot, instance) => {
    if (instance) {
      // filled slot: open card for the item
      setSelectedInstance(instance)
    } else {
      // empty slot: notify parent to filter equipment grid
      onSlotTap?.(slot)
    }
  }

  // bonus slots render in rows of 9, matching the loot grid width
  const bonusRows = []
  for (let i = 0; i < bonusSlots.length; i += 9) {
    bonusRows.push(bonusSlots.slice(i, i + 9))
  }

  return (
    <>
      <div className="ep-panel">

        {/* ── Main 6 slots ── */}
        <div className="ep-main">

          {/* armor column + weapon column in a named grid */}
          <div className="ep-slots-grid">

            {/* col 1: armor */}
            <SlotCell slot={helmetSlot}    instance={getItemInSlot(helmetSlot, equipment)}    onTap={handleSlotTap} />
            <SlotCell slot={chestSlot}     instance={getItemInSlot(chestSlot, equipment)}     onTap={handleSlotTap} />
            <SlotCell slot={legsSlot}      instance={getItemInSlot(legsSlot, equipment)}      onTap={handleSlotTap} />
            <SlotCell slot={bootsSlot}     instance={getItemInSlot(bootsSlot, equipment)}     onTap={handleSlotTap} />

            {/* col 2: offhand row 1, mainhand row 4 — CSS grid handles placement */}
            <SlotCell slot={offhandSlot}   instance={getItemInSlot(offhandSlot, equipment)}   onTap={handleSlotTap} />
            <SlotCell slot={mainhandSlot}  instance={getItemInSlot(mainhandSlot, equipment)}  onTap={handleSlotTap} />

          </div>

          {/* ── Stats ── */}
          <div className="ep-stats">
            <span className="ep-stats-title">Stats</span>
            <div className="ep-stat-row">
              <span className="ep-stat-label">Armor</span>
              <span className="ep-stat-value">{armorTotal}</span>
            </div>
            <div className="ep-stat-row">
              <span className="ep-stat-label">Agility</span>
              <span className="ep-stat-value">{agilityTotal}</span>
            </div>
          </div>

        </div>

        {/* ── Bonus slots ── */}
        {bonusSlots.length > 0 && (
          <div className="ep-bonus">
            <div className="ep-bonus-divider" />
            {bonusRows.map((row, rowIdx) => (
              <div key={rowIdx} className="ep-bonus-row">
                {row.map(slot => (
                  <SlotCell
                    key={slot.slotId}
                    slot={slot}
                    instance={getItemInSlot(slot, equipment)}
                    onTap={handleSlotTap}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

      </div>

      {/* EquipmentCard overlay for filled slots */}
      {selectedInstance && (() => {
        const liveInstance = (playerData?.equipment ?? []).find(i => i.id === selectedInstance.id) ?? selectedInstance
        return (
          <EquipmentCard
            instance={liveInstance}
            onClose={() => setSelectedInstance(null)}
          />
        )
      })()}
    </>
  )
}