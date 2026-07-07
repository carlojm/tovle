import { useState } from 'react'
import { SUB_PHASES, PHASES } from '../engine/combatReducer.js'
import { ROOM_TYPES } from '../data/layouts.js'
import PlayerStatus from './PlayerStatus.jsx'
import CombatGrid from './CombatGrid.jsx'
import CardHand from './CardHand.jsx'
import CombatLog from './CombatLog.jsx'
import './CombatScreen.css'

export default function CombatScreen({ state, dispatch }) {
  // ── UI state (not in reducer — pure interaction state) ──────────────────
  const [selectedCard, setSelectedCard] = useState(null)
  const [pendingTarget, setPendingTarget] = useState(null)

  const isPlayerTurn = state.subPhase === SUB_PHASES.PLAYER_TURN

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

  // ── Grid cell tap ───────────────────────────────────────────────────────
  const handleCellTap = (cell) => {
    if (!selectedCard || !isPlayerTurn) return

    // don't play if card isn't actually in hand (charging)
    const isInHand = state.hand.some(c => c.instanceId === selectedCard.instanceId)
    if (!isInHand) return

    const pattern = selectedCard.attackPattern

    // Patterns that need no positional choice — confirm immediately
    const autoConfirm = ['row_wide', 'row2', 'aoe3x3', 'x_shape']
    if (autoConfirm.includes(pattern)) {
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

    </div>
  )
}