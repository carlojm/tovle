import { useState, useRef, useCallback, useEffect, memo } from 'react'
import { X } from 'lucide-react'
import { FORUM_NODES } from './forumNodes'
import './ForumTreeModal.css'
import { usePlayer } from '../../context/PlayerContext'
import { ITEM_MAP } from '../../data/itemMap'
import spritesheetUrl from './ForumGame/Tovle16.png'
const COLS = 14
const SPRITE_SIZE = 16
const DISPLAY_SIZE = 40 // rendered size in the node
// const NODE_FRAME = {}
// FORUM_NODES.forEach((node, i) => {
//   NODE_FRAME[node.id] = i
// })

import { computeForumUnlocks, calculatePrestigeHearts } from './forumUnlocks'

const NODE_FRAME = {
  // Row 0 (frames 0-10)
  forum_core:          0,
  blocks_per_tap_1:    1,
  daily_runs_1:        2,
  fuel_cap_1:          3,
  fuel_cap_2:          3,
  fuel_cap_3:          3,
  revive:              4,
  fuel_efficiency_1:   5,
  fuel_saver_permanent:5,
  forum_tier_1:        6,
  alnera_unlock:       7,
  axolotl_3:           8,
  auto_feed:           9,
  bulk_cache_open:     10,
  // 11, 12, 13 are empty

  // Row 1 (frames 14-27)
  speed_curb_1:              14,
  speed_curb_2:              15,
  speed_curb_3:              16,
  speed_curb_4:              17,
  starting_width:            18,
  perfect_placement:         19,
  perfect_threshold_1:       20,
  crystal_active_gain_1:     21,
  crystal_active_gain_2:     22,
  anchor_unlock:             23,
  anchor_chance_1:           24,
  perfect_anchor:            25,
  perfect_anchor_chance_1:   26,
  perfect_anchor_growth_1:   27,

  // Row 2 (frames 28-35)
  crystal_gain_1:        28,
  crystal_gain_2:        29,
  crystal_gain_3:        30,
  crystal_multiplier_permanent: 30,
  shards_unlock:         31,
  shard_active_gain_1:   32,
  shard_active_gain_2:   33,
  shard_passive_gain_1:  34,
  hearts_unlock:         35,
  // 36-41 are empty

  // Row 3 (frames 42-48)
  bubble_unlock:         42,
  bubble_chance_1:       43,
  bubble_amount_1:       44,
  crit_chain_1:          45,
  crit_anchor_unlock:    46,
  crit_anchor_chance_1:  47,
  luck_multiplier_permanent: 47,
  crit_anchor_growth_1:  48,
}

const NODE_SIZE = 64
const STEP = 130       // distance between parent and child
const SIBLING_GAP = 90 // gap between siblings at same depth

// direction vectors
const DIR = {
  N: { x: 0,  y: -1 },
  S: { x: 0,  y:  1 },
  E: { x: 1,  y:  0 },
  W: { x: -1, y:  0 },
}

// perpendicular axis for spreading siblings
const PERP = {
  N: 'x', S: 'x', E: 'y', W: 'y',
}

function computeLayout(nodes) {
  const map = {}
  nodes.forEach(n => { map[n.id] = { ...n } })

  // build children map
  const childrenOf = {}
  nodes.forEach(n => {
    n.parent.forEach(pid => {
      if (!childrenOf[pid]) childrenOf[pid] = []
      childrenOf[pid].push(n.id)
    })
  })

  // assign positions via BFS from forum_core
  const positioned = new Set()
  const queue = ['forum_core']
  map['forum_core'].cx = 0
  map['forum_core'].cy = 0
  positioned.add('forum_core')

  while (queue.length > 0) {
    const parentId = queue.shift()
    const parent = map[parentId]
    const children = (childrenOf[parentId] || []).filter(id => !positioned.has(id))

    // group children by direction
    const byDir = {}
    children.forEach(cid => {
      const dir = map[cid].direction || 'E'
      if (!byDir[dir]) byDir[dir] = []
      byDir[dir].push(cid)
    })

    Object.entries(byDir).forEach(([dir, siblings]) => {
      const vec = DIR[dir]
      const perpAxis = PERP[dir]
      const count = siblings.length
      const totalSpan = (count - 1) * SIBLING_GAP

      siblings.forEach((cid, i) => {
        const offset = -totalSpan / 2 + i * SIBLING_GAP
        const node = map[cid]
        node.cx = parent.cx + vec.x * STEP + (perpAxis === 'x' ? offset : 0)
        node.cy = parent.cy + vec.y * STEP + (perpAxis === 'y' ? offset : 0)
        if (node.x !== undefined) node.cx += node.x
        if (node.y !== undefined) node.cy += node.y
        positioned.add(cid)
        queue.push(cid)
      })
    })
  }

  return map
}

function getNodeState(node, upgrades, totalPrestiges) {
  const level = upgrades[node.id] ?? 0
  if (level >= node.maxLevel) return 'maxed'
  if (level > 0) return 'partial'
  if (node.parent.length === 0) return 'available'

  //prestige nodes are available after first prestige
  if (node.permanent && ((totalPrestiges ?? 0) >= 1 || (upgrades['hearts_unlock'] ?? 0) >= 1)) return 'available'

  //check if any parent is unlocked
  const anyParentUnlocked = node.parent.some(pid => (upgrades[pid] ?? 0) >= 1)
  if (!anyParentUnlocked) return 'locked'

  //check hidden reqs, must meet all of them
  if (node.hidden_requirement) {
    const allHiddenMet = node.hidden_requirement.every(rid => (upgrades[rid] ?? 0) >= 1)
    if (!allHiddenMet) return 'locked'
  }

  return 'available'
}

function CurrencyCost({ cost }) {
  return (
    <div className="ftm-cost-row">
      {cost.crystals > 0 && (
        <span className="ftm-cost ftm-currency--crystal">
          <img src={ITEM_MAP.prismarine_crystals.img} className="ftm-cost-icon" />
          {cost.crystals}
        </span>
      )}
      {cost.shards > 0 && (
        <span className="ftm-cost ftm-currency--shard">
          <img src={ITEM_MAP.prismarine_shard.img} className="ftm-cost-icon" />
          {cost.shards}
        </span>
      )}
      {cost.hearts > 0 && (
        <span className="ftm-cost ftm-currency--heart">
          <img src={ITEM_MAP.heart_of_the_sea.img} className="ftm-cost-icon" />
          {cost.hearts}
        </span>
      )}
    </div>
  )
}

const TreeNode = memo(function TreeNode({ node, state, isSelected, onClick, level, affordable}) {
  // const level = 0 // will come from upgrades later
  return (
    <div
      className={`ftm-node ftm-node--${state} ${isSelected ? 'ftm-node--selected' : '' } ${!affordable && state !== 'maxed' ? 'ftm-node--unaffordable' : ''}`}
      style={{
        left: node.cx - NODE_SIZE / 2,
        top:  node.cy - NODE_SIZE / 2,
        width: NODE_SIZE,
        height: NODE_SIZE,
      }}
      onClick={() => onClick(node)}
    >
      <div className="ftm-node-icon">
        {state === 'locked' ? (
          <span className="ftm-node-placeholder">?</span>
        ) : (
          <div style={{
            width: DISPLAY_SIZE,
            height: DISPLAY_SIZE,
            backgroundImage: `url(${spritesheetUrl})`,
            backgroundSize: `${COLS * DISPLAY_SIZE}px auto`,
            backgroundPosition: `-${(NODE_FRAME[node.id] % COLS) * DISPLAY_SIZE}px -${Math.floor(NODE_FRAME[node.id] / COLS) * DISPLAY_SIZE}px`,
            imageRendering: 'pixelated',
            filter: 'drop-shadow(2px 2px 2px rgba(0, 0, 0, 0.9))',
          }} />
        )}
      </div>
      {node.maxLevel > 1 && (
        <div className="ftm-node-pips">
          {Array.from({ length: node.maxLevel }, (_, i) => (
            <span
              key={i}
              className={`ftm-pip ${i < level ? 'ftm-pip--filled' : ''}`}
            />
          ))}
        </div>
      )}
    </div>
  )
})

const ConnectionLines = memo(function ConnectionLines({ nodeMap, nodes }) {
  const lines = []
  nodes.forEach(node => {
    node.parent.forEach(pid => {
      const parent = nodeMap[pid]
      if (!parent) return
      lines.push(
        <line
          key={`${pid}-${node.id}`}
          x1={parent.cx}
          y1={parent.cy}
          x2={node.cx}
          y2={node.cy}
          className="ftm-line"
        />
      )
    })
  })
  return <>{lines}</>
})

const canAfford = (cost, currencies) => {
  if (!cost) return false
  if ((cost.crystals ?? 0) > (currencies.crystals ?? 0)) return false
  if ((cost.shards   ?? 0) > (currencies.shards   ?? 0)) return false
  if ((cost.hearts   ?? 0) > (currencies.hearts   ?? 0)) return false
  return true
}

const NODE_MAP = computeLayout(FORUM_NODES)

export default function ForumTreeModal({ onClose }) {
  const { uid, playerData, save } = usePlayer()
  const upgrades = playerData?.travel?.forum?.upgrades ?? {}
  const currencies = playerData?.travel?.forum?.currencies ?? { crystals: 0, shards: 0, hearts: 0 }
  const [selectedNode, setSelectedNode] = useState(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const isPanning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const containerRef = useRef(null)

  const [prestigeConfirm, setPrestigeConfirm] = useState(false)

  const activePointers = useRef({})
  const lastPinchDist = useRef(null)

  const nodeMap = NODE_MAP

  // center view on forum_core on mount
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const { width, height } = el.getBoundingClientRect()
    setTransform({ x: width / 2, y: height / 2, scale: 0.65 }) //start at 0.65

    const prevent = (e) => e.preventDefault()
    el.addEventListener('wheel', prevent, { passive: false })
    return () => el.removeEventListener('wheel', prevent)
  }, [])

  const onPointerDown = useCallback((e) => {
    e.preventDefault()
    activePointers.current[e.pointerId] = { x: e.clientX, y: e.clientY }
    if (e.target.closest('.ftm-node')) return
    isPanning.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e) => {
    activePointers.current[e.pointerId] = { x: e.clientX, y: e.clientY }
    const pointers = Object.values(activePointers.current)

    if (pointers.length === 2) {
      const dist = Math.hypot(
        pointers[0].x - pointers[1].x,
        pointers[0].y - pointers[1].y
      )

      if (lastPinchDist.current !== null) {
        const delta = dist / lastPinchDist.current

        const midX = (pointers[0].x + pointers[1].x) / 2
        const midY = (pointers[0].y + pointers[1].y) / 2

        const rect = containerRef.current.getBoundingClientRect()
        const localX = midX - rect.left
        const localY = midY - rect.top

        setTransform(t => {
          const newScale = Math.max(0.4, Math.min(2.5, t.scale * delta))
          const worldX = (localX - t.x) / t.scale
          const worldY = (localY - t.y) / t.scale
          const newX = localX - worldX * newScale
          const newY = localY - worldY * newScale
          return { x: newX, y: newY, scale: newScale }
        })
      }

      lastPinchDist.current = dist
      return
    }

    if (!isPanning.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }))
  }, [])

  const onPointerUp = useCallback((e) => {
    delete activePointers.current[e.pointerId]
    lastPinchDist.current = null
    isPanning.current = false
  }, [])

  const onWheel = useCallback((e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1

    const rect = containerRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    setTransform(t => {
      const newScale = Math.max(0.4, Math.min(2.5, t.scale * delta))

      // world point under the cursor before scaling
      const worldX = (mouseX - t.x) / t.scale
      const worldY = (mouseY - t.y) / t.scale

      // after scaling, that world point should still be under the cursor
      const newX = mouseX - worldX * newScale
      const newY = mouseY - worldY * newScale

      return { x: newX, y: newY, scale: newScale }
    })
  }, [])

  const handlePurchase = async () => {
    if (!selectedNode) return

    const currentLevel = upgrades[selectedNode.id] ?? 0
    if (currentLevel >= selectedNode.maxLevel) return

    const cost = selectedNode.costs[currentLevel]
    if (!cost) return

    // check affordability
    if ((cost.crystals ?? 0) > (currencies.crystals ?? 0)) return
    if ((cost.shards ?? 0) > (currencies.shards ?? 0)) return
    if ((cost.hearts ?? 0) > (currencies.hearts ?? 0)) return

    const newUpgrades = {
      ...upgrades,
      [selectedNode.id]: currentLevel + 1,
    }

    const newCurrencies = {
      crystals: Math.round(((currencies.crystals ?? 0) - (cost.crystals ?? 0)) * 10) / 10,
      shards:   Math.round(((currencies.shards   ?? 0) - (cost.shards   ?? 0)) * 10) / 10,
      hearts:   Math.round(((currencies.hearts   ?? 0) - (cost.hearts   ?? 0)) * 10) / 10,
    }

    save({
      'travel.forum.upgrades': newUpgrades,
      'travel.forum.currencies': newCurrencies,
    })

    //special case for axolotl
    if (selectedNode.id === 'axolotl_3') {
      if (selectedNode.id === 'axolotl_3' && (playerData?.axolotls?.length ?? 0) >= 3) return
      try {
        const res = await fetch('/api/create-axolotl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid })
        })
        const data = await res.json()
        if (res.ok) {
          const currentAxolotls = playerData?.axolotls ?? []
          save({ axolotls: [...currentAxolotls, data.axolotl] })
        } else {
          console.error('Failed to create axolotl:', data.error)
        }
      } catch (err) {
        console.error('Failed to create axolotl:', err)
      }
    }
  }

  const handlePrestige = () => {
    if (heartsPreview < 1) return

    if (!prestigeConfirm) {
      setPrestigeConfirm(true)
      setTimeout(() => setPrestigeConfirm(false), 3000)
      return
    }

    const permanentUpgrades = Object.fromEntries(
      Object.entries(upgrades).filter(([id]) => {
        const node = FORUM_NODES.find(n => n.id === id)
        return node?.permanent === true
      })
    )

    save({
      'travel.forum.upgrades': permanentUpgrades,
      'travel.forum.currencies.crystals': 0,
      'travel.forum.currencies.shards': 0,
      'travel.forum.currencies.hearts': Math.round(((currencies.hearts ?? 0) + heartsPreview) * 10) / 10,
      'stats.bestPrestigeTowerHeight': 0,
      'stats.totalPrestigeCrystalsEarned': 0,
      'stats.totalPrestigeShardsEarned': 0,
      'stats.totalPrestigeFuelSpent': 0,
      'stats.totalPrestiges': (playerData?.stats?.totalPrestiges ?? 0) + 1,
      'stats.totalHeartsEarned': Math.round(((playerData?.stats?.totalHeartsEarned ?? 0) + heartsPreview) * 10) / 10,
    })

    setPrestigeConfirm(false)
  }

  // compute SVG bounds to fit all nodes
  const allNodes = Object.values(nodeMap)
  const xs = allNodes.map(n => n.cx)
  const ys = allNodes.map(n => n.cy)
  const minX = Math.min(...xs) - 100
  const minY = Math.min(...ys) - 100
  const maxX = Math.max(...xs) + 100
  const maxY = Math.max(...ys) + 100
  const svgW = maxX - minX
  const svgH = maxY - minY

  const nextCost = selectedNode
    ? selectedNode.costs[(upgrades[selectedNode.id] ?? 0)]
    : null

  const nodeState = selectedNode ? getNodeState(selectedNode, upgrades, playerData?.stats?.totalPrestiges ?? 0) : null

  const heartsUnlocked = (upgrades['hearts_unlock'] ?? 0) >= 1
  const heartsPreview = calculatePrestigeHearts(playerData?.stats ?? {})

  return (
    <div className="ftm-overlay" onClick={onClose}>
      <div className="ftm-modal" onClick={e => e.stopPropagation()}>

        {/* header */}
        <div className="ftm-header">
          <span className="ftm-title">Forum Upgrades</span>
          <div className="ftm-currencies">
            <span className="ftm-currency ftm-currency--crystal">
              <img src={ITEM_MAP.prismarine_crystals.img} className="ftm-currency-icon" />
              {currencies.crystals ?? 0}
            </span>
            <span className="ftm-currency ftm-currency--shard">
              <img src={ITEM_MAP.prismarine_shard.img} className="ftm-currency-icon" />
              {currencies.shards ?? 0}
            </span>
            <span className="ftm-currency ftm-currency--heart">
              <img src={ITEM_MAP.heart_of_the_sea.img} className="ftm-currency-icon" />
              {currencies.hearts ?? 0}
            </span>
          </div>
          <button className="ftm-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* prestige band */}
        {heartsUnlocked && (
          <div className="ftm-prestige-band">
            <div className="ftm-prestige-info">
              <span className="ftm-prestige-label">
                <img src={ITEM_MAP.heart_of_the_sea.img} className="ftm-cost-icon" />
                {heartsPreview} obtained on prestige
              </span>
              <span className="ftm-prestige-sub">
                Resets currencies and non-prestige upgrades. Gain Hearts of the Sea based on progress in current prestige.
              </span>
            </div>
            <button
              className={`ftm-prestige-btn ${prestigeConfirm ? 'ftm-prestige-btn--confirm' : ''} ${heartsPreview < 1 ? 'ftm-prestige-btn--disabled' : ''}`}
              onClick={handlePrestige}
              disabled={heartsPreview < 1}
            >
              {prestigeConfirm ? 'Are you sure?' : 'Prestige'}
            </button>
          </div>
        )}

        {/* tree canvas */}
        <div
          className="ftm-canvas"
          ref={containerRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onContextMenu={e => e.preventDefault()}
        >
          <div
            className="ftm-inner"
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            }}
          >
            {/* connection lines */}
            <svg
              className="ftm-svg"
              style={{
                left: minX,
                top: minY,
                width: svgW,
                height: svgH,
              }}
              viewBox={`${minX} ${minY} ${svgW} ${svgH}`}
            >
              <ConnectionLines nodeMap={nodeMap} nodes={Object.values(nodeMap)} />
            </svg>

            {/* nodes */}
            {FORUM_NODES.map(node => (
              <TreeNode
                key={node.id}
                node={nodeMap[node.id]}
                state={getNodeState(node, upgrades, playerData?.stats?.totalPrestiges ?? 0)}
                isSelected={selectedNode?.id === node.id}
                onClick={setSelectedNode}
                level={upgrades[node.id] ?? 0}
                affordable={canAfford(node.costs[upgrades[node.id] ?? 0], currencies)}
              />
            ))}
          </div>
        </div>

        {/* info bar */}
        <div className="ftm-info">
          {selectedNode ? (
            <>
              <div className="ftm-info-text">
                {nodeState === 'locked' ? (
                  <span className="ftm-info-desc">Unlock a parent node first</span>
                ) : (
                  <>
                    <span className="ftm-info-label">{selectedNode.label}</span>
                    <span className="ftm-info-desc">{selectedNode.description}</span>
                  </>
                )}
              </div>
              {nextCost && (
                <div className="ftm-info-action">
                  {nodeState !== 'locked' && (
                    <CurrencyCost cost={nextCost} />
                  )}
                  <button
                    className={`ftm-buy-btn ${!canAfford(nextCost, currencies) || nodeState === 'locked' ? 'ftm-buy-btn--disabled' : ''}`}
                    onClick={handlePurchase}
                    disabled={!canAfford(nextCost, currencies) || nodeState === 'locked'}
                  >
                    {(upgrades[selectedNode.id] ?? 0) === 0 ? 'Unlock' : 'Upgrade'}
                  </button>
                </div>
              )}
              {!nextCost && (upgrades[selectedNode.id] ?? 0) >= selectedNode.maxLevel && (
                <span className="ftm-maxed-label">Maxed</span>
              )}
            </>
          ) : (
            <span className="ftm-info-hint">Select an upgrade to view details</span>
          )}
        </div>

      </div>
    </div>
  )
}