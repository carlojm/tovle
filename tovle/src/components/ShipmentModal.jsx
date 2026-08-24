import { useState, useEffect, useRef, useCallback } from 'react'
import { animate } from 'animejs'
import { usePlayer } from '../context/PlayerContext'
import ItemConfetti from './ItemConfetti'
import chestPng from '../assets/chest.png'
import chestGif from '../assets/chest.gif'
import EquipmentCard from './EquipmentCard'
import ShipmentGame from './travel/ShipmentGame'
import {
  getTierWeights,
  calcItemPositions,
  JACKPOT_CHANCE,
  TIER_GLOW,
  TIER_GLOW_SOLID,
  TIER_ORDER,
} from '../utils/tierWeights'
import { getTownLevel } from '../utils/townUtils'
import { getEasternDateStr } from '../utils/dates'
import './ShipmentModal.css'
import islesItems from '../data/islesItems.json'

const CLOUD_FRACTION = 0.67
const ITEM_SIZE      = 48
const MIN_ITEM_GAP   = 12
const FLOAT_UP_DUR   = 550
const OPEN_CHEST_DUR = 600
const THROW_DELAY    = 300
const THROW_DUR      = 1200

const TIER_LABEL_CLASS = {
  'Uncommon': 'monumenta-uncommon',
  'Unique':   'monumenta-unique',
  'Rare':     'monumenta-rare',
  'Artifact': 'monumenta-artifact',
  'Epic':     'monumenta-epic',
}

const JACKPOT_TIERS = new Set(['Rare', 'Artifact', 'Epic'])

// ── Chest fall — no shakes, no items, just the open+throw physics ────────────
// Runs once when "start" is pressed, in parallel with the /api/collect-shipment
// call, so it doubles as visual cover for normal network latency rather than
// blocking on it.

function ChestFallStage({ chestRef, chestGlowRef, onComplete }) {
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const run = async () => {
      const chestEl = chestRef.current
      const chestGlowEl = chestGlowRef.current
      if (!chestEl) return onComplete()

      chestEl.src = chestGif + '?t=' + Date.now()

      const throwX = (Math.random() - 0.5) * 160
      const throwDir = throwX > 0 ? 1 : -1

      const throwPromise = new Promise(r => setTimeout(r, THROW_DELAY)).then(() => {
        chestEl.style.setProperty('--throw-x', `${throwX}px`)
        chestEl.style.setProperty('--throw-x-half', `${throwX * 0.3}px`)
        chestEl.style.setProperty('--throw-rot', `${throwDir * 30}deg`)
        chestEl.style.setProperty('--throw-rot-half', `${throwDir * 8}deg`)
        chestEl.style.animation = `sm-chest-throw ${THROW_DUR}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`
        return new Promise(r => setTimeout(r, THROW_DUR))
      })

      if (chestGlowEl) {
        chestGlowEl.style.transition = 'opacity 0.3s ease'
        chestGlowEl.style.opacity = '0'
      }

      await new Promise(r => setTimeout(r, OPEN_CHEST_DUR))
      await throwPromise
      onComplete()
    }
    run()
  }, [chestRef, chestGlowRef, onComplete])

  return null
}

// ── Reveal — floats the collected items up as one batch, no chest involved ──
// Ported from AnimationStage's per-item spawn/float/bob logic, flattened
// from tiered sequence steps into a single simultaneous batch since reveal
// isn't trying to build tier-by-tier suspense the way the original roll was.

function RevealStage({ items, bodyRef, onComplete, onJackpot, onItemSelect, onPositionsCalculated }) {
  const cloudRef = useRef(null)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const run = async () => {
      const body = bodyRef.current
      const cloud = cloudRef.current
      if (!body || !cloud || items.length === 0) return onComplete()

      const bodyW = body.clientWidth
      const topZone = body.querySelector('.sm-top-zone')
      const cloudH = topZone ? topZone.clientHeight : body.clientHeight * CLOUD_FRACTION

      const positions = calcItemPositions(items.length, cloudH, bodyW, ITEM_SIZE, MIN_ITEM_GAP)
      const idToPosition = {}
      items.forEach((item, i) => { idToPosition[item.id] = positions[i] })
      onPositionsCalculated(idToPosition)

      if (items.some(i => JACKPOT_TIERS.has(i.tier))) onJackpot()

      const getMonumentaClass = (itemName) =>
        `monumenta-${itemName
          .replaceAll('-', '').replaceAll('.', '').replaceAll("'", '')
          .replace(/\(.*\)/g, '').trim()
          .replaceAll(' ', '-').replaceAll('_', '-')
          .toLowerCase()
          .replace(/(^|-)([a-z])/g, (_, sep, c) => `${sep}${c.toUpperCase()}`)
        }`

      const spawnItemEl = (item, pos) => {
        const itemDef = islesItems[item.itemKey]
        const el = document.createElement('div')
        el.className = 'sm-item'
        el.style.cssText = `
          width: ${ITEM_SIZE}px; height: ${ITEM_SIZE}px; position: absolute;
          left: ${pos.x - ITEM_SIZE / 2}px; top: ${pos.y - ITEM_SIZE / 2}px;
          opacity: 0; will-change: transform, opacity;
        `
        const inner = document.createElement('div')
        inner.className = 'sm-item-inner'
        inner.style.cssText = `width: ${ITEM_SIZE}px; height: ${ITEM_SIZE}px; display: flex; align-items: center; justify-content: center; position: relative;`

        const glow = document.createElement('div')
        glow.className = 'sm-item-glow'
        glow.style.cssText = `position: absolute; inset: -8px; border-radius: 50%; filter: blur(10px); pointer-events: none; z-index: -1; background: ${TIER_GLOW[item.tier] ?? 'transparent'};`
        inner.appendChild(glow)

        if (itemDef) {
          const monumentaClass = getMonumentaClass(itemDef.name)
          const hasSprite = Array.from(document.styleSheets).some(sheet => {
            try { return Array.from(sheet.cssRules).some(r => r.selectorText === `.${monumentaClass}`) }
            catch { return false }
          })
          const iconEl = document.createElement('div')
          if (hasSprite) {
            iconEl.className = `monumenta-items ${monumentaClass}`
          } else {
            const minecraftClass = `minecraft-${(itemDef.base_item ?? '').replaceAll(' ', '-').replaceAll('_', '-').toLowerCase()}`
            iconEl.className = `minecraft ${minecraftClass}`
          }
          iconEl.style.cssText = `width: 64px; height: 64px; transform: scale(${ITEM_SIZE / 64 * 0.9}); transform-origin: center; margin: calc((64px * (1 - ${ITEM_SIZE / 64 * 0.9})) / -2); flex-shrink: 0;`
          inner.appendChild(iconEl)
        }

        el.appendChild(inner)
        el.addEventListener('click', (e) => { e.stopPropagation(); onItemSelect(item) })
        cloud.appendChild(el)
        return el
      }

      await Promise.all(items.map(async (item) => {
        const pos = idToPosition[item.id]
        const el = spawnItemEl(item, pos)
        await animate(el, { opacity: [0, 1], translateY: [12, 0], duration: FLOAT_UP_DUR, ease: 'outCubic' }).finished
        const inner = el.querySelector('.sm-item-inner')
        if (inner) {
          inner.classList.add('sm-item-bob')
          inner.style.animationDelay = `${Math.random() * 2.4}s`
        }
      }))

      onComplete()
    }
    run()
  }, [items, bodyRef, onComplete, onJackpot, onItemSelect, onPositionsCalculated])

  return <div ref={cloudRef} className="sm-cloud" />
}

function InspectCloud({ items, positions, onItemSelect }) {
  return (
    <div className="sm-cloud" style={{ pointerEvents: 'none' }}>
      {items.map((item) => {
        const pos = positions[item.id]
        if (!pos) return null
        return (
          <div
            key={item.id}
            style={{ position: 'absolute', left: pos.x - ITEM_SIZE / 2, top: pos.y - ITEM_SIZE / 2, width: ITEM_SIZE, height: ITEM_SIZE, cursor: 'pointer', pointerEvents: 'all' }}
            onClick={() => onItemSelect(item)}
          />
        )
      })}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────

export default function ShipmentModal({ townId, onClose, onCollected }) {
  const { playerData, uid, save } = usePlayer()

  const forumTier  = playerData?.travel?.forum?.tier ?? 1
  const townData   = playerData?.travel?.towns?.[townId] ?? {}
  const reputation = townData.reputation ?? 0
  const townLevel  = getTownLevel(reputation)
  const todayStr   = getEasternDateStr()

  const cutUnlocked      = playerData?.upgrades?.cutUnlocked ?? false
  const autoplaceUnlocked = townLevel >= 5
  const denPieces        = playerData?.inventory?.currencies?.denPieces ?? 0

  const [phase, setPhase]             = useState('preroll') // preroll | chestfall | game | reveal
  const [rolling, setRolling]         = useState(false)
  const [rolledEquipment, setRolledEquipment] = useState([])
  const [rolledFiller, setRolledFiller]       = useState([])
  const [revealItems, setRevealItems] = useState([]) // finalize's collected equipment, for floating display
  const [fillerSummary, setFillerSummary] = useState({ items: [], denPiecesGained: 0 })
  const [showConfetti, setShowConfetti] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [error, setError] = useState(null)
  const [itemPositions, setItemPositions] = useState({})

  const bodyRef      = useRef(null)
  const chestRef     = useRef(null)
  const chestGlowRef = useRef(null)

  const { effective, maxTierIndex } = getTierWeights(reputation, forumTier)
  const jackpots     = JACKPOT_CHANCE[forumTier] ?? {}
  const displayTiers = TIER_ORDER.slice(0, maxTierIndex + 1)
  const maxPct       = Math.max(...displayTiers.map(t => effective[t] ?? 0))

  // ── Resume check — a pending shipment for today means we're reopening an
  // in-progress board, not starting fresh. Skip preroll/chestfall entirely.
  useEffect(() => {
    const pending = townData.pendingShipment
    if (pending?.rolledDate === todayStr && phase === 'preroll') {
      setRolledEquipment(pending.equipment)
      setRolledFiller(pending.filler)
      setPhase('game')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStart = async () => {
    setRolling(true)
    setError(null)
    setPhase('chestfall')

    try {
      const [res] = await Promise.all([
        fetch('/api/collect-shipment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid, townId }),
        }),
        new Promise(r => setTimeout(r, OPEN_CHEST_DUR + THROW_DELAY + THROW_DUR)), // let chest-fall finish even if the API is fast
      ])
      const data = await res.json()

      if (res.status === 409) {
        setError(data.error ?? 'Already collected today')
        setPhase('preroll')
        setRolling(false)
        return
      }
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        setPhase('preroll')
        setRolling(false)
        return
      }

      setRolledEquipment(data.equipment)
      setRolledFiller(data.filler)
      setPhase('game')
    } catch (err) {
      setError('Failed to connect. Try again.')
      setPhase('preroll')
      console.error(err)
    } finally {
      setRolling(false)
    }
  }

  const handleGameSubmit = async ({ collectedEquipmentIds, collectedFillerIds, extraTilesPurchased }) => {
    try {
      const res = await fetch('/api/finalize-shipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, townId, collectedEquipmentIds, collectedFillerIds, extraTilesPurchased }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong finishing the shipment')
        return
      }

      // local sync so equipment/inventory/currency reflect immediately —
      // server already committed these, same pattern as handleExecuteTrade
      // in TownCard.jsx
      const existingEquipment = playerData?.equipment ?? []
      const existingItems = playerData?.inventory?.items ?? []
      const mergedItems = [...existingItems]
      for (const f of data.filler) {
        const existing = mergedItems.find(i => i.itemId === f.itemId)
        if (existing) existing.quantity += f.quantity
        else mergedItems.push({ itemId: f.itemId, quantity: f.quantity })
      }
      save({
        equipment: [...existingEquipment, ...data.equipment],
        'inventory.items': mergedItems,
        'inventory.currencies.denPieces': denPieces + data.denPiecesGained,
      }, { localOnly: true })

      setRevealItems(data.equipment)
      setFillerSummary({ items: data.filler, denPiecesGained: data.denPiecesGained })
      setPhase('reveal')
    } catch (err) {
      setError('Failed to connect. Try again.')
      console.error(err)
    }
  }

  const handleRevealComplete = useCallback(() => {}, [])
  const handleJackpot = useCallback(() => setShowConfetti(true), [])

  const handleCollectClose = () => {
    onCollected?.()
    onClose()
  }

  return (
    <>
      <div className="sm-backdrop">
        <div className="sm-modal">
          <div className="sm-header">
            <h2>Incoming Shipment</h2>
            <button className="sm-close-btn" onClick={onClose}>×</button>
          </div>

          <div className="sm-body" ref={bodyRef}>
            <div className="sm-top-zone">
              {phase === 'preroll' && (
                <div className="sm-preroll-info">
                  <p className="sm-subtitle">Distribution based on Forum tier and {reputation} reputation</p>
                  <div className="sm-tier-table">
                    {displayTiers.map(tier => {
                      const pct = (effective[tier] ?? 0) * 100
                      const barWidth = maxPct > 0 ? (effective[tier] ?? 0) / maxPct * 100 : 0
                      return (
                        <div key={tier} className="sm-tier-row">
                          <span className={`sm-tier-label ${TIER_LABEL_CLASS[tier] ?? ''}`}>{tier}</span>
                          <div className="sm-tier-bar-track">
                            <div className="sm-tier-bar-fill" style={{ width: `${barWidth}%` }} />
                          </div>
                          <span className="sm-tier-pct">{pct.toFixed(1)}%</span>
                        </div>
                      )
                    })}
                  </div>
                  {(jackpots.Rare || jackpots.Artifact) && (
                    <div className="sm-jackpot-info">
                      <span className="sm-jackpot-title">Jackpot Chances</span>
                      {jackpots.Rare && <span className="sm-jackpot-row monumenta-rare">Rare: {(jackpots.Rare * 100).toFixed(1)}%</span>}
                      {jackpots.Artifact && <span className="sm-jackpot-row monumenta-artifact">Artifact: {(jackpots.Artifact * 100).toFixed(2)}%</span>}
                    </div>
                  )}
                </div>
              )}

              {phase === 'game' && (
                <ShipmentGame
                  equipment={rolledEquipment}
                  filler={rolledFiller}
                  townId={townId}
                  rolledDate={todayStr}
                  cutUnlocked={cutUnlocked}
                  autoplaceUnlocked={autoplaceUnlocked}
                  denPieces={denPieces}
                  onSubmit={handleGameSubmit}
                />
              )}

              {phase === 'reveal' && (
                <>
                  <RevealStage
                    items={revealItems}
                    bodyRef={bodyRef}
                    onComplete={handleRevealComplete}
                    onJackpot={handleJackpot}
                    onItemSelect={setSelectedItem}
                    onPositionsCalculated={setItemPositions}
                  />
                </>
              )}

              {error && <p className="sm-error">{error}</p>}
            </div>

            <div className="sm-bottom">
              {(phase === 'preroll' || phase === 'chestfall') && (
                <div className="sm-chest-wrap">
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div ref={chestGlowRef} className="sm-chest-glow" style={{ opacity: 0 }} />
                    <img
                      ref={chestRef}
                      src={chestPng}
                      alt="chest"
                      className={`sm-chest-static ${phase === 'preroll' ? 'sm-chest-static--sway' : ''}`}
                    />
                  </div>
                </div>
              )}

              {phase === 'reveal' && (fillerSummary.items.length > 0 || fillerSummary.denPiecesGained > 0) && (
                <div className="sm-jackpot-info">
                  {fillerSummary.denPiecesGained > 0 && <span className="sm-jackpot-row">+{fillerSummary.denPiecesGained} den pieces</span>}
                  {fillerSummary.items.map(f => (
                    <span key={f.id} className="sm-jackpot-row">{f.quantity}x {f.itemId}</span>
                  ))}
                </div>
              )}

              {phase === 'chestfall' && (
                <ChestFallStage chestRef={chestRef} chestGlowRef={chestGlowRef} onComplete={() => {}} />
              )}

              {phase !== 'game' && (
                <button
                  className="sm-roll-btn"
                  onClick={phase === 'preroll' ? handleStart : phase === 'reveal' ? handleCollectClose : undefined}
                  disabled={phase === 'chestfall' || rolling}
                >
                  {phase === 'reveal' ? 'Collect' : rolling ? 'Rolling...' : phase === 'chestfall' ? '···' : 'Roll Shipment'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showConfetti && <ItemConfetti onComplete={() => setShowConfetti(false)} />}

      {selectedItem && (() => {
        const liveInstance = (playerData?.equipment ?? []).find(i => i.id === selectedItem.id) ?? selectedItem
        return <EquipmentCard instance={liveInstance} onClose={() => setSelectedItem(null)} />
      })()}
    </>
  )
}