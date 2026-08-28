import './DungeonCard.css'
import depthsicon from '../../assets/depthsicon.png'

const DungeonCard = ({ onEnter }) => {
  return (
    <div className="dungeon-card">
      <div className="town-header">
        <div className="town-icon-wrap">
          <img src={depthsicon} alt={'depths icon'} className="town-icon" />
        </div>
        <div className="town-header-info">
          <div className="town-name-row">
            <span className="town-name">Darkest Depths</span>
            <span className="town-level">endless</span>
            <span className="town-coords">x: ???, z: ???</span>
          </div>
          <p className="town-description">
            An endless labyrinth that changes with the tides. All players enter the same dungeon each day. Can you make it the farthest?
          </p>
        </div>
      </div>
      <div className="town-card-actions">
        <button className="town-action-btn town-action-btn--primary" onClick={onEnter}>
          Enter Dungeon
        </button>
      </div>
    </div>
  )
}

export default DungeonCard