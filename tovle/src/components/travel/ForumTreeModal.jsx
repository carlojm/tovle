import { useState, useRef, useCallback, useEffect, memo } from 'react'
import { X } from 'lucide-react'
import { FORUM_NODES } from './forumNodes'
import './ForumTreeModal.css'

import spritesheetUrl from './ForumGame/Tovle16.png'
const COLS = 14
const SPRITE_SIZE = 16
const DISPLAY_SIZE = 40 // rendered size in the node
// const NODE_FRAME = {}
// FORUM_NODES.forEach((node, i) => {
//   NODE_FRAME[node.id] = i
// })

const NODE_FRAME = {
  // Row 0 (frames 0-10)
  forum_core:          0,
  blocks_per_tap_1:    1,
  daily_runs_1:        2,
  fuel_cap_1:          3,
  revive:              4,
  fuel_efficiency_1:   5,
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

function getNodeState(node, upgrades) {
  const level = upgrades[node.id] ?? 0
  if (level >= node.maxLevel) return 'maxed'
  if (level > 0) return 'partial'
  if (node.parent.length === 0) return 'available'

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
        <span className="ftm-cost ftm-cost--crystal">
          <span className="ftm-cost-icon">◆</span>
          {cost.crystals}
        </span>
      )}
      {cost.shards > 0 && (
        <span className="ftm-cost ftm-cost--shard">
          <span className="ftm-cost-icon">◈</span>
          {cost.shards}
        </span>
      )}
      {cost.hearts > 0 && (
        <span className="ftm-cost ftm-cost--heart">
          <span className="ftm-cost-icon">♥</span>
          {cost.hearts}
        </span>
      )}
    </div>
  )
}

const TreeNode = memo(function TreeNode({ node, state, isSelected, onClick }) {
  const level = 0 // will come from upgrades later
  return (
    <div
      className={`ftm-node ftm-node--${state} ${isSelected ? 'ftm-node--selected' : ''}`}
      style={{
        left: node.cx - NODE_SIZE / 2,
        top:  node.cy - NODE_SIZE / 2,
        width: NODE_SIZE,
        height: NODE_SIZE,
      }}
      onClick={() => onClick(node)}
    >
      <div className="ftm-node-icon">
        {/* <span className="ftm-node-placeholder">{node.label[0]}</span> */}
        <div style={{
          width: DISPLAY_SIZE,
          height: DISPLAY_SIZE,
          backgroundImage: `url(${spritesheetUrl})`,
          backgroundSize: `${COLS * DISPLAY_SIZE}px auto`,
          backgroundPosition: `-${(NODE_FRAME[node.id] % COLS) * DISPLAY_SIZE}px -${Math.floor(NODE_FRAME[node.id] / COLS) * DISPLAY_SIZE}px`,
          imageRendering: 'pixelated',
        }} />
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

const NODE_MAP = computeLayout(FORUM_NODES)

export default function ForumTreeModal({ onClose, upgrades = {}, currencies = {} }) {
  const [selectedNode, setSelectedNode] = useState(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const isPanning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const containerRef = useRef(null)

  const activePointers = useRef({})
  const lastPinchDist = useRef(null)

  const nodeMap = NODE_MAP

  // center view on forum_core on mount
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const { width, height } = el.getBoundingClientRect()
    setTransform({ x: width / 2, y: height / 2, scale: 1 })

    const prevent = (e) => e.preventDefault()
    el.addEventListener('wheel', prevent, { passive: false })
    return () => el.removeEventListener('wheel', prevent)
  }, [])

  const onPointerDown = useCallback((e) => {
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
        setTransform(t => ({
          ...t,
          scale: Math.max(0.4, Math.min(2.5, t.scale * delta))
        }))
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
    setTransform(t => ({
      ...t,
      scale: Math.max(0.4, Math.min(2.5, t.scale * delta))
    }))
  }, [])

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

  return (
    <div className="ftm-overlay">
      <div className="ftm-modal">

        {/* header */}
        <div className="ftm-header">
          <span className="ftm-title">Forum Upgrades</span>
          <div className="ftm-currencies">
            <span className="ftm-currency ftm-currency--crystal">
              ◆ {currencies.crystals ?? 0}
            </span>
            <span className="ftm-currency ftm-currency--shard">
              ◈ {currencies.shards ?? 0}
            </span>
            <span className="ftm-currency ftm-currency--heart">
              ♥ {currencies.hearts ?? 0}
            </span>
          </div>
          <button className="ftm-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* tree canvas */}
        <div
          className="ftm-canvas"
          ref={containerRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
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
                state={getNodeState(node, upgrades)}
                isSelected={selectedNode?.id === node.id}
                onClick={setSelectedNode}
              />
            ))}
          </div>
        </div>

        {/* info bar */}
        <div className="ftm-info">
          {selectedNode ? (
            <>
              <div className="ftm-info-text">
                <span className="ftm-info-label">{selectedNode.label}</span>
                <span className="ftm-info-desc">{selectedNode.description}</span>
              </div>
              {nextCost && (
                <div className="ftm-info-action">
                  <CurrencyCost cost={nextCost} />
                  <button className="ftm-buy-btn">
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