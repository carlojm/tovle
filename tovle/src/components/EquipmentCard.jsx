import ItemIcon from './ItemIcon'
import islesItems from '../data/islesItems.json'
import { formatStats } from '../utils/statFormatter'
import './EquipmentCard.css'

function locationToClass(location) {
  if (!location) return ''
  return 'monumenta-' + location.toLowerCase().replaceAll(' ', '-')
}

function tierToClass(tier) {
  if (!tier) return ''
  return 'monumenta-' + tier.toLowerCase().replaceAll(' ', '-')
}

export default function EquipmentCard({ instance, onClose, onStar, onEquip, onRecycle }) {
  if (!instance) return null
  const itemDef = islesItems[instance.itemKey]
  if (!itemDef) return null

  const stats = formatStats(itemDef.stats)
  const tierClass = tierToClass(instance.tier)
  const locationClass = locationToClass(itemDef.location)

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
            {itemDef.name}
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
            onClick={(e) => { e.stopPropagation(); onStar(instance) }}
          >
            {instance.starred ? '★ Unstar' : '☆ Star'}
          </button>
          <button
            className="eq-action-btn"
            onClick={() => { onEquip(instance); onClose() }}
            disabled
          >
            Equip
          </button>
          <button
            className="eq-action-btn eq-action-btn--danger"
            onClick={() => { onRecycle(instance); onClose() }}
            disabled
          >
            Recycle
          </button>
        </div>

        {/* float + obtained info */}
        <div className="eq-card-meta">
          <span>Float: {instance.float?.toFixed(4)}</span>
          <span>Obtained {instance.obtainedDate} from {instance.obtainedFrom}</span>
        </div>
      </div>
    </>
  )
}