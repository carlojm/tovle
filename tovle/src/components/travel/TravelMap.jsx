import { useState } from 'react'
import mapImage from '../../assets/map.png'
import './TravelMap.css'

const QUADRANTS = [
  {
    id: 'nw',
    label: 'Northwest',
    towns: [
      { name: 'Frostgate', bonus: '+50% loot' },
      { name: 'Steelmeld', bonus: '+30% loot' },
    ],
  },
  {
    id: 'ne',
    label: 'Northeast',
    towns: [
      { name: 'Alnera',    bonus: '+100% loot' },
      { name: 'Steelmeld', bonus: '+30% loot' },
    ],
  },
  {
    id: 'sw',
    label: 'Southwest',
    towns: [
      { name: 'Frostgate', bonus: '+50% loot' },
      { name: 'Mistport',  bonus: '+50% loot' },
    ],
  },
  {
    id: 'se',
    label: 'Southeast',
    towns: [
      { name: 'Alnera',   bonus: '+100% loot' },
      { name: 'Mistport', bonus: '+50% loot' },
    ],
  },
]

const TravelMap = () => {
  const [hideBonuses, setHideBonuses] = useState(false)
  return (
    <div className="travel-map-wrap">
      <h2>Trade Routes</h2>
      <div className="travel-map-image-wrap">
        <img
          className="travel-map-img"
          src={mapImage}
          alt="Celsian Isles map"
        />
        <div className={`travel-map-overlay ${hideBonuses ? 'hide-all' : ''}`}>
          {QUADRANTS.map(q => (
            <div key={q.id} className={`travel-map-quadrant ${q.id}`}>
              <div className="travel-map-tooltip">
                <span className="travel-map-tooltip-title">{q.label}</span>
                {q.towns.map(t => (
                  <div key={t.name} className="travel-map-bonus-row">
                    <span className="travel-map-town-name">{t.name}</span>
                    <span className="travel-map-bonus-val">{t.bonus}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <label className="travel-map-toggle">
        <input
          type="checkbox"
          checked={hideBonuses}
          onChange={e => setHideBonuses(e.target.checked)}
        />
        Hide trade bonuses
      </label>
    </div>
  )
}

export default TravelMap