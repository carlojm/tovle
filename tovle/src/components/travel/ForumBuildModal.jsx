import { useState } from 'react'
import { X, ChevronUp, ChevronDown } from 'lucide-react'
import { ITEM_MAP } from '../../data/itemMap'
import './ForumBuildModal.css'

const FILLER_BLOCKS = [
  { itemId: 'prismarine_block', label: 'Prismarine Block' },
  { itemId: 'prismarine_brick', label: 'Prismarine Bricks' },
  { itemId: 'prismarine_wall',  label: 'Prismarine Wall' },
  { itemId: 'warped_stem',      label: 'Warped Stem' },
  { itemId: 'warped_hyphae',    label: 'Warped Hyphae' },
]

const MIN_ITEMS_PER_TAP = 1
const MAX_ITEMS_PER_TAP = 10
const MAX_FUEL = 100 // increases with forum upgrades later

const ForumBuildModal = ({ playerData, existingFuel, onClose, onPlay }) => {
  console.log("existing:",existingFuel)
  const items = playerData?.inventory?.items ?? []

  const getItemQuantity = (itemId) => {
    return items.find(i => i.itemId === itemId)?.quantity ?? 0
  }

  // fuel: { prismarine_block: 3, warped_hyphae: 5, ... }
  const [fuel, setFuel] = useState(
    //treat existing fuel like its own item in the list
    existingFuel > 0 ? {_existing: existingFuel} : {}
  )
  const [itemsPerTap, setItemsPerTap] = useState(1)

  const totalFuel = Object.values(fuel).reduce((sum, n) => sum + n, 0)
  const fuelRemaining = MAX_FUEL - totalFuel

  const anchorChance = Math.min(0.05 + (itemsPerTap - 1) * 0.035, 0.40)

  const handleAddBlock = (itemId) => {
    if (fuelRemaining <= 0) return
    const owned = getItemQuantity(itemId)
    const alreadyLoaded = fuel[itemId] ?? 0
    const canAdd = Math.min(10, owned - alreadyLoaded, fuelRemaining)
    if (canAdd <= 0) return
    setFuel(prev => ({ ...prev, [itemId]: alreadyLoaded + canAdd }))
  }

  const handleRemoveBlock = (itemId) => {
    const current = fuel[itemId] ?? 0
    if (current <= 0) return
    const toRemove = Math.min(10, current)
    setFuel(prev => ({ ...prev, [itemId]: current - toRemove }))
  }

  const handlePlay = () => {
    if (totalFuel === 0) return
    const {_existing, ...itemFuel} = fuel
    onPlay({ fuel: itemFuel, totalFuel, itemsPerTap, anchorChance })
  }

  return (
    <div className="fbm-backdrop" onClick={onClose}>
      <div className="fbm-modal" onClick={e => e.stopPropagation()}>

        <div className="fbm-header">
          <div>
            <h2>Rebuild the Forum</h2>
            <p className="fbm-subtitle">Load up on building blocks and head into construction.</p>
          </div>
          <button className="fbm-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        

        {/* block buttons */}
        <div className="fbm-blocks-section">
          <span className="fbm-section-label">Tap to turn blocks from your inventory into build material.</span>
          <div className="fbm-block-grid">
            {FILLER_BLOCKS.map(({ itemId, label }) => {
              const owned = getItemQuantity(itemId)
              const loaded = fuel[itemId] ?? 0
              const isEmpty = owned === 0
              const itemDef = ITEM_MAP[itemId]
              return (
                <div
                  key={itemId}
                  className={`fbm-block-btn-wrap ${isEmpty ? 'fbm-block-empty' : ''}`}
                >
                  <button
                    className="fbm-block-btn"
                    onClick={() => handleAddBlock(itemId)}
                    disabled={isEmpty || loaded >= owned || fuelRemaining <= 0}
                    title={label}
                  >
                    {itemDef && (
                      <img
                        src={itemDef.img}
                        alt={label}
                        className="fbm-block-icon"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    )}
                    <span className="fbm-block-count">
                      {loaded > 0 ? `${loaded}/${owned}` : owned}
                    </span>
                  </button>
                  {loaded > 0 && (
                    <button
                      className="fbm-block-remove"
                      onClick={() => handleRemoveBlock(itemId)}
                      title="Remove one"
                    >
                      <ChevronDown size={12} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          <span className="fbm-section-label">Unused building blocks are kept between games.</span>
        </div>


        {/* fuel counter */}
        <div className="fbm-fuel-section">
          <div className="fbm-fuel-row">
            <span className="fbm-fuel-label">Building blocks loaded</span>
            <span className="fbm-fuel-count">{totalFuel} / {MAX_FUEL}</span>
          </div>
          <div className="fbm-fuel-track">
            <div
              className="fbm-fuel-fill"
              style={{ width: `${(totalFuel / MAX_FUEL) * 100}%` }}
            />
          </div>
        </div>


        {/* items per tap */}
        <div className="fbm-setting-section">
          <div className="fbm-setting-row">
            <div className="fbm-setting-info">
              <span className="fbm-setting-label">Blocks per tap</span>
              <span className="fbm-setting-desc">
                More blocks per tap = better luck and score (~{Math.round(anchorChance * 100)}%)
              </span>
            </div>
            <div className="fbm-setting-controls">
              <button
                className="fbm-ctrl-btn"
                onClick={() => setItemsPerTap(p => Math.max(MIN_ITEMS_PER_TAP, p - 1))}
                disabled={itemsPerTap <= MIN_ITEMS_PER_TAP}
              >
                <ChevronDown size={16} />
              </button>
              <span className="fbm-ctrl-val">{itemsPerTap}</span>
              <button
                className="fbm-ctrl-btn"
                onClick={() => setItemsPerTap(p => Math.min(MAX_ITEMS_PER_TAP, p + 1))}
                disabled={itemsPerTap >= MAX_ITEMS_PER_TAP}
              >
                <ChevronUp size={16} />
              </button>
            </div>
          </div>
          <div className="fbm-setting-row fbm-setting-row--muted">
            <span className="fbm-setting-desc">
              Max taps with current building blocks: <strong>{itemsPerTap > 0 ? Math.floor(totalFuel / itemsPerTap) : '—'}</strong>
            </span>
          </div>
        </div>

        <div className="fbm-footer">
          <button className="fbm-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className={`fbm-play-btn ${totalFuel === 0 ? 'fbm-play-btn--disabled' : ''}`}
            onClick={handlePlay}
            disabled={totalFuel === 0}
          >
            Play ({totalFuel} blocks)
          </button>
        </div>

      </div>
    </div>
  )
}

export default ForumBuildModal