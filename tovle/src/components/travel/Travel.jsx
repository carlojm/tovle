import { useState } from 'react'
import { usePlayer } from '../../context/PlayerContext'
import TravelMap from './TravelMap'
import TravelForum from './TravelForum'
import './Travel.css'

import ForumTreeModal from './ForumTreeModal'

import ForumGame from './ForumGame'

const Travel = () => {
  const { playerData, save } = usePlayer()

  const [showTree, setShowTree] = useState(false)

  return (
    <div className="travel-container">
      {/* <TravelMap /> */}
      <TravelForum playerData={playerData} save={save} />
      {/* <ForumGame /> */}

      <button onClick={() => setShowTree(true)}>Upgrades</button>
      {showTree && (
        <ForumTreeModal
          onClose={() => setShowTree(false)}
          upgrades={{}}
          currencies={{ crystals: 100, shards: 5, hearts: 0 }}
        />
      )}
    </div>
  )
}

export default Travel