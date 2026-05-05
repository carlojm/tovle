import { useState } from 'react'
import mapImage from '../../assets/map.png'
import './TravelMap.css'
import { usePlayer } from '../../context/PlayerContext'
import { getTownBonus } from '../../utils/townUtils'
import { TOWN_CONFIG } from '../../data/townConfig'

const QUADRANTS = [
  {
    id: 'nw',
    label: 'Northwest',
    towns: ['frostgate', 'steelmeld'],
  },
  {
    id: 'ne',
    label: 'Northeast',
    towns: ['alnera', 'steelmeld'],
  },
  {
    id: 'sw',
    label: 'Southwest',
    towns: ['frostgate', 'mistport'],
  },
  {
    id: 'se',
    label: 'Southeast',
    towns: ['alnera', 'mistport'],
  },
]

const TravelMap = ({ onClose, onBack }) => {
  const [hideBonuses, setHideBonuses] = useState(false)

  const { playerData } = usePlayer()

  const getTownBonusForId = (townId) => {
    const rep = playerData?.travel?.towns?.[townId]?.reputation ?? 0
    return getTownBonus(rep)
  }

  const isTownUnlocked = (townId) => {
    return playerData?.travel?.towns?.[townId]?.unlocked === true
  }

  return (
    <div className="town-backdrop" onClick={onClose}>
      <div className="town-modal" onClick={e => e.stopPropagation()}>

        <div className="town-modal-header">
          <h2>Cache Bonus Map</h2>
          <button className="town-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="town-modal-body">
          <div className="travel-map-image-wrap">
            <img
              className="travel-map-img"
              src={mapImage}
              alt="Celsian Isles map"
            />
            <div className={`travel-map-overlay ${hideBonuses ? 'hide-all' : ''}`}>
              {QUADRANTS.map(q => {
                const visibleTowns = q.towns.filter(townId => isTownUnlocked(townId))
                return (
                  <div key={q.id} className={`travel-map-quadrant ${q.id}`}>
                    <div className="travel-map-tooltip">
                      <span className="travel-map-tooltip-title">{q.label}</span>
                      {visibleTowns.length === 0 ? (
                        <span className="travel-map-town-name">No trade routes active</span>
                      ) : (
                        visibleTowns.map(townId => {
                          const bonus = getTownBonusForId(townId)
                          return (
                            <div key={townId} className="travel-map-bonus-row">
                              <span className="travel-map-town-name">{TOWN_CONFIG[townId].name}</span>
                              <span className="travel-map-bonus-val">+{bonus}% loot</span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* <label className="travel-map-toggle">
            <input
              type="checkbox"
              checked={hideBonuses}
              onChange={e => setHideBonuses(e.target.checked)}
            />
            Hide trade bonuses
          </label> */}

          <p className="travel-map-desc">
            Each town's commerce boosts the treasure found in its corresponding half of the map. Quadrants shared by two towns receive bonuses from both.
          </p>
        </div>

        <div className="town-modal-footer">
          <button className="town-footer-btn" onClick={onBack}>
            ← Back
          </button>
          <button className="town-footer-btn town-footer-btn--primary" onClick={onClose}>
            Close
          </button>
        </div>

      </div>
    </div>
  )
}

export default TravelMap