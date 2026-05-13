import { useState, useRef } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { ITEM_MAP } from '../data/itemMap'
import { PencilLine, ChevronsUp } from 'lucide-react'
import './Axolotl.css'
import axolotlImg from '../assets/axolotl.png'
import axolotlGoldImg from '../assets/axolotl_gold.png'
import axolotlCyanImg from '../assets/axolotl_cyan.png'
import axolotlBrownImg from '../assets/axolotl_brown.png'


const FISH_POOL = [
  'viridian_cod',
  'brown_carp',
  'sandy_salmon',
  'tundra_trout',
  'coffee_catfish',
  'rosefish',
  'tropical_fish',
  'arcane_fish',
]
const COMMON_FISH = FISH_POOL.slice(0, 4)

const MAX_HUNGER = 10

const Axolotl = ({scheduleSave, flushSave, disableButtons}) => {
  const { uid, playerData, save } = usePlayer()
  const axolotls = playerData?.axolotls ?? []
  const items = playerData?.inventory?.items ?? []
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [hoveredFish, setHoveredFish] = useState(null)
  const [pendingCollectId, setPendingCollectId] = useState(null)

  const autoFeedUnlocked = (playerData?.travel?.forum?.upgrades?.auto_feed ?? 0) >= 1
  const [autoFeedDropdowns, setAutoFeedDropdowns] = useState({})
  const autoFeedDropdownRefs = useRef({})


  const axolotlImages = [axolotlImg, axolotlGoldImg, axolotlBrownImg, axolotlCyanImg]

  if (axolotls.length === 0) return null

  const getItemQuantity = (itemId) => {
    const found = items.find(i => i.itemId === itemId)
    return found?.quantity ?? 0
  }

  const getTodayStr = () =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const canCollect = (axolotl) => {
    return axolotl.hunger >= Math.min(axolotl.level, MAX_HUNGER) && axolotl.lastCollected !== getTodayStr()
  }

  const handleRename = (axolotl) => {
    setEditingId(axolotl.id)
    setEditingName(axolotl.name)
  }

  const handleRenameSubmit = (axolotl) => {
    if (!editingName.trim()) return

    //first, flush debounce to prevent desync
    flushSave()

    const updatedAxolotls = axolotls.map(a =>
      a.id === axolotl.id ? { ...a, name: editingName.trim() } : a
    )
    save({ axolotls: updatedAxolotls })
    setEditingId(null)
  }

  const handleFeed = (axolotl, fish) => {
    if (disableButtons) return //safeguard
    const have = getItemQuantity(fish)
    if (have <= 0) return

    //update the axolotl's eaten fish counts
    const updatedFishEaten = {
      ...axolotl.fishEaten,
      [fish]: (axolotl.fishEaten?.[fish] ?? 0) + 1,
    }

    //update inventory's item count
    const updatedItems = items.map(item =>
      item.itemId === fish
        ? {...item, quantity: item.quantity-1}
        : item
    ).filter(item => item.quantity > 0)

    //update axolotl's hunger
    const updatedAxolotls = axolotls.map(a =>
      a.id === axolotl.id
        ? {...a, hunger: Math.min(a.hunger + 1, MAX_HUNGER), fishEaten: updatedFishEaten}
        : a
    )

    //local state updates immediately
    save({
      axolotls: updatedAxolotls,
      'inventory.items': updatedItems,
    }, {localOnly: true})

    //"debounce" (delay) firestore write to save on database writing a little bit
    scheduleSave({
      axolotls: updatedAxolotls,
      'inventory.items': updatedItems,
    })
  }

  const handleCollect = (axolotl) => {
    if (disableButtons) return //safeguard
    if (!canCollect(axolotl)) return
    // const count = axolotl.level === 1 ? 1 : Math.floor(Math.random() * axolotl.level) + 1
    const count = 1
    const score = axolotl.level * 50
    const todayStr = getTodayStr()

    //first, flush debounce to prevent desync
    flushSave()
    
    const newCaches = Array.from({length: count}, (_, i) => ({
      cacheId: `axolotl_${axolotl.id}_${todayStr}_${i}`,
      date: todayStr,
      guessCount: 0,
      score, //base score
      source: 'axolotl',
      axolotlName: axolotl.name
    }))

    const existingUnopenedCaches = playerData.inventory?.unopenedCaches ?? []
    //subtract the axolotl's level from hunger, not just how many caches it opened
    const updatedAxolotls = axolotls.map(a =>
      a.id === axolotl.id
        ? {...a, hunger: Math.max(0, a.hunger - axolotl.level), lastCollected: todayStr, lastCollectedCount: count}
        : a
    )

    save({
      axolotls: updatedAxolotls,
      'inventory.unopenedCaches': [...existingUnopenedCaches, ...newCaches],
    })
  }

  const canLevelUp = (axolotl) => {
    const nextLevel = axolotl.level + 1
    const requirements = axolotl.levelRequirements?.[nextLevel]
    if (!requirements) return false
    return requirements.every(req =>
      (axolotl.fishEaten?.[req.fish] ?? 0) >= req.quantity
    )
  }

  const handleLevelUp = async (axolotl) => {
    if (!canLevelUp(axolotl)) return
    const nextLevel = axolotl.level + 1
    const requirements = axolotl.levelRequirements?.[nextLevel] ?? []

    //first, flush debounce to prevent desync
    flushSave()

    try {
      const res = await fetch('/api/level-axolotl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, axolotlId: axolotl.id })
      })
      const data = await res.json()
      if (!res.ok) { console.error(data.error); return }

      //subtract required fish and keep the rest
      const updatedFishEaten = { ...axolotl.fishEaten }
      for (const req of requirements) {
        updatedFishEaten[req.fish] = Math.max(0, (updatedFishEaten[req.fish] ?? 0) - req.quantity)
      }
      //delete zero entries to clean up
      for (const fish of Object.keys(updatedFishEaten)) {
        if (updatedFishEaten[fish] === 0) delete updatedFishEaten[fish]
      }

      const updatedAxolotls = axolotls.map(a => {
        if (a.id !== axolotl.id) return a
        return {
          ...a,
          level: nextLevel,
          fishEaten: updatedFishEaten,
          levelRequirements: {
            ...a.levelRequirements,
            [nextLevel + 1]: data.requirements,
          }
        }
      })

      save({ axolotls: updatedAxolotls })
    } catch (err) {
      console.error('Failed to level up axolotl:', err)
    }
  }

  const toggleAutoFeedDropdown = (id) => {
    setAutoFeedDropdowns(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleAutoFeedLevelUp = (axolotl) => {
    if (disableButtons) return
    flushSave()

    const nextLevel = axolotl.level + 1
    const requirements = axolotl.levelRequirements?.[nextLevel] ?? []
    if (requirements.length === 0) return

    let updatedFishEaten = { ...axolotl.fishEaten }
    let updatedItems = [...items]
    let hungerGained = 0

    for (const req of requirements) {
      const eaten = axolotl.fishEaten?.[req.fish] ?? 0
      const stillNeeded = req.quantity - eaten
      if (stillNeeded <= 0) continue

      const itemIdx = updatedItems.findIndex(i => i.itemId === req.fish)
      if (itemIdx === -1) continue

      const canFeed = Math.min(updatedItems[itemIdx].quantity, stillNeeded)
      if (canFeed <= 0) continue

      updatedFishEaten[req.fish] = eaten + canFeed
      updatedItems[itemIdx] = { ...updatedItems[itemIdx], quantity: updatedItems[itemIdx].quantity - canFeed }
      hungerGained += canFeed
    }

    updatedItems = updatedItems.filter(i => i.quantity > 0)

    const updatedAxolotls = axolotls.map(a =>
      a.id === axolotl.id
        ? { ...a, hunger: Math.min(a.hunger + hungerGained, MAX_HUNGER), fishEaten: updatedFishEaten }
        : a
    )

    save({ axolotls: updatedAxolotls, 'inventory.items': updatedItems })
    setAutoFeedDropdowns(prev => ({ ...prev, [axolotl.id]: false }))
  }

  const handleAutoFeedFillHunger = (axolotl) => {
    if (disableButtons) return
    flushSave()

    const hungerNeeded = MAX_HUNGER - axolotl.hunger
    if (hungerNeeded <= 0) return

    const nextLevel = axolotl.level + 1
    const requirements = axolotl.levelRequirements?.[nextLevel] ?? []
    const wantedFish = requirements.map(r => r.fish)

    // build feedable fish list: wanted first, then rest by quantity descending
    const availableFish = COMMON_FISH
      .map(fish => ({ fish, quantity: items.find(i => i.itemId === fish)?.quantity ?? 0 }))
      .filter(f => f.quantity > 0)
      .sort((a, b) => {
        const aWanted = wantedFish.includes(a.fish)
        const bWanted = wantedFish.includes(b.fish)
        if (aWanted !== bWanted) return aWanted ? -1 : 1
        return b.quantity - a.quantity
      })

    if (availableFish.length === 0) return

    // distribute hunger slots proportionally across available fish
    const total = availableFish.reduce((sum, f) => sum + f.quantity, 0)
    let remaining = hungerNeeded
    const toFeed = []

    availableFish.forEach((f, i) => {
      if (remaining <= 0) { toFeed.push({ ...f, feed: 0 }); return }
      const isLast = i === availableFish.length - 1
      const share = isLast
        ? remaining
        : Math.round((f.quantity / total) * hungerNeeded)
      const feed = Math.min(share, f.quantity, remaining)
      toFeed.push({ ...f, feed })
      remaining -= feed
    })

    let updatedItems = [...items]
    let updatedFishEaten = { ...axolotl.fishEaten }

    for (const { fish, feed } of toFeed) {
      if (feed <= 0) continue
      updatedFishEaten[fish] = (updatedFishEaten[fish] ?? 0) + feed
      const itemIdx = updatedItems.findIndex(i => i.itemId === fish)
      if (itemIdx !== -1) {
        updatedItems[itemIdx] = { ...updatedItems[itemIdx], quantity: updatedItems[itemIdx].quantity - feed }
      }
    }

    updatedItems = updatedItems.filter(i => i.quantity > 0)

    const updatedAxolotls = axolotls.map(a =>
      a.id === axolotl.id
        ? { ...a, hunger: Math.min(a.hunger + hungerNeeded, MAX_HUNGER), fishEaten: updatedFishEaten }
        : a
    )

    save({ axolotls: updatedAxolotls, 'inventory.items': updatedItems })
    setAutoFeedDropdowns(prev => ({ ...prev, [axolotl.id]: false }))
  }

  const canAutoFeedLevelUp = (axolotl) => {
    const nextLevel = axolotl.level + 1
    const requirements = axolotl.levelRequirements?.[nextLevel] ?? []
    if (requirements.length === 0) return false
    return requirements.some(req => {
      const eaten = axolotl.fishEaten?.[req.fish] ?? 0
      const stillNeeded = req.quantity - eaten
      if (stillNeeded <= 0) return false
      return (items.find(i => i.itemId === req.fish)?.quantity ?? 0) > 0
    })
  }

  const canAutoFeedFill = (axolotl) => {
    if (axolotl.hunger >= MAX_HUNGER) return false
    return COMMON_FISH.some(fish => (items.find(i => i.itemId === fish)?.quantity ?? 0) > 0)
  }

  return (
    <div className="axolotl-container" onTouchEnd={()=> setHoveredFish(null)}>
      {axolotls.map((axolotl, index) => {
        const avatarImg = axolotlImages[index % axolotlImages.length]
        const nextLevel = axolotl.level + 1
        const requirements = axolotl.levelRequirements?.[nextLevel] ?? []
        const levelUpReady = canLevelUp(axolotl)
        // const available = cachesAvailable(axolotl)
        const alreadyCollected = axolotl.lastCollected === getTodayStr()

        return (
          <div key={axolotl.id} className="axolotl-card">

            {/* header */}
            <div className="axolotl-header">
              <img src={avatarImg} alt="axolotl" className="axolotl-img" />
              <div className="axolotl-header-info">

                {/* name row */}
                <div className="axolotl-name-row">
                  {editingId === axolotl.id ? (
                    <input 
                      className="axolotl-name-input"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value.slice(0,20))}
                      onBlur={() => handleRenameSubmit(axolotl)}
                      onKeyDown={e => e.key === 'Enter' && handleRenameSubmit(axolotl)}
                      autoFocus
                    />
                  ) : (
                    <span className="axolotl-name">{axolotl.name}</span>
                  )}
                  <button className="axolotl-icon-btn" onClick={() => handleRename(axolotl)}>
                    <PencilLine size={14} />
                  </button>

                  

                  <span className="axolotl-level">Lv. {axolotl.level}</span>

                  <button
                    className={`axolotl-icon-btn level-btn ${levelUpReady ? 'axolotl-levelup-ready' : ''}`}
                    onClick={() => handleLevelUp(axolotl)}
                    disabled={!levelUpReady}
                  >
                    <ChevronsUp size={14} />
                  </button>

                </div>

                {/* hunger bar */}
                <div className="axolotl-hunger-row">
                  <span className="axolotl-label">Hunger</span>
                  <div className="axolotl-hunger-track">
                    <div
                      className="axolotl-hunger-fill"
                      style={{ width: `${(axolotl.hunger / MAX_HUNGER) * 100}%` }}
                    />
                  </div>
                  <span className="axolotl-hunger-num">{axolotl.hunger}/{MAX_HUNGER}</span>
                </div>

                {/* info text */}
                <p className="axolotl-info">
                  Finds a cache each day if hunger bar isn't empty.
                </p>
                <p className="axolotl-info">Feed any fish to fill hunger bar. Feed desired fish to level up.</p>
              </div>
            </div>

            <div className="axolotl-fish-row">
              {FISH_POOL.map(fish => {
                const req = requirements.find(r => r.fish === fish)
                const eaten = axolotl.fishEaten?.[fish] ?? 0
                const needed = req?.quantity ?? 0
                const have = getItemQuantity(fish)
                const itemDef = ITEM_MAP[fish]
                const satisfied = needed > 0 && eaten >= needed

                return (
                  <div key={fish} style={{ position: 'relative' }}>
                    <button
                      className={`axolotl-fish-btn ${have <= 0 ? 'axolotl-fish-missing' : ''} ${satisfied ? 'axolotl-fish-satisfied' : ''}`}
                      onClick={() => {
                        if (hoveredFish !== `${axolotl.id}-${fish}`) {
                          setHoveredFish(`${axolotl.id}-${fish}`)
                        } else {
                          handleFeed(axolotl, fish)
                        }
                      }}
                      disabled={have <= 0 || disableButtons}
                      onMouseEnter={() => setHoveredFish(`${axolotl.id}-${fish}`)}
                      onMouseLeave={() => setHoveredFish(null)}
                      onTouchEnd={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (hoveredFish !== `${axolotl.id}-${fish}`) {
                          setHoveredFish(`${axolotl.id}-${fish}`)
                        } else {
                          handleFeed(axolotl, fish)
                          // setHoveredFish(null)
                        }
                      }}
                    >
                      {itemDef && (
                        <img
                          src={itemDef.img}
                          alt={fish}
                          className="axolotl-fish-icon"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      )}
                      <span className={`axolotl-fish-count ${needed > 0 ? 'axolotl-fish-needed' : ''}`}>
                        {needed > 0 ? `${eaten}/${needed}` : `${eaten}`}
                      </span>
                    </button>

                    {hoveredFish === `${axolotl.id}-${fish}` && (
                      <div className="axolotl-fish-tooltip loot-tooltip">
                        <span>You have: <strong>{have}</strong></span>
                        <span>Eaten: <strong>{eaten}</strong></span>
                        <span>Wants: <strong>{needed}</strong></span>
                        {needed > 0
                          ? satisfied
                            ? <span className="axolotl-tooltip-satisfied">Requirement met ✓</span>
                            : <span>Needed to level: <strong>{needed - eaten}</strong></span>
                          : <span className="axolotl-tooltip-noneed">Not needed this level</span>
                        }
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* collect button */}
            <div className="axolotl-action-row">
              {autoFeedUnlocked && (
                <div className="axolotl-feed-group" ref={el => autoFeedDropdownRefs.current[axolotl.id] = el}>
                  <button
                    className="axolotl-feed-main"
                    onClick={() => handleAutoFeedLevelUp(axolotl)}
                    disabled={!canAutoFeedLevelUp(axolotl) || disableButtons}
                  >
                    Auto feed
                  </button>
                  <button
                    className="axolotl-feed-chevron"
                    onClick={() => toggleAutoFeedDropdown(axolotl.id)}
                    disabled={disableButtons}
                    aria-label="More feed options"
                  >
                    ...
                  </button>
                  {autoFeedDropdowns[axolotl.id] && (
                    <div className="axolotl-feed-dropdown">
                      <button
                        onClick={() => handleAutoFeedLevelUp(axolotl)}
                        disabled={!canAutoFeedLevelUp(axolotl)}
                      >
                        <span className="share-dropdown-label">Feed to level up</span>
                        <span className="share-dropdown-desc">Feeds fish needed for next level</span>
                      </button>
                      <button
                        onClick={() => handleAutoFeedFillHunger(axolotl)}
                        disabled={!canAutoFeedFill(axolotl)}
                      >
                        <span className="share-dropdown-label">Feed to fill hunger</span>
                        <span className="share-dropdown-desc">Fills hunger bar with common fish</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {pendingCollectId === axolotl.id ? (
                <div className="axolotl-collect-warning">
                  <p className="axolotl-collect-warning-text">This axolotl can level up first! Collect anyway?</p>
                  <div className="axolotl-collect-warning-buttons">
                    <button className="axolotl-fish-btn" onClick={() => setPendingCollectId(null)}>
                      Cancel
                    </button>
                    <button className="axolotl-fish-btn axolotl-collect-confirm" onClick={() => { handleCollect(axolotl); setPendingCollectId(null) }}>
                      Collect anyway
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className={`upgrade-button axolotl-action-btn ${!canCollect(axolotl) || disableButtons ? 'disable-button' : ''}`}
                  onClick={() => {
                    if (levelUpReady && canCollect(axolotl)) {
                      setPendingCollectId(axolotl.id)
                    } else {
                      handleCollect(axolotl)
                    }
                  }}
                >
                  {alreadyCollected
                    ? `Collected today`
                    : axolotl.hunger >= Math.min(axolotl.level, MAX_HUNGER)
                      ? `Collect cache`
                      : 'Too hungry...'}
                </button>
              )}
            </div>

          </div>
        )
      })}
    </div>
  )

}

export default Axolotl