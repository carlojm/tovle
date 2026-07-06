import { useState } from 'react'
import { User } from 'lucide-react'
import { isFrozen } from '../engine/effects.js'
import './CombatGrid.css'
import { motion, AnimatePresence } from 'framer-motion'

import abilityIcon       from '../../assets/depths_icons/normal_room_with_ability_reward.png'
import eliteAbilityIcon  from '../../assets/depths_icons/elite_room_with_ability_reward.png'
import upgradeIcon       from '../../assets/depths_icons/normal_room_with_upgrade_reward.png'
import eliteUpgradeIcon  from '../../assets/depths_icons/elite_room_with_upgrade_reward.png'
import treasureIcon      from '../../assets/depths_icons/normal_room_with_treasure_reward.png'
import eliteTreasureIcon from '../../assets/depths_icons/elite_room_with_treasure_reward.png'

const REWARD_ICONS = {
  ability:        abilityIcon,
  elite_ability:  eliteAbilityIcon,
  upgrade:        upgradeIcon,
  elite_upgrade:  eliteUpgradeIcon,
  treasure:       treasureIcon,
  elite_treasure: eliteTreasureIcon,
}

// Compute which room cells should be highlighted given selected card + hovered cell
function getHighlightedCells(selectedCard, hoveredCell, gridWidth, gridHeight, enemies, gridState) {
  if (!selectedCard) return new Set()

  const key = (r, c) => `${r},${c}`
  const inBounds = (r, c) => r >= 0 && r < gridHeight && c >= 0 && c < gridWidth
  const highlighted = new Set()

  const pattern = selectedCard.attackPattern

  // Fixed patterns that don't need hover position
  if (pattern === 'front_row' || pattern === 'row_wide') {
    for (let c = 0; c < gridWidth; c++) highlighted.add(key(0, c))
    return highlighted
  }

  if (pattern === 'front_2rows_wide' || pattern === 'row2') {
    for (let c = 0; c < gridWidth; c++) {
      highlighted.add(key(0, c))
      highlighted.add(key(1, c))
    }
    return highlighted
  }

  if (pattern === 'all_enemies') {
    for (const e of enemies) highlighted.add(key(e.cell.row, e.cell.col))
    return highlighted
  }

  if (pattern === 'all_frozen') {
    for (const k of gridState.frozenTiles) highlighted.add(k)
    return highlighted
  }

  if (pattern === 'none') return highlighted

  // Patterns that need hover position — return empty if no hover
  if (!hoveredCell) return highlighted

  switch (pattern) {
    case 'single':
      highlighted.add(key(hoveredCell.row, hoveredCell.col))
      break

    case 'row':
    case 'row_select':
      for (let c = 0; c < gridWidth; c++) {
        highlighted.add(key(hoveredCell.row, c))
      }
      break

    case 'col':
      for (let r = 0; r < gridHeight; r++) {
        highlighted.add(key(r, hoveredCell.col))
      }
      break

    case 'col_first': {
      // find lowest row index enemy in the hovered column
      const inCol = enemies
        .filter(e => e.cell.col === hoveredCell.col)
        .sort((a, b) => a.cell.row - b.cell.row)
      if (inCol.length > 0) highlighted.add(key(inCol[0].cell.row, inCol[0].cell.col))
      else highlighted.add(key(hoveredCell.row, hoveredCell.col))
      break
    }

    case 'aoe2x2':
      for (let dr = 0; dr <= 1; dr++) {
        for (let dc = 0; dc <= 1; dc++) {
          const r = hoveredCell.row + dr
          const c = hoveredCell.col + dc
          if (inBounds(r, c)) highlighted.add(key(r, c))
        }
      }
      break

    case 'aoe3x3':
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = hoveredCell.row + dr
          const c = hoveredCell.col + dc
          if (inBounds(r, c)) highlighted.add(key(r, c))
        }
      }
      break
    
    case 'aoe3x2':
      for (let dr = 0; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = hoveredCell.row + dr
          const c = hoveredCell.col + dc
          if (inBounds(r, c)) highlighted.add(key(r, c))
        }
      }
      break

    case 'x_shape':
      for (let d = -2; d <= 2; d++) {
        if (d === 0) continue
        const r1 = hoveredCell.row + d, c1 = hoveredCell.col + d
        const r2 = hoveredCell.row + d, c2 = hoveredCell.col - d
        if (inBounds(r1, c1)) highlighted.add(key(r1, c1))
        if (inBounds(r2, c2)) highlighted.add(key(r2, c2))
      }
      highlighted.add(key(hoveredCell.row, hoveredCell.col))
      break

    default:
      highlighted.add(key(hoveredCell.row, hoveredCell.col))
      break
  }

  return highlighted
}

function EnemyCell({ enemies }) {
  if (enemies.length === 0) return null
  // show first enemy prominently, stack indicator if multiple
  const primary = enemies[0]
  const hpPct = Math.round((primary.hp / primary.maxHp) * 100)
  const barColor = hpPct > 50 ? '#4a8' : hpPct > 25 ? '#a84' : '#a44'
  const actionPct = Math.round((primary.actionBar / primary.actionBarMax) * 100)

  return (
    <AnimatePresence>
      <motion.div
        key={primary.instanceId}
        layoutId={primary.instanceId}
        className="cg-enemy"
        layout
        transition={{ duration: 0.25, ease: 'easeInOut' }}
      >
        <span className="cg-enemy-emoji">{primary.emoji}</span>
        {enemies.length > 1 && (
          <span className="cg-enemy-stack">+{enemies.length - 1}</span>
        )}
        {primary.enraged && <span className="cg-enemy-enraged">!</span>}
        <div className="cg-enemy-bars">
          <div className="cg-bar-track">
            <div className="cg-bar-fill cg-bar-hp" style={{ width: `${hpPct}%`, background: barColor }} />
          </div>
          <div className="cg-bar-track">
            <div className="cg-bar-fill cg-bar-action" style={{ width: `${actionPct}%` }} />
          </div>
        </div>
        {primary.statuses.length > 0 && (
          <div className="cg-status-dots">
            {primary.statuses.map((s, i) => (
              <span key={i} className={`cg-status-dot cg-status-dot--${s.type}`} />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}


export default function CombatGrid({ gridState, enemies, currentRoom, selectedCard, onCellTap }) {
  const [hoveredCell, setHoveredCell] = useState(null)

  const { width, height } = gridState
  const displayCols = width + 2
  const displayRows = height + 2

  // center column of the room in display coords
  const centerDisplayCol = Math.floor(displayCols / 2)

  const rewardIcon = currentRoom ? REWARD_ICONS[currentRoom.type] : null

  // auto-highlight fixed patterns even without hover
  const autoFixed = selectedCard && [
    'front_row', 'row_wide', 'front_2rows_wide', 'row2', 'none'
  ].includes(selectedCard.attackPattern)
  const highlightedCells = getHighlightedCells(
    selectedCard,
    autoFixed ? { row: 0, col: 0 } : hoveredCell,
    width,
    height,
    enemies,
    gridState,
  )

  const cells = []

  for (let displayRow = displayRows - 1; displayRow >= 0; displayRow--) {
    for (let displayCol = 0; displayCol < displayCols; displayCol++) {

      // is this a margin cell?
      const isTopMargin    = displayRow === displayRows - 1
      const isBottomMargin = displayRow === 0
      const isLeftMargin   = displayCol === 0
      const isRightMargin  = displayCol === displayCols - 1
      const isMargin = isTopMargin || isBottomMargin || isLeftMargin || isRightMargin

      // player cell — bottom margin, center col
      const isPlayer = isBottomMargin && displayCol === centerDisplayCol

      // exit cell — top margin, center col
      const isExit = isTopMargin && displayCol === centerDisplayCol

      if (isMargin) {
        cells.push(
          <div
            key={`${displayRow}-${displayCol}`}
            className={`cg-cell cg-cell--margin ${isPlayer ? 'cg-cell--player' : ''} ${isExit ? 'cg-cell--exit' : ''}`}
          >
            {isPlayer && <User size="60%" strokeWidth={1.5} className="cg-player-icon" />}
            {isExit && rewardIcon && <img src={rewardIcon} alt="reward" className="cg-exit-icon" />}
          </div>
        )
        continue
      }

      // room cell — convert display coords to room coords
      const roomRow = displayRow - 1
      const roomCol = displayCol - 1

      const cellKey = `${roomRow},${roomCol}`
      const frozen = isFrozen({ gridState }, { row: roomRow, col: roomCol })
      const token = gridState.tokens.find(t => t.cell.row === roomRow && t.cell.col === roomCol)
      const cellEnemies = enemies.filter(e => e.cell.row === roomRow && e.cell.col === roomCol)
      const isHighlighted = highlightedCells.has(cellKey)
      const hasEnemy = cellEnemies.length > 0

      cells.push(
        <div
          key={`${displayRow}-${displayCol}`}
          className={[
            'cg-cell cg-cell--room',
            frozen        ? 'cg-cell--frozen'     : '',
            isHighlighted ? 'cg-cell--highlighted' : '',
            hasEnemy      ? 'cg-cell--has-enemy'   : '',
            selectedCard  ? 'cg-cell--targeting'   : '',
          ].join(' ')}
          onMouseEnter={() => selectedCard && setHoveredCell({ row: roomRow, col: roomCol })}
          onMouseLeave={() => setHoveredCell(null)}
          onClick={() => selectedCard && onCellTap({ row: roomRow, col: roomCol })}
        >
          {token && !hasEnemy && <span className="cg-token">📌</span>}
        </div>
      )
    }
  }

  return (
    <div className="cg-wrapper">
      <div
        className="cg-grid"
        style={{
          gridTemplateColumns: `repeat(${displayCols}, 1fr)`,
          gridTemplateRows: `repeat(${displayRows}, 1fr)`,
          position: 'relative',
        }}
        ref={gridRef => {
          // store ref for enemy positioning
          if (gridRef) gridRef._depthsleGrid = true
        }}
        id="cg-grid-inner"
      >
        {cells}

        {/* Enemy overlay layer — siblings in same grid context */}
        <AnimatePresence>
          {enemies.map(enemy => {
            const stackedEnemies = enemies.filter(e =>
              e.cell.row === enemy.cell.row && e.cell.col === enemy.cell.col
            )
            const stackCount = stackedEnemies.length
            const stackIndex = stackedEnemies.findIndex(e => e.instanceId === enemy.instanceId)

            const cssGridRow = displayRows - (enemy.cell.row + 1)
            const cssGridCol = enemy.cell.col + 2

            const topPct = ((cssGridRow - 1) / displayRows) * 100
            const leftPct = ((cssGridCol - 1) / displayCols) * 100
            const widthPct = (1 / displayCols) * 100
            const heightPct = (1 / displayRows) * 100

            // subdivide cell for stacked enemies
            let subLeft = 0
            let subTop = 0
            let subWidth = 1
            let subHeight = 1

            if (stackCount === 2) {
              subWidth = 0.5
              subLeft = stackIndex * 0.5
            } else if (stackCount === 3) {
              if (stackIndex < 2) {
                subWidth = 0.5
                subHeight = 0.5
                subLeft = stackIndex * 0.5
                subTop = 0
              } else {
                subWidth = 1
                subHeight = 0.5
                subTop = 0.5
              }
            } else if (stackCount >= 4) {
              subWidth = 0.5
              subHeight = 0.5
              subLeft = (stackIndex % 2) * 0.5
              subTop = Math.floor(stackIndex / 2) * 0.5
            }

            const hpPct = Math.round((enemy.hp / enemy.maxHp) * 100)
            const barColor = hpPct > 50 ? '#4a8' : hpPct > 25 ? '#a84' : '#a44'
            const actionPct = Math.round((enemy.actionBar / enemy.actionBarMax) * 100)

            return (
              <motion.div
                key={enemy.instanceId}
                layoutId={enemy.instanceId}
                className="cg-enemy-overlay"
                style={{
                  position: 'absolute',
                  top: `calc(${topPct}% + ${subTop * heightPct}%)`,
                  left: `calc(${leftPct}% + ${subLeft * widthPct}%)`,
                  width: `${widthPct * subWidth}%`,
                  height: `${heightPct * subHeight}%`,
                }}
                layout
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <span className="cg-enemy-emoji">{enemy.emoji}</span>
                {enemy.enraged && <span className="cg-enemy-enraged">!</span>}
                <div className="cg-enemy-bars">
                  <div className="cg-bar-track">
                    <div className="cg-bar-fill cg-bar-hp" style={{ width: `${hpPct}%`, background: barColor }} />
                  </div>
                  <div className="cg-bar-track">
                    <div className="cg-bar-fill cg-bar-action" style={{ width: `${actionPct}%` }} />
                  </div>
                </div>
                {enemy.statuses.length > 0 && (
                  <div className="cg-status-dots">
                    {enemy.statuses.map((s, i) => (
                      <span key={i} className={`cg-status-dot cg-status-dot--${s.type}`} />
                    ))}
                  </div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}