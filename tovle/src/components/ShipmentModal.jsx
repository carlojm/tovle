import { useState, useEffect, useRef, useCallback } from 'react'
import { animate } from 'animejs'
import { usePlayer } from '../context/PlayerContext'
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
} from '../utils/tierWeights'
import './ShipmentModal.css'

// ── Tweakable globals ─────────────────────────────────────────────────────────

const CLOUD_FRACTION = 0.67  // fraction of sm-body used for the item cloud
const ITEM_SIZE      = 48
const MIN_ITEM_GAP   = 12
const FLOAT_UP_DUR   = 550
const OPEN_CHEST_DUR = 600

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIER_LABEL_CLASS = {
  'Uncommon': 'monumenta-uncommon',
  'Unique':   'monumenta-unique',
  'Rare':     'monumenta-rare',
  'Artifact': 'monumenta-artifact',
  'Epic':     'monumenta-epic',
}

const JACKPOT_TIERS = new Set(['Rare', 'Artifact', 'Epic'])

// ── Animation stage ───────────────────────────────────────────────────────────
// Renders imperatively into the cloud div above the chest.
// The chest ref is passed in from the parent so it animates the real chest
// that is always mounted in sm-bottom.

function AnimationStage({ items, forumTier, bodyRef, chestRef, chestGlowRef, onComplete, onJackpot, onItemSelect }) {
  const cloudRef = useRef(null)
  const [batchLabel, setBatchLabel] = useState('')

  const runSequence = useCallback(async () => {
    const body    = bodyRef.current
    const chestEl = chestRef.current
    const chestGlowEl = chestGlowRef.current
    const cloud   = cloudRef.current
    if (!body || !chestEl || !cloud) return

    const bodyW  = body.clientWidth
    const bodyH  = body.clientHeight
    const cloudH = bodyH * CLOUD_FRACTION

    const sequence    = buildSequence(items, forumTier)
    const allPositions = calcItemPositions(items.length, cloudH, bodyW, ITEM_SIZE, MIN_ITEM_GAP)

    let posIndex = 0
    const itemPositions = new Map()
    for (const step of sequence) {
      for (const item of step.items) {
        itemPositions.set(item.id, allPositions[posIndex++] ?? allPositions[0])
      }
    }

    // chest center — chest lives in sm-bottom which starts at CLOUD_FRACTION down the body
    const chestCenterX = bodyW / 2
    const chestCenterY = cloudH + (bodyH * (1 - CLOUD_FRACTION)) / 2

    const spawnItemEl = (item) => {
      const el = document.createElement('div')
      el.className = 'sm-item'
      el.style.cssText = `
        width: ${ITEM_SIZE}px;
        height: ${ITEM_SIZE}px;
        left: ${chestCenterX - ITEM_SIZE / 2}px;
        top: ${chestCenterY - ITEM_SIZE / 2}px;
        opacity: 0;
      `
      const inner = document.createElement('div')
      inner.className = 'sm-item-inner'
      inner.style.cssText = `
        width: ${ITEM_SIZE}px;
        height: ${ITEM_SIZE}px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      `
      const glow = document.createElement('div')
      glow.className = 'sm-item-glow'
      glow.style.background = TIER_GLOW[item.tier] ?? 'transparent'
      inner.appendChild(glow)

      const placeholder = document.createElement('div')
      placeholder.style.cssText = `
        width: ${ITEM_SIZE}px;
        height: ${ITEM_SIZE}px;
        background: rgba(255,255,255,0.1);
        border-radius: 6px;
      `
      inner.appendChild(placeholder)
      el.appendChild(inner)

      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onItemSelect(item)
      })

      cloud.appendChild(el)
      return el
    }

    for (let s = 0; s < sequence.length; s++) {
      const step = sequence[s]
      const { shakeConfig, tier, type } = step
      const { shakes, shakeDur, pauseDur } = shakeConfig

      setBatchLabel(
        type === 'batch'
          ? `${step.items.length} item${step.items.length > 1 ? 's' : ''} · ${tier}`
          : tier
      )

      for (let sh = 0; sh < shakes; sh++) {
        const isLastShake = sh === shakes - 1
        const progress    = (sh + 1) / shakes
        const glowColor   = isLastShake
          ? (TIER_GLOW_SOLID[tier] ?? '#888')
          : `rgba(80,80,80,${0.2 + progress * 0.3})`

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

        if (chestGlowEl) {
          chestGlowEl.style.background = glowColor
          await animate(chestGlowEl, {
            opacity: [0.4, 0.9, 0.4],
            duration: shakeDur,
            ease: 'inOutSine',
          }).finished
        }

        const suspensePause = pauseDur * (1 + (sh / shakes) * 0.8)
        await new Promise(r => setTimeout(r, suspensePause))
      }

      if (JACKPOT_TIERS.has(tier)) onJackpot()

      chestEl.src = chestGif + '?t=' + Date.now()
      await new Promise(r => setTimeout(r, OPEN_CHEST_DUR))

      await Promise.all(step.items.map(async (item) => {
        const pos = itemPositions.get(item.id)
        if (!pos) return
        const el = spawnItemEl(item)

        await animate(el, {
          left:    pos.x - ITEM_SIZE / 2,
          top:     pos.y - ITEM_SIZE / 2,
          opacity: [0, 1],
          duration: FLOAT_UP_DUR,
          ease: 'outCubic',
        }).finished

        const inner = el.querySelector('.sm-item-inner')
        if (inner) {
          inner.classList.add('sm-item-bob')
          inner.style.animationDelay = `${Math.random() * 2.4}s`
        }
      }))

      chestEl.src = chestPng
      if (chestGlowEl) {
        animate(chestGlowEl, { opacity: 0, duration: 300, ease: 'outSine' })
      }
      await new Promise(r => setTimeout(r, 400))
    }

    setBatchLabel('')
    onComplete()
  }, [items, forumTier, bodyRef, chestRef, chestGlowRef, onComplete, onJackpot, onItemSelect])

  useEffect(() => {
    const t = setTimeout(runSequence, 200)
    return () => clearTimeout(t)
  }, [runSequence])

  return (
    <>
      {/* cloud zone — imperative items float up here */}
      <div
        ref={cloudRef}
        className="sm-cloud"
      />
      {batchLabel && (
        <div className="sm-batch-label">{batchLabel}</div>
      )}
    </>
  )
}

// ── Inspect cloud ─────────────────────────────────────────────────────────────

function InspectCloud({ items, bodyRef, onItemSelect }) {
  const [positions, setPositions] = useState([])

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const bodyW  = body.clientWidth
    const bodyH  = body.clientHeight
    const cloudH = bodyH * CLOUD_FRACTION
    setPositions(calcItemPositions(items.length, cloudH, bodyW, ITEM_SIZE, MIN_ITEM_GAP))
  }, [items, bodyRef])

  return (
    <div className="sm-cloud">
      {items.map((item, i) => {
        const pos = positions[i]
        if (!pos) return null
        return (
          <div
            key={item.id}
            className="sm-item"
            style={{ left: pos.x - ITEM_SIZE / 2, top: pos.y - ITEM_SIZE / 2, opacity: 1 }}
            onClick={() => onItemSelect(item)}
          >
            <div
              className="sm-item-inner sm-item-bob"
              style={{ animationDelay: `${i * 0.3}s` }}
            >
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

// ── Main modal ────────────────────────────────────────────────────────────────

export default function ShipmentModal({ townId, onClose }) {
  const { playerData, uid, save } = usePlayer()

  const forumTier  = playerData?.travel?.forum?.tier ?? 1
  const reputation = playerData?.travel?.towns?.[townId]?.reputation ?? 0

  const [phase, setPhase]               = useState('preroll')
  const [rolling, setRolling]           = useState(false)
  const [rolledItems, setRolledItems]   = useState([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [error, setError]               = useState(null)

  // refs shared between main modal and AnimationStage
  const bodyRef      = useRef(null)
  const chestRef     = useRef(null)
  const chestGlowRef = useRef(null)

  const { effective, maxTierIndex } = getTierWeights(reputation, forumTier)
  const jackpots     = JACKPOT_CHANCE[forumTier] ?? {}
  const displayTiers = TIER_ORDER.slice(0, maxTierIndex + 1)
  const maxPct       = Math.max(...displayTiers.map(t => effective[t] ?? 0))

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

      const existing = playerData?.equipment ?? []
      save({ equipment: [...existing, ...data.items] })
      setRolledItems(data.items)
      setPhase('animating')
    } catch (err) {
      setError('Failed to connect. Try again.')
      setRolling(false)
      console.error(err)
    }
  }

  const handleAnimationComplete = useCallback(() => setPhase('inspect'), [])
  const handleJackpot = useCallback(() => setShowConfetti(true), [])

  const handleStar = (instance) => {
    const updated = (playerData?.equipment ?? []).map(i =>
      i.id === instance.id ? { ...i, starred: !i.starred } : i
    )
    save({ equipment: updated })
  }

  const buttonLabel = phase === 'inspect' ? 'Collect'
    : rolling ? 'Rolling...'
    : phase === 'animating' ? '···'
    : 'Roll Shipment'

  const handleButtonClick = () => {
    if (phase === 'preroll' && !rolling) handleRoll()
    if (phase === 'inspect') onClose()
  }

  return (
    <>
      <div className="sm-backdrop">
        <div className="sm-modal">

          {/* ── Header ── */}
          <div className="sm-header">
            <h2>Incoming Shipment</h2>
            <button className="sm-close-btn" onClick={onClose}>×</button>
          </div>

          {/* ── Body — everything lives here ── */}
          <div className="sm-body" ref={bodyRef}>

            <div className="sm-top-zone">
              {/* preroll tier info — only shown before rolling */}
              {phase === 'preroll' && (
                <div className="sm-preroll-info">
                  <p className="sm-subtitle">Tier distribution · {reputation} rep</p>

                  <div className="sm-tier-table">
                    {displayTiers.map(tier => {
                      const pct      = (effective[tier] ?? 0) * 100
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
              )}

              {/* animation cloud — mounts when animating */}
              {phase === 'animating' && (
                <AnimationStage
                  items={rolledItems}
                  forumTier={forumTier}
                  bodyRef={bodyRef}
                  chestRef={chestRef}
                  chestGlowRef={chestGlowRef}
                  onComplete={handleAnimationComplete}
                  onJackpot={handleJackpot}
                  onItemSelect={setSelectedItem}
                />
              )}

              {/* inspect cloud — mounts when animation done */}
              {phase === 'inspect' && (
                <InspectCloud
                  items={rolledItems}
                  bodyRef={bodyRef}
                  onItemSelect={setSelectedItem}
                />
              )}

              {error && <p className="sm-error">{error}</p>}
            </div>

            {/* ── Bottom — chest + button, always here, never moves ── */}
            <div className="sm-bottom">
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

              <button
                className="sm-roll-btn"
                onClick={handleButtonClick}
                disabled={phase === 'animating' || rolling}
              >
                {buttonLabel}
              </button>
            </div>

          </div>
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