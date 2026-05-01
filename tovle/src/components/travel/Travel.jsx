import { useState } from 'react'
import { usePlayer } from '../../context/PlayerContext'
import TravelMap from './TravelMap'
import TravelForum from './TravelForum'
import './Travel.css'

import TownCard from './TownCard'

const Travel = () => {
  const { playerData, save } = usePlayer()

  const [showTree, setShowTree] = useState(false)

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

  return (
    <div className="travel-container">
      {/* <TravelMap /> */}
      <TravelForum playerData={playerData} save={save} />
      {/* <ForumGame /> */}

      <button onClick={handleDebugCurrencies}>Debug: 999 currencies</button>
      <button onClick={handleDebugResetTree}>Debug: Reset tree</button>

      <TownCard townId="alnera" />

    </div>
  )
}

export default Travel