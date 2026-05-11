import { useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { motion, AnimatePresence } from 'framer-motion'

import ItemIcon from './ItemIcon'
import islesItems from '../data/islesItems.json'
import { formatStats } from '../utils/statFormatter'
import './EquipmentCard.css'

import { calcRecyclePrice, getFloatLabel } from '../utils/recycleUtils'

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

export default function EquipmentCard({ instance, onClose }) {
  const { playerData, uid, save } = usePlayer()
  const [metaView, setMetaView] = useState('info') // 'info' | 'recycle' | 'equip'

  if (!instance) return null
  const itemDef = islesItems[instance.itemKey]
  if (!itemDef) return null

  const stats = formatStats(itemDef.stats)
  const tierClass = tierToClass(instance.tier)
  const locationClass = locationToClass(itemDef.location)

  const recyclePrice = calcRecyclePrice(instance.tier, instance.float)
  const floatLabel = getFloatLabel(instance.float)
 
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
        inventory: {
          ...playerData.inventory,
          currencies: {
            ...playerData.inventory?.currencies,
            denPieces: currentDen + data.payout,
          }
        }
      })

      handleClose()
    } catch (err) {
      console.error('Recycle error:', err)
    }
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

          {/* name */}
          <span className={`monumenta-name ${tierClass}`}>
            {floatLabel} {itemDef.name}
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

        {/* pillbox buttons */}
        <div className="eq-card-actions" onClick={e => e.stopPropagation()}>
          <button
            className="eq-action-btn"
            onClick={(e) => { e.stopPropagation(); handleStar() }}
          >
            {instance.starred ? '★ Unstar' : '☆ Star'}
          </button>
          <button
            className="eq-action-btn"
            onClick={() => {
              setMetaView('equip')
            }}
            disabled
          >
            Equip
          </button>
          <button
            className="eq-action-btn eq-action-btn--danger"
            disabled={instance.starred}
            onClick={(e) => {
              e.stopPropagation()
              setMetaView(metaView === 'recycle' ? 'info' : 'recycle')
            }}
          >
            Recycle
          </button>
        </div>

        {/* float + obtained info */}
        <motion.div
          className="eq-card-meta"
          onClick={e => e.stopPropagation()}
          layout
        >
          <AnimatePresence mode="wait" initial={false}>
            {metaView === 'info' && (
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
 
            {metaView === 'recycle' && (
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
 
            {metaView === 'equip' && (
              <motion.div
                key="equip"
                className="eq-card-meta-inner"
                variants={flipVariants}
                animate="enter"
                exit="exit"
              >
                {/* placeholder — equip UI goes here */}
                <span>Equip coming soon</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </>
  )
}