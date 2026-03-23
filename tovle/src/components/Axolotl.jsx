import { useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { ITEM_MAP } from '../data/itemMap'
import { PencilLine, ChevronUp } from 'lucide-react'
import './Axolotl.css'
import axolotlImg from '../assets/axolotl.png'

const FISH_POOL = [
  'viridian_cod',
  'brown_carp',
  'coffee_catfish',
  'rosefish',
  'sandy_salmon',
  'tundra_trout',
  'tropical_fish',
  'arcane_fish',
]

const MAX_HUNGER = 10

const Axolotl = () => {
  const { uid, playerData, save } = usePlayer()
  const axolotls = playerData?.axolotls ?? []
  const items = playerData?.inventory?.items ?? []
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')

  if (axolotls.length === 0) return null

  const getItemQuantity = (itemId) => {
    const found = items.find(i => i.itemId === itemId)
    return found?.quantity ?? 0
  }

  const getTodayStr = () =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const canCollect = (axolotl) => {
    return axolotl.hunger > 0 && axolotl.lastCollected !== getTodayStr()
  }

  const cachesAvailable = (axolotl) => {
    if (axolotl.lastCollected === getTodayStr()) return 0
    return Math.min(axolotl.level, axolotl.hunger)
  }

  const handleRename = (axolotl) => {
    setEditingId(axolotl.id)
    setEditingName(axolotl.name)
  }

  const handleRenameSubmit = (axolotl) => {
    if (!editingName.trim()) return
    const updatedAxolotls = axolotls.map(a =>
      a.id === axolotl.id ? { ...a, name: editingName.trim() } : a
    )
    save({ axolotls: updatedAxolotls })
    setEditingId(null)
  }

  const handleFeed = (axolotl, fish) => {
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

    save({
      axolotls: updatedAxolotls,
      inventory: { ...playerData.inventory, items: updatedItems },
    })
  }

  const handleCollect = (axolotl) => {
    if (!canCollect(axolotl)) return
    const count = cachesAvailable(axolotl)
    const todayStr = getTodayStr()
    
    const newCaches = Array.from({length: count}, (_, i) => ({
      cacheId: `axolotl_${axolotl.id}_${todayStr}_${i}`,
      date: todayStr,
      guessCount: 0,
      score: 25, //base score
    }))

    const existingUnopenedCaches = playerData.inventory?.unopenedCaches ?? []
    const updatedAxolotls = axolotls.map(a =>
      a.id === axolotl.id
        ? {...a, hunger: Math.max(0, a.hunger - count), lastCollected: todayStr}
        : a
    )

    save({
      axolotls: updatedAxolotls,
      inventory: {
        ...playerData.inventory,
        unopenedCaches: [...existingUnopenedCaches, ...newCaches],
      }
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

  return (
    <div className="axolotl-container">
      {axolotls.map(axolotl => {
        const nextLevel = axolotl.level + 1
        const requirements = axolotl.levelRequirements?.[nextLevel] ?? []
        const levelUpReady = canLevelUp(axolotl)
        const available = cachesAvailable(axolotl)
        const alreadyCollected = axolotl.lastCollected === getTodayStr()

        return (
          <div key={axolotl.id} className="axolotl-card">

            {/* header */}
            <div className="axolotl-header">
              <img src={axolotlImg} alt="axolotl" className="axolotl-img" />
              <div className="axolotl-header-info">

                {/* name row */}
                <div className="axolotl-name-row">
                  {editingId === axolotl.id ? (
                    <input 
                      className="axolotl-name-input"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
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

                  <button
                    className={`axolotl-icon-btn ${levelUpReady ? 'axolotl-levelup-ready' : ''}`}
                    onClick={() => handleLevelUp(axolotl)}
                    disabled={!levelUpReady}
                  >
                    <ChevronUp size={14} />
                  </button>

                  <span className="axolotl-level">Lv. {axolotl.level}</span>

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
                  Finds {axolotl.level} cache{axolotl.level > 1 ? 's' : ''} per day if hunger bar isn't empty.
                </p>
                <p className="axolotl-info">Feed specific fish to level up.</p>
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
                  <button
                    key={fish}
                    className={`axolotl-fish-btn ${have <= 0 ? 'axolotl-fish-missing' : ''} ${satisfied ? 'axolotl-fish-satisfied' : ''}`}
                    onClick={() => handleFeed(axolotl, fish)}
                    disabled={have <= 0}
                  >
                    {itemDef && (
                      <img
                        src={itemDef.img}
                        alt={fish}
                        className="axolotl-fish-icon"
                        style={{imageRendering: 'pixelated'}}
                      />
                    )}
                    <span className={`axolotl-fish-count ${needed > 0 && !satisfied ? 'axolotl-fish-needed' : ''}`}>
                      {needed > 0 ? `${eaten}/${needed}` : `${eaten}`}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* collect button */}
            <button
              className={`submit-button ${!canCollect(axolotl) ? 'disable-button' : ''}`}
              onClick={() => handleCollect(axolotl)}
            >
              {alreadyCollected
                ? 'Collected today'
                : available > 0
                  ? `Collect ${available} cache${available > 1 ? 's' : ''}`
                  : 'Too hungry...'}
            </button>

          </div>
        )
      })}
    </div>
  )

}

export default Axolotl