// Barebones test harness for the Depthsle game engine.
// Gate with ?dev=1 or localStorage.getItem('depthsle_dev'):
//   localStorage.setItem('depthsle_dev', '1')
//
// Lets you play through a complete game loop (class select → rooms → game over)
// without any real UI so the engine can be validated before polish begins.

import { useReducer, useState } from 'react'
import { combatReducer, buildInitialState, PHASES, SUB_PHASES } from './engine/combatReducer.js'
import { ABILITY_TREES, TREE_IDS } from './data/abilities.js'
import { ROOM_TYPES } from './data/layouts.js'

const DEV_PLAYER_DATA = {
  equip: { slots: [] },
  equipment: [],
}

export default function DepthsleDevConsole() {
  const [state, dispatch] = useReducer(combatReducer, DEV_PLAYER_DATA, buildInitialState)
  const [showLog, setShowLog] = useState(false)
  const [showState, setShowState] = useState(false)
  const [targetCol, setTargetCol] = useState(0)
  const [targetRow, setTargetRow] = useState(0)

  const phase = state.phase
  const sub = state.subPhase
  const player = state.player
  const enemies = state.enemies
  const hand = state.hand

  // ── Helpers ──────────────────────────────────────────────────────────────

  function selectClass(treeId) {
    dispatch({ type: 'SELECT_CLASS', treeId })
  }

  function selectRoom(roomType) {
    dispatch({ type: 'SELECT_ROOM', roomType })
  }

  function playCard(instanceId) {
    const firstEnemy = enemies[0]
    dispatch({
      type: 'PLAY_CARD',
      instanceId,
      targetCell: firstEnemy?.cell,
      targetEnemyId: firstEnemy?.instanceId,
      targetCol: Number(targetCol),
      targetRow: Number(targetRow),
    })
  }

  function endTurn() {
    dispatch({ type: 'END_TURN' })
  }

  function claimReward() {
    dispatch({ type: 'CLAIM_REWARD' })
  }

  function selectReward(abilityId) {
    dispatch({ type: 'SELECT_REWARD', abilityId })
  }

  // ── HP bar ────────────────────────────────────────────────────────────────

  function HpBar({ current, max, label }) {
    const pct = Math.round((current / max) * 100)
    const color = pct > 50 ? '#4caf50' : pct > 25 ? '#ff9800' : '#f44336'
    return (
      <div style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 12 }}>{label}: {current}/{max} </span>
        <span style={{ display: 'inline-block', width: 80, height: 8, background: '#333', verticalAlign: 'middle', borderRadius: 4, overflow: 'hidden' }}>
          <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: color }} />
        </span>
      </div>
    )
  }

  // ── Grid ──────────────────────────────────────────────────────────────────

  function Grid() {
    const { width, height, frozenTiles, tokens } = state.gridState
    const grid = []
    for (let row = 0; row < height; row++) {
      const cells = []
      for (let col = 0; col < width; col++) {
        const frozen = frozenTiles.has(`${row},${col}`)
        const cellEnemies = enemies.filter(e => e.cell.row === row && e.cell.col === col)
        const token = tokens.find(t => t.cell.row === row && t.cell.col === col)
        cells.push(
          <td
            key={col}
            style={{
              width: 64, height: 64, border: '1px solid #555',
              background: frozen ? '#1a3a5c' : '#1a1a1a',
              textAlign: 'center', verticalAlign: 'middle', fontSize: 20, position: 'relative',
            }}
          >
            {cellEnemies.map(e => (
              <div key={e.instanceId} style={{ fontSize: 18 }}>
                {e.emoji}
                <div style={{ fontSize: 9, color: e.hp / e.maxHp > 0.5 ? '#aaa' : '#f44336' }}>
                  {e.hp}/{e.maxHp}
                </div>
                <div style={{ fontSize: 8, color: '#888' }}>
                  bar:{Math.round(e.actionBar * 100)}%
                </div>
                {e.statuses.length > 0 && (
                  <div style={{ fontSize: 8, color: '#ff0' }}>
                    {e.statuses.map(s => s.type[0].toUpperCase()).join('')}
                  </div>
                )}
              </div>
            ))}
            {token && <div style={{ fontSize: 12, color: '#ff0' }}>📌{token.type.slice(0, 4)}</div>}
          </td>
        )
      }
      grid.push(<tr key={row}>{cells}</tr>)
    }

    return (
      <div>
        <div style={{ marginBottom: 4, fontSize: 11, color: '#888' }}>
          Grid: {width}×{height} | Target col: <input type="number" min={0} max={width-1} value={targetCol} onChange={e => setTargetCol(e.target.value)} style={{ width: 32 }} />
          {' '}row: <input type="number" min={0} max={height-1} value={targetRow} onChange={e => setTargetRow(e.target.value)} style={{ width: 32 }} />
        </div>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th colSpan={width} style={{ fontSize: 11, color: '#888', textAlign: 'left' }}>← player edge (row 0)</th>
            </tr>
          </thead>
          <tbody>{grid}</tbody>
        </table>
      </div>
    )
  }

  // ── Hand ──────────────────────────────────────────────────────────────────

  function Hand() {
    return (
      <div style={{ marginTop: 8 }}>
        <strong style={{ fontSize: 12 }}>Hand ({hand.length} cards):</strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {hand.map(card => (
            <button
              key={card.instanceId}
              onClick={() => playCard(card.instanceId)}
              disabled={sub !== SUB_PHASES.PLAYER_TURN}
              style={{
                padding: '4px 8px', background: sub === SUB_PHASES.PLAYER_TURN ? '#2a3a5c' : '#222',
                color: '#fff', border: '1px solid #557', borderRadius: 4, cursor: 'pointer', fontSize: 11,
              }}
            >
              {card.name}
              {card.rarity > 0 && <span style={{ color: ['#888','#7df','#f90','#f4f','#fa0'][card.rarity], marginLeft: 4 }}>
                {['','Uc','R','E','L'][card.rarity]}
              </span>}
            </button>
          ))}
        </div>
        {sub === SUB_PHASES.PLAYER_TURN && (
          <button
            onClick={endTurn}
            style={{ marginTop: 8, padding: '4px 12px', background: '#5c2a2a', color: '#fff', border: '1px solid #855', borderRadius: 4, cursor: 'pointer' }}
          >
            End Turn →
          </button>
        )}
      </div>
    )
  }

  // ── Phase Panels ──────────────────────────────────────────────────────────

  let content = null

  if (phase === PHASES.CLASS_SELECT) {
    content = (
      <div>
        <h3 style={{ margin: '0 0 8px' }}>Choose Your Class</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {state.classOptions.map(treeId => {
            const tree = ABILITY_TREES[treeId]
            return (
              <button key={treeId} onClick={() => selectClass(treeId)} style={{
                padding: '8px 16px', background: '#1a2a3a', color: '#fff',
                border: '1px solid #557', borderRadius: 6, cursor: 'pointer', textAlign: 'center',
              }}>
                <div style={{ fontSize: 28 }}>{tree?.emoji}</div>
                <div style={{ fontWeight: 'bold' }}>{tree?.name}</div>
                <div style={{ fontSize: 10, color: '#aaa', maxWidth: 120 }}>{tree?.description}</div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  else if (phase === PHASES.ROOM_SELECT) {
    content = (
      <div>
        <h3 style={{ margin: '0 0 8px' }}>Choose Room (Room {state.roomNumber + 1}, {state.roomsCleared} cleared)</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {state.roomOptions.map((type, i) => {
            const def = ROOM_TYPES[type]
            return (
              <button key={i} onClick={() => selectRoom(type)} style={{
                padding: '8px 16px', background: def.isElite ? '#3a1a1a' : '#1a2a1a',
                color: '#fff', border: `1px solid ${def.isElite ? '#855' : '#585'}`,
                borderRadius: 6, cursor: 'pointer',
              }}>
                <div style={{ fontSize: 24 }}>{def.emoji}</div>
                <div>{def.label}</div>
                {def.isElite && <div style={{ fontSize: 10, color: '#f88' }}>ELITE</div>}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  else if (phase === PHASES.PLAYING) {
    content = (
      <div>
        <div style={{ marginBottom: 8, fontSize: 12, color: '#aaa' }}>
          Room {state.roomNumber + 1} | {state.currentRoom?.type} | Phase: {sub}
          {state.mainTree && <span style={{ marginLeft: 8 }}>
            Tree: {ABILITY_TREES[state.mainTree]?.emoji} {state.mainTree}
          </span>}
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div>
            <Grid />
          </div>
          <div style={{ minWidth: 160 }}>
            <HpBar current={player.hp} max={player.maxHp} label="HP" />
            {player.absorption > 0 && <div style={{ fontSize: 11, color: '#88f' }}>Absorb: {player.absorption}</div>}
            {player.buffs.length > 0 && (
              <div style={{ fontSize: 10, color: '#8f8' }}>
                Buffs: {player.buffs.map(b => `${b.type}+${b.value}%(${b.turnsRemaining}t)`).join(', ')}
              </div>
            )}
            <div style={{ fontSize: 11, marginTop: 4, color: '#aaa' }}>
              Kills: {state.killCount} | Score: {state.treasureScore}
            </div>
            <div style={{ fontSize: 11, marginTop: 4, color: '#aaa' }}>
              Enemies: {enemies.length}
            </div>
          </div>
        </div>
        <Hand />
      </div>
    )
  }

  else if (phase === PHASES.ROOM_CLEAR) {
    content = (
      <div>
        <h3 style={{ color: '#4f4' }}>Room Cleared! 🎉</h3>
        <p style={{ fontSize: 12 }}>Kills this room: {state.killCountRoom} | Total score: {state.treasureScore}</p>
        <button onClick={claimReward} style={{
          padding: '8px 16px', background: '#2a4a2a', color: '#fff',
          border: '1px solid #585', borderRadius: 6, cursor: 'pointer',
        }}>
          Claim Reward →
        </button>
      </div>
    )
  }

  else if (phase === PHASES.REWARD) {
    if (state.rewardType === 'upgrade') {
      const upgrades = state.upgradeChoices ?? []
      content = (
        <div>
          <h3>Choose an Upgrade</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {upgrades.map(u => (
              <button key={u.id} onClick={() => dispatch({ type: 'SELECT_REWARD', upgradeId: u.id })} style={{
                padding: '8px 12px', background: '#1a3a1a', color: '#fff',
                border: '1px solid #585', borderRadius: 6, cursor: 'pointer', maxWidth: 160,
              }}>
                <div style={{ fontWeight: 'bold', color: '#8f8' }}>{u.label}</div>
                <div style={{ fontSize: 10, color: '#aaa' }}>{u.description}</div>
              </button>
            ))}
          </div>
        </div>
      )
    } else {
      const choices = state.rewardChoices ?? []
      content = (
        <div>
          <h3>Choose an Ability</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {choices.map(a => (
              <button key={a.id} onClick={() => selectReward(a.id)} style={{
                padding: '8px 12px', background: '#1a2a3a', color: '#fff',
                border: '1px solid #557', borderRadius: 6, cursor: 'pointer', maxWidth: 160,
              }}>
                <div style={{ fontWeight: 'bold', color: ['#888','#7df','#f90','#f4f','#fa0'][a.rarity] }}>
                  {['Common','Uncommon','Rare','Epic','Legendary'][a.rarity]}
                </div>
                <div style={{ fontSize: 13 }}>{a.name}</div>
                <div style={{ fontSize: 10, color: '#aaa' }}>{a.description}</div>
              </button>
            ))}
            {choices.length === 0 && (
              <button onClick={() => dispatch({ type: 'SELECT_REWARD', abilityId: '__skip__' })} style={{
                padding: '8px 16px', background: '#333', color: '#aaa', border: '1px solid #555', borderRadius: 6, cursor: 'pointer',
              }}>
                Skip (no abilities available)
              </button>
            )}
          </div>
        </div>
      )
    }
  }

  else if (phase === PHASES.GAME_OVER) {
    content = (
      <div>
        <h3 style={{ color: '#f44' }}>Game Over 💀</h3>
        <p>Rooms cleared: {state.roomsCleared}</p>
        <p>Treasure score: {state.treasureScore}</p>
        <p>Total kills: {state.killCount}</p>
        <p>Abilities: {state.abilities.map(a => a.name).join(', ') || 'None'}</p>
        <button onClick={() => window.location.reload()} style={{
          padding: '8px 16px', background: '#3a1a1a', color: '#fff',
          border: '1px solid #855', borderRadius: 6, cursor: 'pointer',
        }}>
          Restart (reload)
        </button>
      </div>
    )
  }

  return (
    <div style={{ background: '#111', color: '#fff', padding: 16, fontFamily: 'monospace', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <strong>🌊 Depthsle Dev Console</strong>
        <span style={{ fontSize: 11, color: '#888' }}>Phase: {phase} | Seed: {state.seed}</span>
        <button onClick={() => setShowLog(v => !v)} style={{ fontSize: 11, padding: '2px 6px', cursor: 'pointer' }}>
          {showLog ? 'Hide Log' : 'Show Log'}
        </button>
        <button onClick={() => setShowState(v => !v)} style={{ fontSize: 11, padding: '2px 6px', cursor: 'pointer' }}>
          {showState ? 'Hide State' : 'Show State'}
        </button>
      </div>

      {content}

      {showLog && (
        <div style={{ marginTop: 16, maxHeight: 200, overflowY: 'auto', background: '#0a0a0a', padding: 8, fontSize: 11, borderRadius: 4 }}>
          <strong>Event Log:</strong>
          {[...state.log].reverse().map((entry, i) => (
            <div key={i} style={{ color: '#aaa', borderBottom: '1px solid #222', padding: '2px 0' }}>{entry}</div>
          ))}
        </div>
      )}

      {showState && (
        <pre style={{ marginTop: 8, maxHeight: 300, overflowY: 'auto', background: '#0a0a0a', padding: 8, fontSize: 10, borderRadius: 4 }}>
          {JSON.stringify({
            ...state,
            gridState: { ...state.gridState, frozenTiles: [...state.gridState.frozenTiles] },
          }, null, 2)}
        </pre>
      )}
    </div>
  )
}
