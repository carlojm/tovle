import { useState, useEffect, useRef, useCallback } from 'react'
import { animate, createTimeline } from 'animejs'
import { usePlayer } from '../context/PlayerContext'
import islesItems from '../data/islesItems.json'
import ItemIcon from './ItemIcon'
import EquipmentCard from './EquipmentCard'
import ItemConfetti from './ItemConfetti'
import chestPng from '../assets/chest.png'
import chestGif from '../assets/chest.gif'
import {
  getTierWeights,
  buildSequence,
  calcItemPositions,
  JACKPOT_CHANCE,
  TIER_GLOW,
  TIER_GLOW_SOLID,
  TIER_ORDER,
  MAX_TIER_BY_FORUM,
} from '../utils/tierWeights'
import './ShipmentModal.css'

// ── Tweakable globals ─────────────────────────────────────────────────────────

const CLOUD_FRACTION  = 0.67   // top portion reserved for item cloud
const CHEST_FRACTION  = 0.33   // bottom portion for chest
const ITEM_SIZE       = 48     // px — rendered size of each item icon
const MIN_ITEM_GAP    = 12     // px — minimum gap between item centers
const FLOAT_UP_DUR    = 550    // ms — item floats from chest to cloud position
const OPEN_CHEST_DUR  = 600    // ms — chest open gif plays before items float

// ── Tier display helpers ──────────────────────────────────────────────────────

const TIER_BADGE = {
  'Tier 1': 'I', 'Tier 2': 'II', 'Tier 3': 'III', 'Tier 4': 'IV', 'Tier 5': 'V',
  'Uncommon': 'Unc', 'Unique': 'Unq', 'Rare': 'Rare', 'Artifact': 'Arti', 'Epic': 'Epic',
}

const TIER_LABEL_CLASS = {
  'Tier 1': '', 'Tier 2': '', 'Tier 3': '', 'Tier 4': '', 'Tier 5': '',
  'Uncommon': 'monumenta-uncommon',
  'Unique':   'monumenta-unique',
  'Rare':     'monumenta-rare',
  'Artifact': 'monumenta-artifact',
  'Epic':     'monumenta-epic',
}

const JACKPOT_TIERS = new Set(['Rare', 'Artifact', 'Epic'])

// ── Pre-roll: tier probability display ───────────────────────────────────────

function PrerollScreen({ reputation, forumTier, onRoll, rolling, onClose }) {
  const { effective, display, maxTierIndex } = getTierWeights(reputation, forumTier)
  const jackpots = JACKPOT_CHANCE[forumTier] ?? {}

  const displayTiers = TIER_ORDER.slice(0, maxTierIndex + 1)

  // highest bar value for scaling
  const maxPct = Math.max(...displayTiers.map(t => (effective[t] ?? 0)))

  return (
    <div className="sm-preroll">
      <div className="sm-preroll-info">
        <p className="sm-subtitle">
          Tier distribution based on your reputation ({reputation} rep)
        </p>

        <div className="sm-tier-table">
          {displayTiers.map(tier => {
            const pct = (effective[tier] ?? 0) * 100
            const barWidth = maxPct > 0 ? (effective[tier] ?? 0) / maxPct * 100 : 0
            return (
              <div key={tier} className="sm-tier-row">
                <span className={`sm-tier-label ${TIER_LABEL_CLASS[tier] ?? ''}`}>
                  {tier}
                </span>
                <div className="sm-tier-bar-track">
                  <div
                    className="sm-tier-bar-fill"
                    style={{
                      width: `${barWidth}%`,
                      background: TIER_GLOW_SOLID[tier] ?? '#888',
                    }}
                  />
                </div>
                <span className="sm-tier-pct">{pct.toFixed(1)}%</span>
              </div>
            )
          })}
        </div>

        {(jackpots.Rare || jackpots.Artifact) && (
          <div className="sm-jackpot-info">
            <span className="sm-jackpot-title">Jackpot Chances</span>
            {jackpots.Rare && (
              <span className="sm-jackpot-row monumenta-rare">
                Rare: {(jackpots.Rare * 100).toFixed(1)}%
              </span>
            )}
            {jackpots.Artifact && (
              <span className="sm-jackpot-row monumenta-artifact">
                Artifact: {(jackpots.Artifact * 100).toFixed(2)}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* chest preview at bottom of info panel */}
      <div className="sm-chest-preview">
        <img src={chestPng} alt="chest" />
      </div>

      <button
        className="sm-roll-btn"
        onClick={onRoll}
        disabled={rolling}
      >
        {rolling ? 'Rolling...' : 'Roll Shipment'}
      </button>
    </div>
  )
}

// ── Animation stage ───────────────────────────────────────────────────────────

function AnimationStage({
  items,
  forumTier,
  modalRef,
  onComplete,
  onJackpot,
  onItemSelect,
}) {
  const chestRef      = useRef(null)
  const chestGlowRef  = useRef(null)
  const cloudRef      = useRef(null)
  const stepRef       = useRef(0)
  const itemEls       = useRef([])   // { el, instance } for inspect phase
  const [batchLabel, setBatchLabel] = useState('')
  const [done, setDone]             = useState(false)

  const runSequence = useCallback(async () => {
    const modal = modalRef.current
    if (!modal) return

    const modalW = modal.clientWidth
    const modalH = modal.clientHeight
    const cloudH = modalH * CLOUD_FRACTION

    const sequence = buildSequence(items, forumTier)

    // pre-calculate ALL item positions up front
    const allPositions = calcItemPositions(items.length, cloudH, modalW, ITEM_SIZE, MIN_ITEM_GAP)

    // map each item to its final position (in order they'll appear)
    // we assign positions as items reveal, in sequence order
    let posIndex = 0
    const itemPositions = new Map() // item.id → {x, y}

    // flatten sequence to get reveal order
    for (const step of sequence) {
      for (const item of step.items) {
        itemPositions.set(item.id, allPositions[posIndex++] ?? allPositions[0])
      }
    }

    const chestEl     = chestRef.current
    const chestGlowEl = chestGlowRef.current

    // chest center in modal coords (relative to cloud area bottom = chestArea top)
    const chestCenterX = modalW / 2
    const chestCenterY = modalH * CLOUD_FRACTION + (modalH * CHEST_FRACTION) / 2

    const spawnItemEl = (item, position) => {
      const el = document.createElement('div')
      el.className = 'sm-item'
      el.style.cssText = `
        width: ${ITEM_SIZE}px;
        height: ${ITEM_SIZE}px;
        left: ${chestCenterX - ITEM_SIZE / 2}px;
        top: ${chestCenterY - ITEM_SIZE / 2}px;
        opacity: 0;
      `

      // inner wrapper for bob animation (added after float completes)
      const inner = document.createElement('div')
      inner.className = 'sm-item-inner'
      inner.style.cssText = `width:${ITEM_SIZE}px;height:${ITEM_SIZE}px;display:flex;align-items:center;justify-content:center;`

      // glow
      const glow = document.createElement('div')
      glow.className = 'sm-item-glow'
      glow.style.background = TIER_GLOW[item.tier] ?? 'transparent'
      inner.appendChild(glow)

      // icon — use a placeholder div we'll replace with React portal later
      // for now render a colored square as stand-in; real icons added after
      const iconPlaceholder = document.createElement('div')
      iconPlaceholder.dataset.itemKey = item.itemKey
      iconPlaceholder.style.cssText = `
        width: ${ITEM_SIZE}px;
        height: ${ITEM_SIZE}px;
        display: flex; align-items: center; justify-content: center;
        image-rendering: pixelated;
      `
      inner.appendChild(iconPlaceholder)
      el.appendChild(inner)

      // click to inspect
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onItemSelect(item)
      })

      cloudRef.current.appendChild(el)
      itemEls.current.push({ el, item })
      return el
    }

    for (let s = 0; s < sequence.length; s++) {
      const step = sequence[s]
      const { shakeConfig, tier, type } = step
      const { shakes, shakeDur, pauseDur } = shakeConfig

      // update batch label
      setBatchLabel(
        type === 'batch'
          ? `${step.items.length} item${step.items.length > 1 ? 's' : ''} · ${tier}`
          : tier
      )

      // shake sequence — build timeline
      // glow increases each shake
      for (let sh = 0; sh < shakes; sh++) {
        const progress = (sh + 1) / shakes  // 0→1 over shake count
        const glowColor = sh < shakes - 1
          ? `rgba(80,80,80,${0.2 + progress * 0.3})`  // build up gray
          : (TIER_GLOW_SOLID[tier] ?? '#888')           // final shake = tier color

        // shake the chest
        await animate(chestEl, {
          rotate: [
            { to: -8, duration: shakeDur * 0.25 },
            { to:  8, duration: shakeDur * 0.5  },
            { to:  0, duration: shakeDur * 0.25 },
          ],
          scale: [
            { to: 1.08, duration: shakeDur * 0.5 },
            { to: 1.0,  duration: shakeDur * 0.5 },
          ],
          ease: 'inOutSine',
        }).finished

        // update glow
        if (chestGlowEl) {
          chestGlowEl.style.background = glowColor
          await animate(chestGlowEl, {
            opacity: [0.4, 0.9, 0.4],
            duration: shakeDur,
            ease: 'inOutSine',
          }).finished
        }

        // pause between shakes — gets longer toward the end for suspense
        const suspensePause = pauseDur * (1 + (sh / shakes) * 0.8)
        await new Promise(r => setTimeout(r, suspensePause))
      }

      // fire confetti for jackpot tiers
      if (JACKPOT_TIERS.has(tier)) {
        onJackpot()
      }

      // open chest — swap to gif
      chestEl.src = chestGif + '?t=' + Date.now()
      await new Promise(r => setTimeout(r, OPEN_CHEST_DUR))

      // float items up to their positions
      const floatPromises = step.items.map(async (item) => {
        const pos = itemPositions.get(item.id)
        if (!pos) return
        const el = spawnItemEl(item, pos)

        await animate(el, {
          left:    pos.x - ITEM_SIZE / 2,
          top:     pos.y - ITEM_SIZE / 2,
          opacity: [0, 1],
          duration: FLOAT_UP_DUR,
          ease: 'outCubic',
        }).finished

        // add bob after settling
        el.querySelector('.sm-item-inner').classList.add('sm-item-bob')
        // stagger bob phase so they don't all move in sync
        el.querySelector('.sm-item-inner').style.animationDelay =
          `${Math.random() * 2.4}s`
      })

      await Promise.all(floatPromises)

      // close chest, clear glow, brief pause before next batch
      chestEl.src = chestPng
      if (chestGlowEl) {
        animate(chestGlowEl, { opacity: 0, duration: 300, ease: 'outSine' })
      }
      await new Promise(r => setTimeout(r, 400))
    }

    setBatchLabel('')
    setDone(true)
    onComplete()
  }, [items, forumTier, modalRef, onComplete, onJackpot, onItemSelect])

  useEffect(() => {
    // small delay so DOM is ready
    const t = setTimeout(runSequence, 200)
    return () => clearTimeout(t)
  }, [runSequence])

  return (
    <div className="sm-stage">
      {/* cloud layer — items float up here */}
      <div
        ref={cloudRef}
        className="sm-cloud"
        style={{ height: `${CLOUD_FRACTION * 100}%`, position: 'absolute' }}
      />

      {/* batch label */}
      <div className="sm-batch-label" style={{ opacity: batchLabel ? 1 : 0 }}>
        {batchLabel}
      </div>

      {/* chest area */}
      <div
        className="sm-chest-area"
        style={{ height: `${CHEST_FRACTION * 100}%` }}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div ref={chestGlowRef} className="sm-chest-glow" style={{ opacity: 0 }} />
          <img
            ref={chestRef}
            src={chestPng}
            alt="chest"
            className="sm-chest"
          />
        </div>
      </div>

      {/* collect button appears when done */}
      {done && (
        <button className="sm-collect-btn" onClick={onComplete}>
          Collect
        </button>
      )}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function ShipmentModal({ townId, onClose }) {
  const { playerData, uid, save } = usePlayer()
  const modalRef = useRef(null)

  const travel     = playerData?.travel
  const forumTier  = travel?.forum?.tier ?? 1
  const reputation = travel?.towns?.[townId]?.reputation ?? 0

  const [phase, setPhase]             = useState('preroll')   // preroll | animating | inspect
  const [rolling, setRolling]         = useState(false)
  const [rolledItems, setRolledItems] = useState([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [error, setError]             = useState(null)

  const handleRoll = async () => {
    setRolling(true)
    setError(null)
    try {
      const res = await fetch('/api/collect-shipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, townId }),
      })
      const data = await res.json()

      if (res.status === 409) {
        setError(data.error ?? 'Already collected today')
        setRolling(false)
        return
      }
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        setRolling(false)
        return
      }

      // save immediately — items are safe even if player closes modal
      const newInstances = data.items  // server returns full instances with id etc
      const existing = playerData?.equipment ?? []
      save({ equipment: [...existing, ...newInstances] })

      setRolledItems(data.items)
      setPhase('animating')
    } catch (err) {
      setError('Failed to connect. Try again.')
      console.error(err)
    } finally {
      setRolling(false)
    }
  }

  const handleAnimationComplete = useCallback(() => {
    setPhase('inspect')
  }, [])

  const handleJackpot = useCallback(() => {
    setShowConfetti(true)
  }, [])

  const handleCollect = () => {
    onClose()
  }

  // star from inspect phase — updates the already-saved equipment
  const handleStar = (instance) => {
    const updated = (playerData?.equipment ?? []).map(i =>
      i.id === instance.id ? { ...i, starred: !i.starred } : i
    )
    save({ equipment: updated })
  }

  return (
    <>
      <div className="sm-backdrop" onClick={phase === 'inspect' ? handleCollect : undefined}>
        <div
          className="sm-modal"
          ref={modalRef}
          onClick={e => e.stopPropagation()}
        >
          <div className="sm-header">
            <h2>Incoming Shipment</h2>
            <button className="sm-close-btn" onClick={onClose}>×</button>
          </div>

          {phase === 'preroll' && (
            <PrerollScreen
              reputation={reputation}
              forumTier={forumTier}
              onRoll={handleRoll}
              rolling={rolling}
            />
          )}

          {phase === 'animating' && (
            <AnimationStage
              items={rolledItems}
              forumTier={forumTier}
              modalRef={modalRef}
              onComplete={handleAnimationComplete}
              onJackpot={handleJackpot}
              onItemSelect={setSelectedItem}
            />
          )}

          {phase === 'inspect' && (
            <div className="sm-stage">
              {/* re-render items as React elements for full ItemIcon support */}
              <div
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  height: `${CLOUD_FRACTION * 100}%`,
                }}
              >
                {rolledItems.map((item, i) => {
                  // positions were pre-calculated — we need to store them
                  // for inspect phase. We'll use the same seed logic.
                  // For simplicity: re-derive positions from modal size.
                  // This is called once so performance is fine.
                  return null // replaced below
                })}
              </div>
              {/* inspect phase renders items properly via InspectCloud */}
              <InspectCloud
                items={rolledItems}
                modalRef={modalRef}
                onItemSelect={setSelectedItem}
              />
              <button className="sm-collect-btn" onClick={handleCollect}>
                Collect
              </button>
            </div>
          )}

          {error && (
            <p style={{ color: '#fc5454', padding: '8px 20px', margin: 0, fontSize: 13 }}>
              {error}
            </p>
          )}
        </div>
      </div>

      {showConfetti && (
        <ItemConfetti onComplete={() => setShowConfetti(false)} />
      )}

      {selectedItem && (
        <EquipmentCard
          instance={selectedItem}
          onClose={() => setSelectedItem(null)}
          onStar={handleStar}
          onEquip={() => {}}
          onRecycle={() => {}}
        />
      )}
    </>
  )
}

// ── Inspect cloud — React-rendered items with real ItemIcon ───────────────────

function InspectCloud({ items, modalRef, onItemSelect }) {
  const [positions, setPositions] = useState([])

  useEffect(() => {
    const modal = modalRef.current
    if (!modal) return
    const modalW = modal.clientWidth
    const modalH = modal.clientHeight
    const cloudH = modalH * CLOUD_FRACTION
    const pos = calcItemPositions(items.length, cloudH, modalW, ITEM_SIZE, MIN_ITEM_GAP)
    setPositions(pos)
  }, [items, modalRef])

  return (
    <div
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: `${CLOUD_FRACTION * 100}%`,
      }}
    >
      {items.map((item, i) => {
        const pos = positions[i]
        if (!pos) return null
        return (
          <div
            key={item.id}
            className="sm-item"
            style={{
              left: pos.x - ITEM_SIZE / 2,
              top:  pos.y - ITEM_SIZE / 2,
              opacity: 1,
            }}
            onClick={() => onItemSelect(item)}
          >
            <div className="sm-item-inner sm-item-bob" style={{ animationDelay: `${i * 0.3}s` }}>
              <div
                className="sm-item-glow"
                style={{ background: TIER_GLOW[item.tier] ?? 'transparent' }}
              />
              <ItemIcon itemKey={item.itemKey} />
            </div>
          </div>
        )
      })}
    </div>
  )
}