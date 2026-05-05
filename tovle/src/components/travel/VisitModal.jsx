import { TOWN_CONFIG } from '../../data/townConfig'
import './VisitModal.css'

const VisitModal = ({ townId, onClose, onViewMap }) => {
  const config = TOWN_CONFIG[townId]
  if (!config) return null

  return (
    <div className="visit-backdrop" onClick={onClose}>
      <div className="visit-modal" onClick={e => e.stopPropagation()}>

        {/* banner */}
        <div className="visit-banner" style={{ background: config.bannerGradient }}>
          <button className="visit-close-btn" onClick={onClose}>×</button>
          <div className="visit-banner-text">
            <h2 className="visit-town-name">{config.name}</h2>
            <p className="visit-town-coords">x: {config.coordinates.x}, z: {config.coordinates.z}</p>
          </div>
        </div>

        {/* body */}
        <div className="visit-body">

          {/* description */}
          <p className="visit-description">{config.description}</p>

          {/* npc cards */}
          {config.npcs?.map(npc => (
            <div key={npc.id} className="visit-npc-card">
              <div className="visit-npc-header">
                <span className="visit-npc-name">{npc.name}</span>
                <span className="visit-npc-title">{npc.title}</span>
              </div>
              <p className="visit-npc-desc">{npc.description}</p>
              <div className="visit-npc-actions">
                {npc.actions.map(action => (
                  <button
                    key={action.id}
                    className="visit-npc-btn"
                    onClick={() => {
                      if (action.id === 'view_map') onViewMap()
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

        </div>

      </div>
    </div>
  )
}

export default VisitModal