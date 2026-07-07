import { useState, useEffect } from 'react'
import { SUB_PHASES, PHASES } from '../engine/combatReducer.js'
import { ROOM_TYPES } from '../data/layouts.js'
import PlayerStatus from './PlayerStatus.jsx'
import CombatGrid from './CombatGrid.jsx'
import CardHand from './CardHand.jsx'
import CombatLog from './CombatLog.jsx'
import './CombatScreen.css'
import { createPortal } from 'react-dom'

export default function CombatScreen({ state, dispatch }) {
  // ── UI state (not in reducer — pure interaction state) ──────────────────
  const [selectedCard, setSelectedCard] = useState(null)
  const [pendingTarget, setPendingTarget] = useState(null)
  const [dragState, setDragState] = useState(null)
  // { card, iconClass, x, y, currentCell }

  const isPlayerTurn = state.subPhase === SUB_PHASES.PLAYER_TURN

  const isTouchDevice = window.matchMedia('(hover: none)').matches

  //useeffect for dragging
  useEffect(() => {
    if (!dragState) return

    const onMove = (e) => {
      e.preventDefault()
      const touch = e.touches?.[0]
      if (!touch) return
      handleDragMove(touch.clientX, touch.clientY)
    }
    const onEnd = () => handleDragEnd()

    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [dragState])

  // ── Card selection ──────────────────────────────────────────────────────
  const handleCardSelect = (card) => {
    // if (!isPlayerTurn) return
    if (selectedCard?.instanceId === card.instanceId) {
      // tap same card again = deselect
      setSelectedCard(null)
      setPendingTarget(null)
    } else {
      setSelectedCard(card)
      setPendingTarget(null)
    }
  }

  // ── drag handlers  ──────────────────────────────────────────────────────

  const handleDragStart = (card, iconClass, touchX, touchY, basicIconUrl) => {
    if (!isPlayerTurn) return
    const isInHand = state.hand.some(c => c.instanceId === card.instanceId)
    if (!isInHand) return
    setSelectedCard(card)
    setPendingTarget(null)
    setDragState({ card, iconClass, x: touchX, y: touchY, currentCell: null, basicIconUrl })
  }

  const handleDragMove = (touchX, touchY) => {
    if (!dragState) return

    // find which grid cell is under the finger
    const el = document.elementFromPoint(touchX, touchY)
    const row = el?.dataset?.row
    const col = el?.dataset?.col
    const currentCell = (row !== undefined && col !== undefined)
      ? { row: parseInt(row), col: parseInt(col) }
      : null

    setDragState(prev => ({ ...prev, x: touchX, y: touchY, currentCell }))

    // update pending target for highlight
    if (currentCell) setPendingTarget(currentCell)
    else setPendingTarget(null)
  }

  const handleDragEnd = () => {
    if (!dragState) return
    const { card, currentCell } = dragState

    if (currentCell && isPlayerTurn) {
      const isInHand = state.hand.some(c => c.instanceId === card.instanceId)
      if (isInHand) {
        // same play logic as handleCellTap
        const pattern = card.attackPattern
        if (['row_wide', 'row2', 'front_2rows_wide', 'all_enemies', 'all_frozen', 'none', 'front_row'].includes(pattern)) {
          playCard(card, { targetCell: currentCell })
        } else if (pattern === 'row') {
          playCard(card, { targetRow: currentCell.row, targetCell: currentCell })
        } else if (pattern === 'col') {
          playCard(card, { targetCol: currentCell.col, targetCell: currentCell })
        } else if (pattern === 'single') {
          playCard(card, { targetCell: currentCell, targetEnemyId: getFirstEnemyAt(currentCell) })
        } else {
          playCard(card, { targetCell: currentCell })
        }
      }
    }

    setDragState(null)
    setPendingTarget(null)
    setSelectedCard(null)
  }


  // ── Grid cell tap ───────────────────────────────────────────────────────
  const handleCellTap = (cell) => {
    if (!selectedCard || !isPlayerTurn) return

    // don't play if card isn't actually in hand (charging)
    const isInHand = state.hand.some(c => c.instanceId === selectedCard.instanceId)
    if (!isInHand) return

    const pattern = selectedCard.attackPattern
    const noTargetNeeded = [
      'row_wide', 'row2', 'front_2rows_wide', 'all_enemies', 
      'all_frozen', 'none', 'front_row'
    ].includes(pattern)

    // On touch devices, non-targeted cards still confirm on first tap
    // Targeted cards need two taps — first sets pending, second confirms
    if (isTouchDevice && !noTargetNeeded) {
      if (pendingTarget && pendingTarget.row === cell.row && pendingTarget.col === cell.col) {
        // second tap on same cell — fall through to play logic below
        setPendingTarget(null)
      } else {
        // first tap — set pending and return
        setPendingTarget(cell)
        return
      }
    }

    if (['row_wide', 'row2'].includes(pattern)) {
      playCard(selectedCard, { targetCell: cell })
      return
    }
    // Row attack — any cell in the row confirms
    if (pattern === 'row') {
      playCard(selectedCard, { targetRow: cell.row, targetCell: cell })
      return
    }
    // Col attack — any cell in the col confirms
    if (pattern === 'col') {
      playCard(selectedCard, { targetCol: cell.col, targetCell: cell })
      return
    }
    // Single target — tap to confirm
    if (pattern === 'single') {
      playCard(selectedCard, { targetCell: cell, targetEnemyId: getFirstEnemyAt(cell) })
      return
    }
    // Default: treat as single
    playCard(selectedCard, { targetCell: cell })
  }

  const getFirstEnemyAt = (cell) => {
    return state.enemies.find(e =>
      e.cell.row === cell.row && e.cell.col === cell.col
    )?.instanceId ?? null
  }

  const playCard = (card, ctx) => {
    dispatch({
      type: 'PLAY_CARD',
      instanceId: card.instanceId,
      targetCell: ctx.targetCell ?? null,
      targetEnemyId: ctx.targetEnemyId ?? null,
      targetCol: ctx.targetCol ?? null,
      targetRow: ctx.targetRow ?? null,
    })
    setSelectedCard(null)
    setPendingTarget(null)
  }

  const handleEndTurn = () => {
    if (!isPlayerTurn) return
    setSelectedCard(null)
    setPendingTarget(null)
    dispatch({ type: 'END_TURN' })
  }

  // ── Room info ───────────────────────────────────────────────────────────
  const roomDef = state.currentRoom ? ROOM_TYPES[state.currentRoom.type] : null

  return (
    <div className="cs-container">

      {/* ── Room info bar ── */}
      <div className="cs-room-bar">
        <div className="cs-room-info">
          <span className="cs-room-number">Room {state.roomNumber}</span>
          <span className="cs-room-type">
            {roomDef ? roomDef.label : ''}
            {state.currentRoom?.isElite && <span className="cs-elite-tag">Elite</span>}
          </span>
        </div>
        <div className="cs-room-kills">
          <span className="cs-kills-label">{state.enemies.length} remaining</span>
        </div>
      </div>

      {/* ── Player status ── */}
      <PlayerStatus 
        player={state.player}
        playerTookDamage={state._playerJustTookDamage ?? false}
      />

      {/* ── Combat grid ── */}
      <CombatGrid
        gridState={state.gridState}
        enemies={state.enemies}
        currentRoom={state.currentRoom}
        selectedCard={selectedCard}
        pendingTarget={pendingTarget}
        lastActedEnemies={state._lastActedEnemies ?? []} // for animations
        playerTookDamage={state._playerJustTookDamage ?? false} // for animations
        onCellTap={handleCellTap}
      />

      {/* ── Card hand ── */}
      <CardHand
        hand={state.hand}
        abilities={state.abilities}
        abilityCooldowns={state.abilityCooldowns}
        subPhase={state.subPhase}
        selectedCard={selectedCard}
        weaponType={state.runStats?.weaponType ?? 'sword'}
        onCardSelect={handleCardSelect}
        onDragStart={handleDragStart}
      />

      {/* ── End turn ── */}
      {state.phase === PHASES.ROOM_CLEAR ? (
        <button
          className="cs-end-turn"
          onClick={() => dispatch({ type: 'CLAIM_REWARD' })}
        >
          Claim Reward →
        </button>
      ) : (
        <button
          className={`cs-end-turn ${!isPlayerTurn ? 'cs-end-turn--disabled' : ''}`}
          onClick={handleEndTurn}
          disabled={!isPlayerTurn}
        >
          {isPlayerTurn ? 'End Turn →' : 'Enemy Turn...'}
        </button>
      )}

      {/* ── Log ── */}
      <CombatLog log={state.log} />

      {/* drag ghost */}
      {dragState && createPortal(
        <div style={{
          position: 'fixed',
          left: dragState.x - 32,
          top: dragState.y - 32,
          width: 64,
          height: 64,
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: 0.85,
        }}>
          {dragState.iconClass
            ? <div className={`ability-icon ${dragState.iconClass}`} />
            : <img src={dragState.basicIconUrl}
                  style={{ width: 64, height: 64, imageRendering: 'pixelated' }} />
          }
        </div>,
        document.body
      )}
    </div>
  )
}