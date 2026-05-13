import { useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { motion, AnimatePresence } from 'framer-motion'

import ItemIcon from './ItemIcon'
import islesItems from '../data/islesItems.json'
import { formatStats } from '../utils/statFormatter'
import './EquipmentCard.css'

import { calcRecyclePrice, getFloatLabel } from '../utils/recycleUtils'
import { getValidSlotsForItem, getItemInSlot, getSlotLabel, DEFAULT_SLOTS, calcBestEquipStats, getPlayerSlots } from '../utils/equipUtils'

function locationToClass(location) {
  if (!location) return ''
  return 'monumenta-' + location.toLowerCase().replaceAll(' ', '-')
}

function tierToClass(tier) {
  if (!tier) return ''
  return 'monumenta-' + tier.toLowerCase().replaceAll(' ', '-')
}

//flip animation variants
//exit: rotate up to 90, enter: arrive from -90
const flipVariants = {
  enter: {
    rotateX: [-90, 0],
    transition: { duration: 0.25, ease: 'easeOut', delay: 0.15 },
  },
  exit: {
    rotateX: [0, 90],
    transition: { duration: 0.15, ease: 'easeIn' },
  },
}

export default function EquipmentCard({ instance, onClose, readOnly = false, collectionData = null }) {
  const { playerData, uid, save } = usePlayer()
  const [metaView, setMetaView] = useState('info') // 'info' | 'recycle' | 'equip'
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0)

  if (!instance) return null
  const itemDef = islesItems[instance.itemKey]
  if (!itemDef) return null

  const stats = formatStats(itemDef.stats)
  const tierClass = tierToClass(instance.tier)
  const locationClass = locationToClass(itemDef.location)

  const recyclePrice = calcRecyclePrice(instance.tier, instance.float)
  // guard float label — synthetic instances from collection view may have null float
  const floatLabel = instance.float != null ? getFloatLabel(instance.float) : null

  //for equip view
  const slots = playerData?.equip?.slots ?? DEFAULT_SLOTS
  const validSlots = getValidSlotsForItem(itemDef.type, slots)
  const targetSlot = validSlots[selectedSlotIndex] ?? null
  const currentlyEquipped = targetSlot ? getItemInSlot(targetSlot, playerData.equipment ?? []) : null
  const currentItemDef = currentlyEquipped ? islesItems[currentlyEquipped.itemKey] : null
 
  const handleClose = () => {
    setMetaView('info')
    onClose()
  }
 
  const handleStar = () => {
    const updatedEquipment = (playerData.equipment ?? []).map(item =>
      item.id === instance.id ? { ...item, starred: !item.starred } : item
    )
    save({ equipment: updatedEquipment })
  }

  const handleRecycle = async () => {
    try {
      const res = await fetch('/api/recycle-equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, itemId: instance.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Recycle failed:', data.error)
        return
      }

      const updatedEquipment = (playerData.equipment ?? []).filter(i => i.id !== instance.id)
      const currentDen = playerData.inventory?.currencies?.denPieces ?? 0
      save({
        equipment: updatedEquipment,
        'inventory.currencies.denPieces': currentDen + data.payout,
      })

      handleClose()
    } catch (err) {
      console.error('Recycle error:', err)
    }
  }

  const handleEquip = () => {
    if (!targetSlot) return

    const currentSlots = playerData?.equip?.slots ?? DEFAULT_SLOTS
    const updatedSlots = currentSlots.map(s =>
      s.slotId === targetSlot.slotId ? { ...s, itemId: instance.id } : s
    )
    const updatedEquipment = (playerData.equipment ?? []).map(e => {
      if (e.id === instance.id) return { ...e, equipped: true }
      if (e.id === targetSlot.itemId) return { ...e, equipped: false }
      return e
    })

    const bestEquipStats = calcBestEquipStats(
      updatedSlots,
      updatedEquipment,
      playerData?.stats?.bestEquipStats ?? {}
    )

    save({
      'equip.slots': updatedSlots,
      equipment: updatedEquipment,
      'stats.bestEquipStats': bestEquipStats,
    })
    handleClose()
  }

  const handleUnequip = () => {
    const currentSlots = playerData?.equip?.slots ?? DEFAULT_SLOTS
    const updatedSlots = currentSlots.map(s =>
      s.itemId === instance.id ? { ...s, itemId: null } : s
    )
    const updatedEquipment = (playerData.equipment ?? []).map(e =>
      e.id === instance.id ? { ...e, equipped: false } : e
    )

    const bestEquipStats = calcBestEquipStats(
      updatedSlots,
      updatedEquipment,
      playerData?.stats?.bestEquipStats ?? {}
    )

    save({
      'equip.slots': updatedSlots,
      equipment: updatedEquipment,
      'stats.bestEquipStats': bestEquipStats,
    })
    handleClose()
  }


  return (
    <>
      {/* overlay — tap to close */}
      <div className="eq-card-overlay" onClick={onClose} />

      <div className="eq-card-wrapper" onClick={onClose}>
        {/* the card itself */}
        <div className="monumenta-card" onClick={onClose}>

          {/* icon */}
          <div className="monumenta-card-icon">
            <ItemIcon itemKey={instance.itemKey} />
          </div>

          {/* name — prefix float label only when available */}
          <span className={`monumenta-name ${tierClass}`}>
            {floatLabel ? `${floatLabel} ` : ''}{itemDef.name}
          </span>

          {/* type - base item */}
          <span className="monumenta-info">
            {itemDef.type} - {itemDef.base_item}
          </span>

          {/* stats */}
          <div className="monumenta-card-enchants">
            {stats.map(s => (
              <span key={s.key} className={s.className || 'monumenta-info'}>
                {s.text}
              </span>
            ))}
          </div>

          {/* region + tier */}
          <span>
            <span className="monumenta-info">{itemDef.region} </span>
            <span className={tierClass}>{instance.tier}</span>
          </span>

          {/* location */}
          <span className={locationClass}>{itemDef.location}</span>

          {/* lore */}
          {itemDef.lore && (
            <span className="monumenta-info" style={{ fontStyle: 'italic', marginTop: '4px' }}>
              {itemDef.lore}
            </span>
          )}
        </div>

        {/* pillbox buttons — hidden in readOnly mode */}
        {!readOnly && (
          <div className="eq-card-actions" onClick={e => e.stopPropagation()}>
            <button
              className="eq-action-btn"
              onClick={(e) => { e.stopPropagation(); handleStar() }}
            >
              {instance.starred ? '★ Unstar' : '☆ Star'}
            </button>
            <button
              className="eq-action-btn"
              disabled={validSlots.length === 0}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedSlotIndex(0)
                setMetaView(metaView === 'equip' ? 'info' : 'equip')
              }}
            >
              {instance.equipped ? 'Unequip' : 'Equip'}
            </button>
            <button
              className="eq-action-btn eq-action-btn--danger"
              disabled={instance.starred || instance.equipped}
              onClick={(e) => {
                e.stopPropagation()
                setMetaView(metaView === 'recycle' ? 'info' : 'recycle')
              }}
            >
              Recycle
            </button>
          </div>
        )}

        {/* float + obtained info / collection data */}
        <motion.div
          className="eq-card-meta"
          onClick={e => e.stopPropagation()}
        >
          <AnimatePresence mode="popLayout" initial={false}>

            {/* collection view — shown when readOnly */}
            {readOnly && (
              <motion.div
                key="collection"
                className="eq-card-meta-inner"
                variants={flipVariants}
                animate="enter"
                exit="exit"
              >
                {collectionData ? (
                  <>
                    <span>Found {collectionData.totalFound} time{collectionData.totalFound !== 1 ? 's' : ''}</span>
                    <span>First found {collectionData.firstFoundDate}</span>
                    <span>
                      Best/worst floats: {collectionData.lowestFloat?.toFixed(4)} - {collectionData.highestFloat?.toFixed(4)}
                    </span>
                  </>
                ) : (
                  <span style={{ opacity: 0.5 }}>Not yet discovered</span>
                )}
              </motion.div>
            )}

            {!readOnly && metaView === 'info' && (
              <motion.div
                key="info"
                className="eq-card-meta-inner"
                variants={flipVariants}
                animate="enter"
                exit="exit"
              >
                <span>Float: {instance.float?.toFixed(4)} {floatLabel}</span>
                <span>Obtained {instance.obtainedDate} from {instance.obtainedFrom}</span>
              </motion.div>
            )}
 
            {!readOnly && metaView === 'recycle' && (
              <motion.div
                key="recycle"
                className="eq-card-meta-inner"
                variants={flipVariants}
                animate="enter"
                exit="exit"
              >
                <span>Float: {instance.float?.toFixed(4)} {floatLabel}</span>
                <span>Recycle for <strong>{recyclePrice.toLocaleString()} den pieces</strong>?</span>
                <div className="eq-meta-confirm-btns">
                  <button className="eq-meta-btn eq-meta-btn--cancel" onClick={() => setMetaView('info')}>
                    Cancel
                  </button>
                  <button className="eq-meta-btn eq-meta-btn--confirm" onClick={handleRecycle}>
                    Confirm
                  </button>
                </div>
              </motion.div>
            )}
 
            {!readOnly && metaView === 'equip' && (
              <motion.div
                key="equip"
                className="eq-card-meta-inner"
                variants={flipVariants}
                animate="enter"
                exit="exit"
              >
                {validSlots.length === 0 ? (
                  <span>No valid slots for this item type.</span>
                ) : instance.equipped ? (
                  <>
                    <span>Unequip this item?</span>
                    <div className="eq-meta-confirm-btns">
                      <button className="eq-meta-btn eq-meta-btn--cancel" onClick={() => setMetaView('info')}>
                        Cancel
                      </button>
                      <button className="eq-meta-btn eq-meta-btn--confirm" onClick={handleUnequip}>
                        Unequip
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* slot selector if multiple valid slots */}
                    {validSlots.length > 1 && (
                      <div className="eq-meta-slot-nav">
                        <button
                          className="eq-meta-btn"
                          onClick={() => setSelectedSlotIndex(i => (i - 1 + validSlots.length) % validSlots.length)}
                        >‹</button>
                        <span>{getSlotLabel(targetSlot.type)}</span>
                        <button
                          className="eq-meta-btn"
                          onClick={() => setSelectedSlotIndex(i => (i + 1) % validSlots.length)}
                        >›</button>
                      </div>
                    )}

                    {/* slot comparison: current ← new */}
                    <div className="eq-meta-compare">
                      <div className="eq-meta-compare-slot">
                        {currentlyEquipped
                          ? <ItemIcon itemKey={currentlyEquipped.itemKey} />
                          : <span className="ep-slot-label">{getSlotLabel(targetSlot.type)}</span>
                        }
                      </div>
                      <span className="eq-meta-compare-arrow">←</span>
                      <div className="eq-meta-compare-slot eq-meta-compare-slot--new">
                        <ItemIcon itemKey={instance.itemKey} />
                      </div>
                    </div>

                    {/* current item name if something is equipped */}
                    {currentlyEquipped && currentItemDef && (
                      <span style={{ opacity: 0.6, fontSize: '10px' }}>
                        Replaces {currentItemDef.name}
                      </span>
                    )}

                    <div className="eq-meta-confirm-btns">
                      <button className="eq-meta-btn eq-meta-btn--cancel" onClick={() => setMetaView('info')}>
                        Cancel
                      </button>
                      <button className="eq-meta-btn eq-meta-btn--confirm" onClick={handleEquip}>
                        Equip
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </>
  )
}