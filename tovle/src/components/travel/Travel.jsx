import { useState } from 'react'
import { usePlayer } from '../../context/PlayerContext'
import TravelMap from './TravelMap'
import TravelForum from './TravelForum'
import './Travel.css'

const Travel = () => {
  const { playerData, save } = usePlayer()

  const [showTree, setShowTree] = useState(false)

  return (
    <div className="travel-container">
      {/* <TravelMap /> */}
      <TravelForum playerData={playerData} save={save} />
      {/* <ForumGame /> */}

    </div>
  )
}

export default Travel