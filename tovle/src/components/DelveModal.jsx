import { X, ChevronUp, ChevronDown } from 'lucide-react'
import './DelveModal.css'

const DELVE_MODS = [
  {
    id: 'spectral',
    name: 'Spectral',
    description: 'The image becomes transparent',
    maxLevel: 3,
    pointsPerLevel: 1,
    levels: ['25% transparent', '50% transparent', '75% transparent'],
  },
  {
    id: 'vengeful',
    name: 'Vengeful',
    description: 'A color filter is applied to the image',
    maxLevel: 1,
    pointsPerLevel: 2,
    levels: ['Random color filter applied'],
  },
  {
    id: 'dreadful',
    name: 'Dreadful',
    description: 'A shadow vignette obscures the cache',
    maxLevel: 1,
    pointsPerLevel: 1,
    levels: ['Vignette obscures the cache'],
  },
  {
    id: 'astral',
    name: 'Astral',
    description: 'The image is flipped upside down',
    maxLevel: 1,
    pointsPerLevel: 2,
    levels: ['Image is upside down'],
  },
  {
    id: 'twisted',
    name: 'Twisted',
    description: 'The image colors are inverted',
    maxLevel: 1,
    pointsPerLevel: 2,
    levels: ['Colors inverted'],
  },
  {
    id: 'colossal',
    name: 'Colossal',
    description: 'The image is zoomed in',
    maxLevel: 3,
    pointsPerLevel: 1,
    levels: ['25% zoom', '50% zoom', '75% zoom'],
  },
  {
    id: 'legionary',
    name: 'Legionary',
    description: 'The image is fragmented',
    maxLevel: 1,
    pointsPerLevel: 3,
    levels: ['2x2 fragment'],
  },
]

export const calcTotalPoints = (delvePoints) => {
  return DELVE_MODS.reduce((total, mod) => {
    return total + (delvePoints[mod.id] ?? 0) * mod.pointsPerLevel
  }, 0)
}

const DelveModal = ({ delvePoints, setDelvePoints, onClose, onSaveDefaults }) => {
  const totalPoints = calcTotalPoints(delvePoints)

  const handleIncrement = (mod) => {
    const current = delvePoints[mod.id] ?? 0
    if (current >= mod.maxLevel) return
    setDelvePoints({ ...delvePoints, [mod.id]: current + 1 })
  }

  const handleDecrement = (mod) => {
    const current = delvePoints[mod.id] ?? 0
    if (current <= 0) return
    setDelvePoints({ ...delvePoints, [mod.id]: current - 1 })
  }

  return (
    <div className="delve-backdrop" onClick={onClose}>
      <div className="delve-modal" onClick={e => e.stopPropagation()}>

        <div className="delve-modal-header">
          <div>
            <h2>Delve Modifiers</h2>
            <p className="delve-total-pts">{totalPoints} pts assigned</p>
            <p className="delve-total-pts">WIP: these don't provide bonuses yet but you can try them on</p>
          </div>
          <button className="delve-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="delve-mod-list">
          {DELVE_MODS.map(mod => {
            const current = delvePoints[mod.id] ?? 0
            const isMaxed = current >= mod.maxLevel
            const currentLevelDesc = current > 0 ? mod.levels[current - 1] : null

            return (
              <div key={mod.id} className={`delve-mod-row ${current > 0 ? 'delve-mod-row--active' : ''}`}>
                <div className="delve-mod-info">
                  <span className="delve-mod-name">{mod.name}</span>
                  <span className="delve-mod-desc">
                    {currentLevelDesc ?? mod.description}
                  </span>
                </div>
                <div className="delve-mod-controls">
                  <span className="delve-mod-pts">
                    {current > 0 ? `+${current * mod.pointsPerLevel} pts` : `${mod.pointsPerLevel} pts/lvl`}
                  </span>
                  <button
                    className="delve-level-btn"
                    onClick={() => handleDecrement(mod)}
                    disabled={current <= 0}
                  >
                    <ChevronDown size={16} />
                  </button>
                  <span className="delve-mod-level">
                    {current}/{mod.maxLevel}
                  </span>
                  <button
                    className="delve-level-btn"
                    onClick={() => handleIncrement(mod)}
                    disabled={isMaxed}
                  >
                    <ChevronUp size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="delve-modal-footer">
          <button className="delve-footer-btn" onClick={onSaveDefaults}>
            Save as Default
          </button>
          <button className="delve-footer-btn delve-footer-btn--primary" onClick={onClose}>
            Done ({totalPoints} pts)
          </button>
        </div>

      </div>
    </div>
  )
}

export { DELVE_MODS }
export default DelveModal