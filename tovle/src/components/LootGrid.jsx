import { useState } from 'react'
import { ITEM_MAP } from '../data/itemMap'
import './LootGrid.css'

const ICON_SIZE = 20

const LootGrid = ({ grid, isInventory = false }) => {
  const [tooltip, setTooltip] = useState(null)

  const slots = isInventory
    ? (() => {
        const g = Array(27).fill(null)
        grid.slice(0, 27).forEach((item, i) => { g[i] = item })
        return g
      })()
    : grid

  const handleMouseEnter = (e, slot) => {
    if (!slot) return
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({
      text: slot.name,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    })
  }

  const handleMouseLeave = () => setTooltip(null)

  return (
    <>
      <div className="loot-grid">
        {slots.map((slot, i) => {
          const itemDef = slot ? ITEM_MAP[slot.itemId] : null
          const IconComponent = itemDef?.icon ?? null

          return (
            <div
              key={i}
              className={`loot-slot ${slot ? 'loot-slot--filled' : ''}`}
              onMouseEnter={slot ? (e) => handleMouseEnter(e, slot) : undefined}
              onMouseLeave={slot ? handleMouseLeave : undefined}
            >
              {slot && IconComponent && (
                <>
                  <IconComponent
                    size={ICON_SIZE}
                    color={itemDef.color}
                    strokeWidth={1.5}
                  />
                  {slot.quantity > 1 && (
                    <span className="loot-slot-quantity">{slot.quantity}</span>
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
    </>
  )
}

export default LootGrid