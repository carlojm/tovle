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

import { calcStats } from '../utils/odm/statCalc'
import { getPlayerSlots } from '../utils/equipUtils'

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

function StatRow({ label, value }) {
  return (
    <div className="ep-stat-row">
      <span className="ep-stat-label">{label}</span>
      <span className="ep-stat-value">{value}</span>
    </div>
  )
}

function StatSection({ title, rows, open, onToggle }) {
  return (
    <div className="ep-section">
      <button className="ep-section-header" onClick={onToggle}>
        <span>{title}</span>
        <span className="ep-section-chevron">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="ep-section-rows">
          {rows.map((row, i) =>
            row === null
              ? <div key={`divider-${i}`} className="ep-section-divider" />
              : <StatRow key={row[0]} label={row[0]} value={row[1]} />
          )}
        </div>
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

  //collapsible stat box state
  const [sectionsOpen, setSectionsOpen] = useState(false)

  // Pull the 6 named slots by their fixed positions
  const [helmetSlot, chestSlot, legsSlot, bootsSlot, mainhandSlot, offhandSlot] = mainSlots

  const allSlots = [...mainSlots, ...bonusSlots]
  // const armorTotal   = sumEquippedStat(allSlots, equipment, 'armor')
  // const agilityTotal = sumEquippedStat(allSlots, equipment, 'agility')
  const slots = getPlayerSlots(playerData)
  const stats = calcStats(slots, equipment)

  const miscRows = stats ? [
    ['Armor',        stats.armor],
    ['Agility',      stats.agility],
    ['Speed',        `${stats.speedPercent}%`],
    ['KB Resist',    `${stats.knockbackRes}%`],
    ['Max HP',       stats.healthFinal],
    ['Healing Rate', `${stats.healingRate}%`],
  ] : []

  const ehpRows = stats ? [
    ['Melee',      stats.meleeEHP],
    ['Projectile', stats.projectileEHP],
    ['Magic',      stats.magicEHP],
    ['Blast',      stats.blastEHP],
    ['Fire',       stats.fireEHP],
    ['Fall',       stats.fallEHP],
    ['Ailment',    stats.ailmentEHP],
    null,
    ['Max HP',       stats.healthFinal],
    ['Healing Rate', `${stats.healingRate}%`],
    ['Regen/sec', `${stats.regenPerSec}`],
    ['Life Drain Crit', `${stats.lifeDrainOnCrit}`],
  ] : []

  const damageRows = stats ? [
    ['Atk Speed',     `${stats.attackSpeedPercent}%`],
    ['Wpn Atk Spd',   stats.attackSpeed],
    ['Damage',        `${stats.attackDamagePercent}%`],
    ['Wpn Damage',    stats.attackDamage],
    ['Melee DPS', stats.critSpamDPS],
    null,
    ['Proj Damage',   `${stats.projectileDamagePercent}%`],
    ['Wpn Proj Dmg',  stats.projectileDamage],
    ['Throw Rate',    `${stats.throwRatePercent}%`],
    ['Wpn Throw Rt',  stats.throwRate],
    ['Ranged DPS',  stats.projSpamDPS],
    null,
    ['Magic Damage',  `${stats.magicDamagePercent}%`],
    ['Total Magic',   `${stats.classMagicDamagePercent}%`],
    ['Potion Dmg',    stats.potionDamage],
    ['Cooldown',      `${stats.spellCooldownPercent}%`],
    ['Magic DPS',      stats.magicDPS],
  ] : []


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
          <div className="ep-slots-grid">
            <SlotCell slot={helmetSlot}   instance={getItemInSlot(helmetSlot, equipment)}   onTap={handleSlotTap} />
            <SlotCell slot={chestSlot}    instance={getItemInSlot(chestSlot, equipment)}    onTap={handleSlotTap} />
            <SlotCell slot={legsSlot}     instance={getItemInSlot(legsSlot, equipment)}     onTap={handleSlotTap} />
            <SlotCell slot={bootsSlot}    instance={getItemInSlot(bootsSlot, equipment)}    onTap={handleSlotTap} />
            <SlotCell slot={offhandSlot}  instance={getItemInSlot(offhandSlot, equipment)}  onTap={handleSlotTap} />
            <SlotCell slot={mainhandSlot} instance={getItemInSlot(mainhandSlot, equipment)} onTap={handleSlotTap} />
          </div>

          <div className="ep-right">

            {/* headline stat cards */}
            <div className="ep-headline">
              <div className="ep-headline-card">
                <span className="ep-headline-label">Armor / Agi</span>
                <span className="ep-headline-value">
                  {stats ? `${stats.armor} / ${stats.agility}` : '— / —'}
                </span>
              </div>
              <div className="ep-headline-card">
                <span className="ep-headline-label">Melee EHP</span>
                <span className="ep-headline-value">
                  {stats ? stats.meleeEHP : '—'}
                </span>
              </div>
              
              
              <div className="ep-headline-card">
                <span className="ep-headline-label">
                  {(() => {
                    const mainhandInstance = getItemInSlot(mainhandSlot, equipment)
                    const itemType = mainhandInstance ? islesItems[mainhandInstance.itemKey]?.type : null
                    if (['Bow', 'Crossbow', 'Trident', 'Snowball'].includes(itemType)) return 'Ranged DPS'
                    if (['Wand', 'Mainhand'].includes(itemType)) return 'Magic DPS'
                    return 'Crit DPS'
                  })()}
                </span>
                <span className="ep-headline-value">
                  {(() => {
                    if (!stats) return '—'
                    const mainhandInstance = getItemInSlot(mainhandSlot, equipment)
                    const itemType = mainhandInstance ? islesItems[mainhandInstance.itemKey]?.type : null
                    if (['Bow', 'Crossbow', 'Trident', 'Snowball'].includes(itemType)) return stats.projSpamDPS ?? '—'
                    if (['Wand', 'Mainhand'].includes(itemType)) return stats.magicDPS ?? '—'
                    return stats.critSpamDPS
                  })()}
                </span>
              </div>

            </div>

            {/* minor stats 2x2 grid */}
            {stats && (
              <div className="ep-minor">
                <div className="ep-minor-row">
                  <span className="ep-minor-label">Speed</span>
                  <span className="ep-minor-value">{stats.speedPercent}%</span>
                </div>
                <div className="ep-minor-row">
                  <span className="ep-minor-label">Max HP</span>
                  <span className="ep-minor-value">{stats.healthFinal}</span>
                </div>
                <div className="ep-minor-row">
                  <span className="ep-minor-label">KB Resist</span>
                  <span className="ep-minor-value">{stats.knockbackRes}%</span>
                </div>
                <div className="ep-minor-row">
                  <span className="ep-minor-label">Damage</span>
                  <span className="ep-minor-value">{stats.attackDamage}</span>
                </div>
              </div>
            )}

            {/* item name list */}
            <div className="ep-namelist">
              {[
                [helmetSlot,   'Helmet'],
                [chestSlot,    'Chest'],
                [legsSlot,     'Legs'],
                [bootsSlot,    'Boots'],
                [mainhandSlot, 'Mainhand'],
                [offhandSlot,  'Offhand'],
              ].map(([slot, label]) => {
                const instance = getItemInSlot(slot, equipment)
                const itemDef = instance ? islesItems[instance.itemKey] : null
                return (
                  <div key={slot.slotId} className="ep-namelist-row">
                    <span className="ep-namelist-label">{label}</span>
                    <span className={`ep-namelist-name ${!itemDef ? 'ep-namelist-empty' : ''}`}>
                      {itemDef ? itemDef.name : '—'}
                    </span>
                  </div>
                )
              })}
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

        {stats && (
          <div className="ep-sections">
            <StatSection title="EHP Info"    rows={ehpRows}    open={sectionsOpen} onToggle={() => setSectionsOpen(o => !o)} />
            <StatSection title="Damage Info" rows={damageRows} open={sectionsOpen} onToggle={() => setSectionsOpen(o => !o)} />
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