import { usePlayer } from '../../context/PlayerContext'
import TravelMap from './TravelMap'
import TravelForum from './TravelForum'
import './Travel.css'

const Travel = () => {
  const { playerData, save } = usePlayer()

  return (
    <div className="travel-container">
      <TravelMap />
      <TravelForum playerData={playerData} save={save} />
    </div>
  )
}

export default Travel