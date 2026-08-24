import { useReducer, useEffect, useRef } from 'react'
import islesItems from '../../data/islesItems.json'
import {
  TIER_BADGE,
  SLOT_LETTER,
  getMainSlotForItemType,
  rotateShape,
  footprintFor,
  canPlaceTile,
  evaluateCut,
  normalizeShape,
  generateShipmentBoard,
  getExtraTileCost,
  saveShipmentBoard,
  loadShipmentBoard,
  clearShipmentBoard,
} from '../../utils/shipmentUtils'
import './ShipmentGame.css'

const keyOf = (r, c) => r + '_' + c

// ── Reducer ──────────────────────────────────────────────────────────────
// Kept inline rather than split into its own engine file for now — most of
// the actual game math already lives in shipmentUtils.js as pure functions,
// this reducer is mostly just orchestrating which of those to call and when.

function buildInitialState({ equipment, filler, townId, rolledDate, cutUnlocked }) {
  const resumed = loadShipmentBoard(townId, rolledDate)
  if (resumed) return resumed

  const board = generateShipmentBoard(equipment, filler, cutUnlocked)
  return {
    rolledDate,
    size: board.size,
    walls: new Set(board.walls),
    itemsByCell: board.placements, // array of [cellKey, {kind, item}]
    tiles: board.tiles,
    placements: new Map(), // cellKey -> tileId
    selected: null,
    cutMode: false,
    cutTargetId: null,
    cutStart: null,
    cutUsed: false,
    extraTilesPurchased: 0,
    submitted: false,
  }
}

function isCellFree(state, r, c) {
  const k = keyOf(r, c)
  return !state.walls.has(k) && !state.placements.has(k)
}

function shipmentReducer(state, action) {
  switch (action.type) {
    case 'SELECT_TILE': {
      const tile = state.tiles.find(t => t.id === action.id)
      if (!tile || !tile.available) return state
      if (state.selected === action.id) {
        // second click on the same tile = rotate
        return {
          ...state,
          tiles: state.tiles.map(t => t.id === action.id ? { ...t, rotation: (t.rotation + 1) % 4 } : t),
        }
      }
      return { ...state, selected: action.id, cutMode: false, cutTargetId: null }
    }

    case 'PLACE_SELECTED': {
      const tile = state.tiles.find(t => t.id === state.selected)
      if (!tile || !tile.available) return state
      const cells = rotateShape(tile.baseCells, tile.rotation)
      if (!canPlaceTile(cells, action.r, action.c, state.size, state.size, (r, c) => isCellFree(state, r, c))) {
        return state
      }
      const fp = footprintFor(cells, action.r, action.c)
      const placements = new Map(state.placements)
      fp.forEach(([r, c]) => placements.set(keyOf(r, c), tile.id))
      return {
        ...state,
        placements,
        selected: null,
        tiles: state.tiles.map(t => t.id === tile.id ? { ...t, available: false } : t),
      }
    }

    case 'PICK_UP_TILE': {
      const placements = new Map(state.placements)
      for (const [k, id] of placements) if (id === action.tileId) placements.delete(k)
      return {
        ...state,
        placements,
        tiles: state.tiles.map(t => t.id === action.tileId ? { ...t, available: true } : t),
      }
    }

    case 'TOGGLE_CUT_MODE':
      if (state.cutUsed) return state
      return { ...state, cutMode: !state.cutMode, cutTargetId: null, cutStart: null, selected: null }

    case 'SELECT_CUT_TARGET': {
      const tile = state.tiles.find(t => t.id === action.id)
      if (!tile || !tile.available) return state
      return { ...state, cutTargetId: action.id, cutStart: null }
    }

    case 'BACK_FROM_CUT_TARGET':
      return { ...state, cutTargetId: null, cutStart: null }

    case 'SET_CUT_START':
      return { ...state, cutStart: action.point }

    case 'PERFORM_CUT': {
      const tile = state.tiles.find(t => t.id === state.cutTargetId)
      if (!tile || !state.cutStart) return state
      const cells = rotateShape(tile.baseCells, tile.rotation)
      const result = evaluateCut(cells, state.cutStart, action.point)
      if (!result.valid) return { ...state, cutStart: null, cutMessage: result.reason }
      const newTiles = result.pieces.map((piece, i) => ({
        id: tile.id + '_cut' + i,
        baseCells: normalizeShape(piece),
        rotation: 0,
        available: true,
      }))
      return {
        ...state,
        tiles: [...state.tiles.filter(t => t.id !== tile.id), ...newTiles],
        cutMode: false,
        cutTargetId: null,
        cutStart: null,
        cutMessage: null,
        cutUsed: true,
      }
    }

    case 'BUY_EXTRA_TILE': {
      const newTile = { id: 'extra' + state.extraTilesPurchased, baseCells: [[0, 0]], rotation: 0, available: true }
      return {
        ...state,
        tiles: [...state.tiles, newTile],
        extraTilesPurchased: state.extraTilesPurchased + 1,
      }
    }

    case 'AUTOPLACE': {
      // best-effort, not optimal: for each unplaced tile, try to find any
      // anchor that covers at least one uncollected item; fall back to any
      // valid placement at all if no item-covering spot exists
      let placements = new Map(state.placements)
      let tiles = [...state.tiles]
      const itemCells = new Set(state.itemsByCell.map(([k]) => k))

      for (const tile of tiles) {
        if (!tile.available) continue
        const cells = rotateShape(tile.baseCells, tile.rotation)
        let bestAnchor = null
        outer:
        for (let r = 0; r < state.size; r++) {
          for (let c = 0; c < state.size; c++) {
            const free = (rr, cc) => !state.walls.has(keyOf(rr, cc)) && !placements.has(keyOf(rr, cc))
            if (!canPlaceTile(cells, r, c, state.size, state.size, free)) continue
            const fp = footprintFor(cells, r, c)
            const coversItem = fp.some(([rr, cc]) => itemCells.has(keyOf(rr, cc)) && !placements.has(keyOf(rr, cc)))
            if (coversItem) { bestAnchor = [r, c]; break outer }
            if (!bestAnchor) bestAnchor = [r, c] // fallback: first valid spot found
          }
        }
        if (bestAnchor) {
          const fp = footprintFor(cells, bestAnchor[0], bestAnchor[1])
          fp.forEach(([r, c]) => placements.set(keyOf(r, c), tile.id))
          tiles = tiles.map(t => t.id === tile.id ? { ...t, available: false } : t)
        }
      }
      return { ...state, placements, tiles }
    }

    case 'SUBMIT':
      return { ...state, submitted: true }

    default:
      return state
  }
}

// ── Component ────────────────────────────────────────────────────────────

export default function ShipmentGame({ equipment, filler, townId, rolledDate, cutUnlocked, autoplaceUnlocked, denPieces, onSubmit }) {
  const [state, dispatch] = useReducer(shipmentReducer, { equipment, filler, townId, rolledDate, cutUnlocked }, buildInitialState)
  const submittedRef = useRef(false)

  // autosave on every change, same pattern as Depthsle
  useEffect(() => {
    if (state.submitted) return
    saveShipmentBoard(townId, state)
  }, [state, townId])

  useEffect(() => {
    if (!state.submitted || submittedRef.current) return
    submittedRef.current = true

    const itemsByCellMap = new Map(state.itemsByCell)
    const collectedEquipmentIds = []
    const collectedFillerIds = []
    for (const [cellKey, entry] of itemsByCellMap) {
      if (!state.placements.has(cellKey)) continue
      if (entry.kind === 'equipment') collectedEquipmentIds.push(entry.item.id)
      else collectedFillerIds.push(entry.item.id)
    }

    clearShipmentBoard(townId)
    onSubmit({ collectedEquipmentIds, collectedFillerIds, extraTilesPurchased: state.extraTilesPurchased })
  }, [state.submitted])

  const itemAt = (r, c) => state.itemsByCell.find(([k]) => k === keyOf(r, c))?.[1] ?? null

  const renderTileLabel = (item) => {
    if (item.kind === 'filler') return item.item.itemId === 'den_pieces' ? `${item.item.quantity}` : `${item.item.quantity}x`
    const def = islesItems[item.item.itemKey]
    const slot = def ? getMainSlotForItemType(def.type) : null
    return `${SLOT_LETTER[slot] ?? '?'}·${TIER_BADGE[item.item.tier] ?? ''}`
  }

  if (state.cutMode && state.cutTargetId) {
    const tile = state.tiles.find(t => t.id === state.cutTargetId)
    return (
      <div className="sg-cut-view">
        <p className="sg-instructions">Click a point on the shape, then a second point to draw your cut.</p>
        <CutCanvas
          cells={rotateShape(tile.baseCells, tile.rotation)}
          cutStart={state.cutStart}
          onSetStart={(pt) => dispatch({ type: 'SET_CUT_START', point: pt })}
          onCommit={(pt) => dispatch({ type: 'PERFORM_CUT', point: pt })}
        />
        {state.cutMessage && <p className="sg-cut-msg">{state.cutMessage}</p>}
        <button onClick={() => dispatch({ type: 'BACK_FROM_CUT_TARGET' })}>Back</button>
      </div>
    )
  }

  return (
    <div className="sg-game">
      <div className="sg-board" style={{ gridTemplateColumns: `repeat(${state.size}, 1fr)` }}>
        {Array.from({ length: state.size * state.size }, (_, i) => {
          const r = Math.floor(i / state.size), c = i % state.size
          const wall = state.walls.has(keyOf(r, c))
          const covered = state.placements.get(keyOf(r, c))
          const item = itemAt(r, c)
          const selectedTile = state.tiles.find(t => t.id === state.selected)

          return (
            <div
              key={i}
              className={`sg-cell ${wall ? 'sg-cell--wall' : ''} ${covered ? 'sg-cell--covered' : ''}`}
              onMouseEnter={(e) => {
                if (!selectedTile || wall || covered) return
                // hover preview handled via CSS class toggling in a real
                // implementation — omitted here for brevity, same green/red
                // pattern as the prototypes
              }}
              onClick={() => {
                if (state.submitted) return
                if (covered) return dispatch({ type: 'PICK_UP_TILE', tileId: covered })
                if (selectedTile) dispatch({ type: 'PLACE_SELECTED', r, c })
              }}
            >
              {!wall && item && !covered && (
                <span className="sg-item-label">{renderTileLabel(item)}</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="sg-tray">
        {state.tiles.map(tile => (
          <button
            key={tile.id}
            disabled={!tile.available}
            className={state.selected === tile.id ? 'sg-tile--selected' : ''}
            onClick={() => {
              if (state.cutMode) return dispatch({ type: 'SELECT_CUT_TARGET', id: tile.id })
              dispatch({ type: 'SELECT_TILE', id: tile.id })
            }}
          >
            {tile.available ? `${rotateShape(tile.baseCells, tile.rotation).length} cells` : 'placed'}
          </button>
        ))}
      </div>

      <div className="sg-controls">
        {cutUnlocked && (
          <button disabled={state.cutUsed} onClick={() => dispatch({ type: 'TOGGLE_CUT_MODE' })}>
            {state.cutUsed ? 'Cut used' : state.cutMode ? 'Cancel cut' : 'Cut a tile'}
          </button>
        )}
        <button
          disabled={denPieces < getExtraTileCost(state.extraTilesPurchased)}
          onClick={() => dispatch({ type: 'BUY_EXTRA_TILE' })}
        >
          Buy 1x1 tile ({getExtraTileCost(state.extraTilesPurchased)} den pieces)
        </button>
        {autoplaceUnlocked && (
          <button onClick={() => dispatch({ type: 'AUTOPLACE' })}>Auto-place</button>
        )}
        <button onClick={() => dispatch({ type: 'SUBMIT' })}>Submit</button>
      </div>
    </div>
  )
}

// Enlarged interactive shape view for cutting — same vertex-click approach
// as the prototype's v5, ported to a small dedicated component so
// ShipmentGame's main render stays readable.
function CutCanvas({ cells, cutStart, onSetStart, onCommit }) {
  const maxR = Math.max(...cells.map(c => c[0])) + 1
  const maxC = Math.max(...cells.map(c => c[1])) + 1
  const CS = 28

  return (
    <div style={{ position: 'relative', width: maxC * CS, height: maxR * CS }}>
      {cells.map(([r, c], i) => (
        <div
          key={i}
          className="sg-cut-cell"
          style={{ position: 'absolute', left: c * CS + 2, top: r * CS + 2, width: CS - 4, height: CS - 4 }}
        />
      ))}
      <svg width={maxC * CS} height={maxR * CS} style={{ position: 'absolute', left: 0, top: 0 }}>
        {Array.from({ length: (maxR + 1) * (maxC + 1) }, (_, i) => {
          const r = Math.floor(i / (maxC + 1)), c = i % (maxC + 1)
          const isStart = cutStart && cutStart.r === r && cutStart.c === c
          return (
            <circle
              key={i}
              cx={c * CS}
              cy={r * CS}
              r={isStart ? 6 : 4}
              className={isStart ? 'sg-vertex--start' : 'sg-vertex'}
              onClick={() => cutStart ? onCommit({ r, c }) : onSetStart({ r, c })}
            />
          )
        })}
      </svg>
    </div>
  )
}