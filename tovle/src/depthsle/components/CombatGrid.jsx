import { useState } from 'react'
import { User } from 'lucide-react'
import { isFrozen } from '../engine/effects.js'
import './CombatGrid.css'

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
function getHighlightedCells(selectedCard, hoveredCell, gridWidth, gridHeight) {
  if (!selectedCard || !hoveredCell) return new Set()

  const key = (r, c) => `${r},${c}`
  const inBounds = (r, c) => r >= 0 && r < gridHeight && c >= 0 && c < gridWidth
  const highlighted = new Set()

  switch (selectedCard.attackPattern) {
    case 'single':
      highlighted.add(key(hoveredCell.row, hoveredCell.col))
      break

    case 'row':
      for (let c = 0; c < gridWidth; c++) {
        highlighted.add(key(hoveredCell.row, c))
      }
      break

    case 'col':
      for (let r = 0; r < gridHeight; r++) {
        highlighted.add(key(r, hoveredCell.col))
      }
      break

    case 'row_wide':
    case 'row2':
      // front row(s) always highlighted regardless of hover
      for (let c = 0; c < gridWidth; c++) {
        highlighted.add(key(0, c))
        if (selectedCard.attackPattern === 'row2') {
          highlighted.add(key(1, c))
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

    case 'x_shape':
      for (let d = -2; d <= 2; d++) {
        if (d === 0) continue
        const r1 = hoveredCell.row + d
        const c1 = hoveredCell.col + d
        const r2 = hoveredCell.row + d
        const c2 = hoveredCell.col - d
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
    <div className="cg-enemy">
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
    </div>
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
  const autoFixed = selectedCard && ['row_wide', 'row2'].includes(selectedCard.attackPattern)
  const highlightedCells = getHighlightedCells(
    selectedCard,
    autoFixed ? { row: 0, col: 0 } : hoveredCell,
    width,
    height
  )

  const cells = []

  for (let displayRow = 0; displayRow < displayRows; displayRow++) {
    for (let displayCol = 0; displayCol < displayCols; displayCol++) {

      // is this a margin cell?
      const isTopMargin    = displayRow === 0
      const isBottomMargin = displayRow === displayRows - 1
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
            {isPlayer && (
              <User size="60%" strokeWidth={1.5} className="cg-player-icon" />
            )}
            {isExit && rewardIcon && (
              <img src={rewardIcon} alt="reward" className="cg-exit-icon" />
            )}
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

      const handleMouseEnter = () => {
        if (selectedCard) setHoveredCell({ row: roomRow, col: roomCol })
      }
      const handleMouseLeave = () => setHoveredCell(null)
      const handleTap = () => {
        if (selectedCard) onCellTap({ row: roomRow, col: roomCol })
      }

      cells.push(
        <div
          key={`${displayRow}-${displayCol}`}
          className={[
            'cg-cell',
            'cg-cell--room',
            frozen        ? 'cg-cell--frozen'      : '',
            isHighlighted ? 'cg-cell--highlighted'  : '',
            hasEnemy      ? 'cg-cell--has-enemy'    : '',
            selectedCard  ? 'cg-cell--targeting'    : '',
          ].join(' ')}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleTap}
        >
          <EnemyCell enemies={cellEnemies} />
          {token && !hasEnemy && (
            <span className="cg-token">📌</span>
          )}
        </div>
      )
    }
  }

  // Max cell size we want in px
  const MAX_CELL_SIZE = 64

  // Available height for the grid (viewport minus space for other UI)
  const GRID_MAX_HEIGHT = Math.min(window.innerHeight * 0.5, displayRows * MAX_CELL_SIZE)

  // Work backwards: if height is constrained, what width does that imply?
  const cellSizeFromHeight = GRID_MAX_HEIGHT / displayRows
  const maxGridWidth = cellSizeFromHeight * displayCols

  // Also cap by a max width so huge wide grids don't overflow
  const MAX_GRID_WIDTH = Math.min(maxGridWidth, 480)

  return (
    <div className="cg-wrapper" style={{ maxWidth: `${MAX_GRID_WIDTH}px` }}>
      <div
        className="cg-grid"
        style={{
          gridTemplateColumns: `repeat(${displayCols}, 1fr)`,
          gridTemplateRows: `repeat(${displayRows}, 1fr)`,
          // '--cg-cols': displayCols,
          // '--cg-rows': displayRows,
        }}
      >
        {cells}
      </div>
    </div>
  )
}