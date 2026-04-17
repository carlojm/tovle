import { useState } from 'react'
import { Pencil, Check } from 'lucide-react'
import forumIcon from '../../assets/icon_forum.png'
import './TravelForum.css'
import ForumBuildModal from './ForumBuildModal'
import ForumGame from './ForumGame'

// derive tier and stats from xp
// thresholds and values are placeholders — easy to tune later
const FORUM_TIERS = [
  { minXp: 0,    tier: 0, label: 'Tier 0',       tradeQuality: 0,   tradeLuck: 0   },
  { minXp: 100,  tier: 1, label: 'Tier 1',       tradeQuality: 0,   tradeLuck: 0   },
  { minXp: 250,  tier: 2, label: 'Tier 2',       tradeQuality: 10,  tradeLuck: 0   },
  { minXp: 500,  tier: 3, label: 'Tier 3',       tradeQuality: 20,  tradeLuck: 1   },
  { minXp: 900,  tier: 4, label: 'Tier 4',       tradeQuality: 30,  tradeLuck: 1   },
  { minXp: 1400, tier: 5, label: 'Tier 5',       tradeQuality: 50,  tradeLuck: 2   },
]

const getForumTierData = (xp) => {
  const tier = [...FORUM_TIERS].reverse().find(t => xp >= t.minXp)
  return tier ?? FORUM_TIERS[0]
}

const getNextTier = (xp) => {
  return FORUM_TIERS.find(t => t.minXp > xp) ?? null
}

const TravelForum = ({ playerData, save }) => {
  const forum = playerData?.travel?.forum
  const xp = forum?.xp ?? 0
  const savedName = forum?.name ?? 'The Fallen Forum'

  const tierData = getForumTierData(xp)
  const nextTier = getNextTier(xp)

  const [isEditing, setIsEditing] = useState(false)
  const [nameInput, setNameInput] = useState(savedName)
  // const [showModal, setShowModal] = useState(false)
  const [showBuildModal, setShowBuildModal] = useState(false)
  const [gameConfig, setGameConfig] = useState(null)

  const handleSaveName = () => {
    const trimmed = nameInput.trim() || 'The Fallen Forum'
    setNameInput(trimmed)
    setIsEditing(false)
    save({ travel: { ...playerData?.travel, forum: { ...forum, name: trimmed } } })
  }

  const handlePlay = (config) => {
    setShowBuildModal(false)
    setGameConfig(config)

    //remove selected blocks from inv
    const updatedItems = (playerData?.inventory?.items ?? []).map(item => {
      const spent = config.fuel[item.itemId] ?? 0
      return spent > 0 ? { ...item, quantity: item.quantity - spent } : item
    }).filter(item => item.quantity > 0)

    //update inventory and update fuel count
    save({ 
      inventory: {
        ...playerData?.inventory,
        items: updatedItems
      },
      travel: { 
        ...playerData?.travel,
        forum: {
          ...forum,
          fuel: config.totalFuel
        }
      }
    })
  }

  return (
    <>
      <div className="forum-card">

        <div className="forum-header">
          <div className="forum-icon-wrap">
            <img src={forumIcon} alt="Forum" className="forum-icon" />
          </div>

          <div className="forum-header-info">
            <div className="forum-name-row">
              {isEditing ? (
                <>
                  <input
                    className="forum-name-input"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                    autoFocus
                    maxLength={32}
                  />
                  <button className="forum-icon-btn" onClick={handleSaveName}>
                    <Check size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span className="forum-name">{savedName}</span>
                  <button className="forum-icon-btn" onClick={() => { setNameInput(savedName); setIsEditing(true) }}>
                    <Pencil size={14} />
                  </button>
                </>
              )}
              <span className="forum-tier-label">{tierData.label}</span>
            </div>

            {/* xp progress bar */}
            <div className="forum-xp-row">
              <span className="forum-label">XP</span>
              <div className="forum-xp-track">
                <div
                  className="forum-xp-fill"
                  style={{ width: nextTier ? `${Math.min(((xp - tierData.minXp) / (nextTier.minXp - tierData.minXp)) * 100, 100)}%` : '100%' }}
                />
              </div>
              <span className="forum-xp-num">
                {nextTier ? `${xp} / ${nextTier.minXp}` : `${xp} (max)`}
              </span>
            </div>
          </div>
        </div>

        {/* description */}
        {tierData.label === "Tier 0" ? (
          <p className="forum-desc">
            This used to be a nexus of research and trade, and now it's abandoned.
            You could probably fix it up and use it as a new headquarters for your trading empire...
          </p>
        ) :
          <p className="forum-desc">
            Level up the forum to unlock trade with different towns.
            Trading lets you spend items to build reputation.
            In exchange, towns reward you with item shipments you can collect daily.
          </p>
        }
        

        {/* stats */}
        <div className="forum-stats">
          <div className="forum-stat-row">
            <span className="forum-stat-label">Trade tier</span>
            <span className="forum-stat-val">{tierData.label}</span>
          </div>
          {tierData.tradeQuality > 0 && (
            <div className="forum-stat-row">
              <span className="forum-stat-label">Trade quality bonus</span>
              <span className="forum-stat-val">+{tierData.tradeQuality}%</span>
            </div>
          )}
          {tierData.tradeLuck > 0 && (
            <div className="forum-stat-row">
              <span className="forum-stat-label">Trade luck</span>
              <span className="forum-stat-val">+{tierData.tradeLuck}</span>
            </div>
          )}
        </div>

        <button className="forum-upgrade-btn" onClick={() => setShowBuildModal(true)}>
          Rebuild Forum
        </button>

      </div>

      {showBuildModal && (
        <ForumBuildModal 
          playerData={playerData}
          existingFuel={forum?.fuel ?? 0}
          onClose={() => setShowBuildModal(false)}
          onPlay={handlePlay}
        />
      )}
      
      {gameConfig && (
        <div className="forum-game-overlay">
          <div className="forum-game-modal">
            <div className="forum-game-header">
              <span className="forum-game-title">Stats here</span>
              <button className="forum-game-close" onClick={() => setGameConfig(null)}>×</button>
            </div>
            <div className="forum-game-canvas-wrap">
              <ForumGame
                totalFuel={gameConfig.totalFuel}
                itemsPerTap={gameConfig.itemsPerTap}
                anchorChance={gameConfig.anchorChance}
                onGameEnd={(xpEarned, blocksBuilt) => {
                  setGameConfig(null)
                  const fuelUsed = blocksBuilt * gameConfig.itemsPerTap
                  const fuelRemaining = Math.max(0, (forum?.fuel ?? 0) - fuelUsed)
                  save({ 
                    travel: { 
                      ...playerData?.travel,
                      forum: {
                        ...forum,
                        xp: (forum?.xp ?? 0) + xpEarned,
                        fuel: fuelRemaining
                      }
                    }
                  })
                }}
              />
            </div>
          </div>
        </div>
      )}

    </>
  )
}

export default TravelForum