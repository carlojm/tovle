import { useState } from 'react'
import { Pencil, Check } from 'lucide-react'
import { ITEM_MAP } from '../../data/itemMap'
import { usePlayer } from '../../context/PlayerContext'
import forumIcon from '../../assets/icon_forum.png'
import './TravelForum.css'

import ForumBuildModal from './ForumBuildModal'
import ForumGame from './ForumGame'
import ForumTreeModal from './ForumTreeModal'
import { computeForumUnlocks } from './forumUnlocks'

import { isMilestoneUnlocked, checkGoal } from '../../utils/forumUtils'
import { FORUM_TIERS, TOWN_UNLOCKS } from '../../data/forumConfig'

import ItemConfetti from '../ItemConfetti'

const TravelForum = () => {
  const { playerData, save } = usePlayer()
  const forum = playerData?.travel?.forum
  const savedName = forum?.name ?? 'The Fallen Forum'

  //tier unlock progress
  // const currentTier = getForumTier(playerData)
  const currentTier = forum?.tier ?? 0
  const currentTierDef = FORUM_TIERS.find(t => t.tier === currentTier) ?? FORUM_TIERS[0]
  const nextTierDef = FORUM_TIERS.find(t => t.tier === currentTier + 1) ?? null
  // console.log(currentTier, nextTierDef)

  //town unlock progress
  // const unlockedTownCount = TOWN_UNLOCKS.filter(t => isMilestoneUnlocked(t, playerData)).length
  // const nextTownUnlock = TOWN_UNLOCKS.find(t => !isMilestoneUnlocked(t, playerData)) ?? null
  const unlockedTownCount = TOWN_UNLOCKS.filter(t => 
    playerData?.travel?.towns?.[t.townId]?.unlocked === true
  ).length
  const nextTownUnlock = TOWN_UNLOCKS.find(t => 
    playerData?.travel?.towns?.[t.townId]?.unlocked !== true
  ) ?? null

  const [showConfetti, setShowConfetti] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [nameInput, setNameInput] = useState(savedName)
  // const [showModal, setShowModal] = useState(false)
  const [showBuildModal, setShowBuildModal] = useState(false)
  const [gameConfig, setGameConfig] = useState(null)
  const [showTreeModal, setShowTreeModal] = useState(false)

  //skill tree values to pass into the game
  const upgrades = forum?.upgrades ?? {}
  const forumUnlocks = computeForumUnlocks(upgrades)

  const handleSaveName = () => {
    const trimmed = nameInput.trim() || 'The Fallen Forum'
    setNameInput(trimmed)
    setIsEditing(false)
    save({ travel: { ...playerData?.travel, forum: { ...forum, name: trimmed } } })
  }

  const handlePlay = (config) => {
    setShowBuildModal(false)

    // gameConfig.totalFuel is the single source of truth for the session
    setGameConfig({ ...config })

    //remove selected blocks from inv
    const updatedItems = (playerData?.inventory?.items ?? []).map(item => {
      const spent = config.fuel[item.itemId] ?? 0
      return spent > 0 ? { ...item, quantity: item.quantity - spent } : item
    }).filter(item => item.quantity > 0)

    //save inventory and raw fuel to firestore
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

  const handleClaimTier = () => {
    if (!nextTierDef) return
    if (!isMilestoneUnlocked(nextTierDef, playerData)) return

    save({
      travel: {
        ...playerData?.travel,
        forum: {
          ...forum,
          tier: (forum?.tier ?? 0) + 1
        }
      }
    })
    setShowConfetti(true)
  }

  const handleUnlockTown = (townId) => {
    const unlock = TOWN_UNLOCKS.find(t => t.townId === townId)
    if (!unlock || !isMilestoneUnlocked(unlock, playerData)) return

    save({
      travel: {
        ...playerData?.travel,
        towns: {
          ...(playerData?.travel?.towns ?? {}),
          [townId]: {
            ...(playerData?.travel?.towns?.[townId] ?? {}),
            unlocked: true
          }
        }
      }
    })
    setShowConfetti(true)
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
              <span className="forum-tier-label">Tier {currentTier}</span>
            </div>

            {/* currencies */}
            <div className="forum-currencies-row">
              <span className="forum-currency forum-currency--crystal">
                <img src={ITEM_MAP.prismarine_crystals.img} className="forum-currency-icon" />
                {forum?.currencies?.crystals ?? 0}
              </span>
              <span className="forum-currency forum-currency--shard">
                <img src={ITEM_MAP.prismarine_shard.img} className="forum-currency-icon" />
                {forum?.currencies?.shards ?? 0}
              </span>
              <span className="forum-currency forum-currency--heart">
                <img src={ITEM_MAP.heart_of_the_sea.img} className="forum-currency-icon" />
                {forum?.currencies?.hearts ?? 0}
              </span>
            </div>

          </div>
        </div>

        {/* description */}
        {/* {currentTier === 0 ? (
          <p className="forum-desc">
            This used to be a nexus of research and trade, and now it's abandoned.
            You could probably fix it up and use it as a new headquarters for your trading empire...
          </p>
        ) : (
          <p className="forum-desc">
            Level up the forum to unlock trade with different towns.
            Trading lets you spend items to build reputation.
            In exchange, towns reward you with item shipments you can collect daily.
          </p>
        )} */}

        <p className="forum-desc">
          {currentTierDef.description}
        </p>

        {/* stats */}
        {/* forum tier progress */}
        {nextTierDef && (
          <div className="forum-stats">
            <div className="forum-milestone-header">
              <span className="forum-milestone-title">Forum Tier {currentTier + 1} Goals</span>
              <span className="forum-milestone-progress">Tier {currentTier} → {currentTier + 1}</span>
            </div>

            <p className="forum-milestone-subheader">Required goals:</p>

            {nextTierDef.required.map((goal, i) => {
              const result = checkGoal(goal, playerData)
              return (
                <div key={i} className={`forum-milestone-goal ${result.met ? 'forum-milestone-goal--met' : ''}`}>
                  <span className="forum-milestone-dot">{result.met ? '●' : '○'}</span>
                  <span className="forum-milestone-label">{goal.label}</span>
                  <span className="forum-milestone-val">{result.current} / {result.target}</span>
                </div>
              )
            })}

            {nextTierDef.optional.length > 0 && (
              <>
                <p className="forum-milestone-subheader-optional">
                  Optional goals: {nextTierDef.optional.filter(g => checkGoal(g, playerData).met).length} / {nextTierDef.minOptional} needed
                </p>
                {nextTierDef.optional.map((goal, i) => {
                  const result = checkGoal(goal, playerData)
                  return (
                    <div key={i} className={`forum-milestone-goal ${result.met ? 'forum-milestone-goal--met' : ''}`}>
                      <span className="forum-milestone-dot">{result.met ? '●' : '○'}</span>
                      <span className="forum-milestone-label">{goal.label}</span>
                      <span className="forum-milestone-val">{result.current} / {result.target}</span>
                    </div>
                  )
                })}
              </>
            )}

            {/* next tier unlock button */}
            {isMilestoneUnlocked(nextTierDef, playerData) && (
              <button
                className="forum-upgrade-btn"
                onClick={handleClaimTier}
                style={{ marginTop: 8 }}
              >
                Upgrade to Tier {currentTier + 1}
              </button>
            )}
          </div>
        )}

        {/* trade route progress */}
        {nextTownUnlock && (
          <div className="forum-stats">
            <div className="forum-milestone-header">
              <span className="forum-milestone-title">Open {nextTownUnlock.label} Trade Route</span>
              <span className="forum-milestone-progress">{unlockedTownCount} / {TOWN_UNLOCKS.length} trade routes</span>
            </div>

            <p className="forum-milestone-subheader">Required goals:</p>
            {nextTownUnlock.required.map((goal, i) => {
              const result = checkGoal(goal, playerData)
              return (
                <div key={i} className={`forum-milestone-goal ${result.met ? 'forum-milestone-goal--met' : ''}`}>
                  <span className="forum-milestone-dot">{result.met ? '●' : '○'}</span>
                  <span className="forum-milestone-label">{goal.label}</span>
                  <span className="forum-milestone-val">{result.current} / {result.target}</span>
                </div>
              )
            })}

            {nextTownUnlock.optional.length > 0 && (
              <>
                <p className="forum-milestone-subheader-optional">
                  Optional goals: {nextTownUnlock.optional.filter(g => checkGoal(g, playerData).met).length} / {nextTownUnlock.minOptional} needed
                </p>
                {nextTownUnlock.optional.map((goal, i) => {
                  const result = checkGoal(goal, playerData)
                  return (
                    <div key={i} className={`forum-milestone-goal ${result.met ? 'forum-milestone-goal--met' : ''}`}>
                      <span className="forum-milestone-dot">{result.met ? '●' : '○'}</span>
                      <span className="forum-milestone-label">{goal.label}</span>
                      <span className="forum-milestone-val">{result.current} / {result.target}</span>
                    </div>
                  )
                })}
              </>
            )}

            {isMilestoneUnlocked(nextTownUnlock, playerData) && (
              <button
                className="forum-upgrade-btn golden"
                onClick={() => handleUnlockTown(nextTownUnlock.townId)}
                style={{ marginTop: 8 }}
              >
                Open Trade with {nextTownUnlock.label}
              </button>
            )}
          </div>
        )}

        <button className="forum-upgrade-btn" onClick={() => setShowBuildModal(true)}>
          Rebuild Forum
        </button>

        <button className="forum-upgrade-btn" onClick={() => setShowTreeModal(true)}>
          Upgrade Tree
        </button>

      </div>

      {showBuildModal && (
        <ForumBuildModal 
          playerData={playerData}
          existingFuel={forum?.fuel ?? 0}
          onClose={() => setShowBuildModal(false)}
          onPlay={handlePlay}
          fuelCapacity={forumUnlocks.fuelCapacity}
          maxBlocksPerTap={forumUnlocks.maxBlocksPerTap}
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
                onGameEnd={(currency, blocksBuilt) => {
                  setGameConfig(null)
                  const fuelUsed = blocksBuilt * gameConfig.itemsPerTap
                  const fuelRemaining = Math.max(0, Math.round((gameConfig.totalFuel - fuelUsed) * 10) / 10)
                  const currentCurrencies = forum?.currencies ?? { crystals: 0, shards: 0, hearts: 0 }
                  const { crystals, featCrystals, shards, featShards, anchors, perfects, crits } = currency

                  //update besttowerheight if this run beats the record
                  const currentBest = playerData?.stats.bestTowerHeight ?? 0
                  const newBest = Math.max(currentBest, blocksBuilt)

                  save({ 
                    travel: { 
                      ...playerData?.travel,
                      forum: {
                        ...forum,
                        fuel: fuelRemaining,
                        currencies: {
                          ...currentCurrencies,
                          crystals: Math.round(((currentCurrencies.crystals ?? 0) + crystals + featCrystals) * 10) / 10,
                          shards: Math.round(((currentCurrencies.shards ?? 0) + shards + featShards) * 10) / 10,
                        }
                      }
                    },
                    stats: {
                      ...playerData?.stats,
                      bestTowerHeight: newBest,
                      totalTowerBlocks: (playerData?.stats?.totalTowerBlocks ?? 0) + blocksBuilt,
                      totalForumRuns: (playerData?.stats?.totalForumRuns ?? 0) + 1,
                      totalCrystalsEarned: Math.round(((playerData?.stats?.totalCrystalsEarned ?? 0) + crystals + featCrystals) * 10) / 10,
                      totalShardsEarned: Math.round(((playerData?.stats?.totalShardsEarned ?? 0) + shards + featShards) * 10) / 10,
                      totalAnchors: (playerData?.stats?.totalAnchors ?? 0) + anchors,
                      totalPerfects: (playerData?.stats?.totalPerfects ?? 0) + perfects,
                      totalCrits: (playerData?.stats?.totalCrits ?? 0) + crits,
                    }
                  })
                }}
                speedExponent={forumUnlocks.speedExponent}
                perfectPlacementUnlocked={forumUnlocks.perfectPlacementUnlocked}
                perfectThreshold={forumUnlocks.perfectThreshold}
                startingWidth={forumUnlocks.startingWidth}
                crystalMultiplier={forumUnlocks.crystalMultiplier}
                anchorUnlocked={forumUnlocks.anchorUnlocked}
                reviveUnlocked={forumUnlocks.reviveUnlocked}
                perfectAnchorUnlocked={forumUnlocks.perfectAnchorUnlocked}
                perfectAnchorChance={forumUnlocks.perfectAnchorChance}
                perfectAnchorGrowthFactor={forumUnlocks.perfectAnchorGrowthFactor}
                activeCrystalGain={forumUnlocks.activeCrystalGain}
                activeShardGain={forumUnlocks.activeShardGain}
                shardPassiveGain={forumUnlocks.shardPassiveGain}
                bubblesUnlocked={forumUnlocks.bubblesUnlocked}
                bubbleChance={forumUnlocks.bubbleChance}
                bubbleAmount={forumUnlocks.bubbleAmount}
                critChainChance={forumUnlocks.critChainChance}
                critAnchorUnlocked={forumUnlocks.critAnchorUnlocked}
                critAnchorChance={forumUnlocks.critAnchorChance}
                critAnchorGrowth={forumUnlocks.critAnchorGrowth}
              />
            </div>
          </div>
        </div>
      )}

      {showTreeModal && (
        <ForumTreeModal
          onClose={() => setShowTreeModal(false)}
          upgrades={forum?.upgrades ?? {}}
          currencies={forum?.currencies ?? { crystals: 0, shards: 0, hearts: 0 }}
          save={save}
          playerData={playerData}
        />
      )}


      {showConfetti && (
        <ItemConfetti onComplete={() => setShowConfetti(false)} />
      )}
    </>
  )
}

export default TravelForum