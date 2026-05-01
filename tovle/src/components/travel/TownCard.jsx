// src/components/travel/TownCard.jsx
import { useState } from 'react'
import { usePlayer } from '../../context/PlayerContext'
import { ITEM_MAP } from '../../data/itemMap'
import { TOWN_CONFIG } from '../../data/townConfig'
import './TownCard.css'

import { getTownLevel, getRepForNextLevel } from '../../utils/townUtils'

const TownCard = ({ townId, children }) => {
  const { playerData } = usePlayer()
  const config = TOWN_CONFIG[townId]

  // town data from firestore
  const townData = playerData?.travel?.towns?.[townId] ?? {}
  const reputation = townData.reputation ?? 0
  const townLevel = getTownLevel(reputation)

  // local state
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(false)

  if (!config) return null

  return (
    <div className="town-card">

      <div className="town-header">
        <div className="town-icon-wrap">
          <img src={config.image} alt={config.name} className="town-icon" />
        </div>

        <div className="town-header-info">
          <div className="town-name-row">
            <span className="town-name">{config.name}</span>
            <span className="town-level">level {townLevel}</span>
            <span className="town-coords">x: {config.coordinates.x}, z: {config.coordinates.z}</span>
          </div>
          <p className="town-description">{config.description}</p>
        </div>
      </div>

      {children}
    </div>
  )
}

export default TownCard