import { useState, useEffect } from 'react'
import { usePlayer } from '../../context/PlayerContext'
import { formatCountdown, getSecondsUntilNextTradeWindow } from '../../utils/dates'
import TravelMap from './TravelMap'
import TravelForum from './TravelForum'
import './Travel.css'

import TownCard from './TownCard'

const Travel = () => {
  const { playerData, save } = usePlayer()
  const [showTree, setShowTree] = useState(false)
  const [tradeCountdown, setTradeCountdown] = useState(getSecondsUntilNextTradeWindow())

  useEffect(() => {
    const interval = setInterval(() => {
      setTradeCountdown(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleDebugCurrencies = () => {
    save({
      travel: {
        ...playerData?.travel,
        forum: {
          ...playerData?.travel?.forum,
          currencies: { crystals: 999, shards: 999, hearts: 999 }
        }
      }
    })
  }

  const handleDebugResetTree = () => {
    save({
      travel: {
        ...playerData?.travel,
        forum: {
          ...playerData?.travel?.forum,
          upgrades: {},
          currencies: { crystals: 0, shards: 0, hearts: 0 }
        }
      }
    })
  }

  const handleDebugResetTrades = () => {
    save({
      travel: {
        ...playerData?.travel,
        towns: {
          ...playerData?.travel?.towns,
          alnera: {
            ...playerData?.travel?.towns?.alnera,
            tradeWindow: null
          }
        }
      }
    })
  }

  return (
    <div className="travel-container">

      {/* <TravelMap /> */}
      <TravelForum playerData={playerData} save={save} />
      {/* <ForumGame /> */}

      <button onClick={handleDebugCurrencies}>Debug: 999 currencies</button>
      <button onClick={handleDebugResetTree}>Debug: Reset tree</button>
      <button onClick={handleDebugResetTrades}>Debug: Reset trade window</button>


      <div className="travel-section-header">
        <h2 className="travel-section-title">Towns</h2>
        <span className="travel-section-caption">Trades refresh in {formatCountdown(tradeCountdown)}</span>
      </div>

      <TownCard townId="alnera" />

    </div>
  )
}

export default Travel