import { useReducer, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import islesItems from '../../data/islesItems.json'
import { ITEM_MAP } from '../../data/itemMap'
import {
  TIER_BADGE,
  SLOT_LETTER,
  getMainSlotForItemType,
  rotateShape,
  footprintFor,
  canPlaceTile,
  anchorFromDropCell,
  evaluateCut,
  normalizeShape,
  generateShipmentBoard,
  getExtraTileCost,
  getCumulativeExtraTileCost,
  saveShipmentBoard,
  loadShipmentBoard,
  clearShipmentBoard,
} from '../../utils/shipmentUtils'
import './ShipmentGame.css'

const keyOf = (r, c) => r + '_' + c

// ── Shape preview — used in the tray button and the drag ghost ──────────

function TileShapePreview({ cells, cellSize = 10, shade = 1 }) {
  const maxR = Math.max(...cells.map(c => c[0])) + 1
  const maxC = Math.max(...cells.map(c => c[1])) + 1
  return (
    <div
      className="sg-shape-preview"
      style={{
        gridTemplateColumns: `repeat(${maxC}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${maxR}, ${cellSize}px)`,
        filter: `hue-rotate(${shade}deg) saturate(1.1)`,
      }}
    >
      {Array.from({ length: maxR * maxC }, (_, i) => {
        const r = Math.floor(i / maxC), c = i % maxC
        const filled = cells.some(([pr, pc]) => pr === r && pc === c)
        return (
          <div
            key={i}
            className={filled ? 'sg-shape-cell sg-shape-cell--filled' : 'sg-shape-cell'}
            style={{ width: cellSize, height: cellSize }}
          />
        )
      })}
    </div>
  )
}

// ── Reducer ──────────────────────────────────────────────────────────────

function buildInitialState({ equipment, filler, townId, rolledDate, cutUnlocked }) {
  const resumed = loadShipmentBoard(townId, rolledDate)
  if (resumed) return resumed

  const board = generateShipmentBoard(equipment, filler, cutUnlocked)
  return {
    rolledDate,
    size: board.size,
    walls: new Set(board.walls),
    itemsByCell: board.placements,
    tiles: board.tiles,
    placements: new Map(),
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
        return {
          ...state,
          tiles: state.tiles.map(t => t.id === action.id ? { ...t, rotation: (t.rotation + 1) % 4 } : t),
        }
      }
      return { ...state, selected: action.id, cutMode: false, cutTargetId: null }
    }

    // dropR/dropC is the cell under the cursor/finger — the shape's
    // bottom-right corner, not its top-left anchor.
    case 'PLACE_TILE': {
      const tile = state.tiles.find(t => t.id === action.tileId)
      if (!tile || !tile.available) return state
      const cells = rotateShape(tile.baseCells, tile.rotation)
      const { anchorR, anchorC } = anchorFromDropCell(cells, action.dropR, action.dropC)
      if (!canPlaceTile(cells, anchorR, anchorC, state.size, state.size, (r, c) => isCellFree(state, r, c))) {
        return state
      }
      const fp = footprintFor(cells, anchorR, anchorC)
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
        shade: -30 + Math.random() * 60,
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
      const newTile = { id: 'extra' + state.extraTilesPurchased, baseCells: [[0, 0]], rotation: 0, available: true, shade: -20 + Math.random() * 40 }
      return { ...state, tiles: [...state.tiles, newTile], extraTilesPurchased: state.extraTilesPurchased + 1 }
    }

    case 'AUTOPLACE': {
      // reset first — this is a shuffle button, not a "fill remaining gaps"
      // button, so every press starts from an empty board rather than only
      // ever adding to whatever's already placed
      let placements = new Map()
      let tiles = state.tiles.map(t => ({ ...t, available: true }))
      const itemCells = new Set(state.itemsByCell.map(([k]) => k))

      // process tiles in random order each press — otherwise tile[0] always
      // gets first pick of the board regardless of how anchors are chosen
      const order = [...tiles].sort(() => Math.random() - 0.5)

      for (const tile of order) {
        const cells = rotateShape(tile.baseCells, tile.rotation)
        const itemAnchors = []
        const anyAnchors = []

        for (let r = 0; r < state.size; r++) {
          for (let c = 0; c < state.size; c++) {
            const free = (rr, cc) => !state.walls.has(keyOf(rr, cc)) && !placements.has(keyOf(rr, cc))
            if (!canPlaceTile(cells, r, c, state.size, state.size, free)) continue
            const fp = footprintFor(cells, r, c)
            const coversItem = fp.some(([rr, cc]) => itemCells.has(keyOf(rr, cc)) && !placements.has(keyOf(rr, cc)))
            ;(coversItem ? itemAnchors : anyAnchors).push([r, c])
          }
        }

        // pick randomly among valid options, biased toward item-covering spots,
        // rather than always taking whichever the scan happens to reach first
        const pool = itemAnchors.length > 0 ? itemAnchors : anyAnchors
        if (pool.length === 0) continue
        const [ar, ac] = pool[Math.floor(Math.random() * pool.length)]

        const fp = footprintFor(cells, ar, ac)
        fp.forEach(([r, c]) => placements.set(keyOf(r, c), tile.id))
        tiles = tiles.map(t => t.id === tile.id ? { ...t, available: false } : t)
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

  // hover fallback for desktop mice that aren't dragging — separate from
  // dragState below, which covers both touch and click-drag
  const [hoverCell, setHoverCell] = useState(null)
  const [dragState, setDragState] = useState(null) // { tileId, cells, x, y, currentCell }
  const didDragRef = useRef(false)

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
    const extraTilesUsed = state.tiles.filter(t => t.id.startsWith('extra') && !t.available).length

    clearShipmentBoard(townId)
    onSubmit({ collectedEquipmentIds, collectedFillerIds, extraTilesUsed })
  }, [state.submitted])

  // ── Drag tracking — same pattern as CombatScreen: unified mouse/touch
  // listeners on window while dragState is set, elementFromPoint to find
  // the cell under the cursor via its data-row/data-col attributes.
  useEffect(() => {
    if (!dragState) return

    const onMove = (e) => {
      e.preventDefault()
      const touch = e.touches?.[0]
      const clientX = touch ? touch.clientX : e.clientX
      const clientY = touch ? touch.clientY : e.clientY

      const el = document.elementFromPoint(clientX, clientY)
      const row = el?.dataset?.row
      const col = el?.dataset?.col
      const currentCell = (row !== undefined && col !== undefined)
        ? { r: parseInt(row), c: parseInt(col) }
        : null

      didDragRef.current = true
      setDragState(prev => ({ ...prev, x: clientX, y: clientY, currentCell }))
    }

    const onEnd = () => {
      setDragState(prev => {
        if (prev?.currentCell) {
          dispatch({ type: 'PLACE_TILE', tileId: prev.tileId, dropR: prev.currentCell.r, dropC: prev.currentCell.c })
        }
        return null
      })
    }

    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onEnd)
    return () => {
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onEnd)
    }
  }, [dragState])

  const handleDragStart = (tile, clientX, clientY) => {
    if (state.cutMode || !tile.available) return
    didDragRef.current = false
    setDragState({
      tileId: tile.id,
      cells: rotateShape(tile.baseCells, tile.rotation),
      x: clientX,
      y: clientY,
      currentCell: null,
    })
  }

  // ── Preview footprint — driven by whichever is active, drag or hover ────
  const activeDropCell = dragState?.currentCell ?? (state.selected ? hoverCell : null)
  const activeTile = state.tiles.find(t => t.id === (dragState?.tileId ?? state.selected))
  const preview = (() => {
    if (!activeTile || !activeDropCell) return null
    const cells = rotateShape(activeTile.baseCells, activeTile.rotation)
    const { anchorR, anchorC } = anchorFromDropCell(cells, activeDropCell.r, activeDropCell.c)
    const fp = footprintFor(cells, anchorR, anchorC)
    const valid = canPlaceTile(cells, anchorR, anchorC, state.size, state.size, (r, c) => isCellFree(state, r, c))
    return { cells: fp, valid }
  })()

  const itemAt = (r, c) => state.itemsByCell.find(([k]) => k === keyOf(r, c))?.[1] ?? null

  function BoardItemContent({ item }) {
    if (item.kind === 'filler') {
      const itemDef = ITEM_MAP[item.item.itemId]
      return (
        <div className="sg-tile-content">
          {itemDef?.img ? (
            <img src={itemDef.img} alt="" className="sg-tile-icon-img" style={{ imageRendering: 'pixelated' }} />
          ) : (
            <span className="sg-tile-icon-fallback">?</span>
          )}
          <span className="sg-tile-badge">{item.item.quantity}</span>
        </div>
      )
    }
    const def = islesItems[item.item.itemKey]
    const slot = def ? getMainSlotForItemType(def.type) : null
    return (
      <div className="sg-tile-content">
        {/* placeholder letter until real slot icons exist — swap the span
            below for an <img> once those are ready, everything else here
            (sizing, badge position) stays the same */}
        <span className="sg-tile-icon-letter">{SLOT_LETTER[slot] ?? '?'}</span>
        <span className="sg-tile-badge">{TIER_BADGE[item.item.tier] ?? ''}</span>
      </div>
    )
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
      <div
        className="sg-board"
        style={{ gridTemplateColumns: `repeat(${state.size}, 1fr)` }}
        onMouseLeave={() => setHoverCell(null)}
      >
        {Array.from({ length: state.size * state.size }, (_, i) => {
          const r = Math.floor(i / state.size), c = i % state.size
          const wall = state.walls.has(keyOf(r, c))
          const covered = state.placements.get(keyOf(r, c))
          const item = itemAt(r, c)
          const inPreview = preview?.cells.some(([pr, pc]) => pr === r && pc === c)
          const previewClass = inPreview ? (preview.valid ? 'sg-cell--preview-valid' : 'sg-cell--preview-invalid') : ''

          return (
            <div
              key={i}
              data-row={r}
              data-col={c}
              className={`sg-cell ${wall ? 'sg-cell--wall' : ''} ${covered ? 'sg-cell--covered' : ''} ${previewClass}`}
              style={covered ? { filter: `hue-rotate(${state.tiles.find(t => t.id === covered)?.shade ?? 0}deg) saturate(1.1)` } : undefined}
              onMouseEnter={() => !wall && setHoverCell({ r, c })}
              onClick={() => {
                if (state.submitted || wall) return
                if (covered) return dispatch({ type: 'PICK_UP_TILE', tileId: covered })
                if (state.selected) dispatch({ type: 'PLACE_TILE', tileId: state.selected, dropR: r, dropC: c })
              }}
            >
              {!wall && item && !covered && <BoardItemContent item={item} />}
            </div>
          )
        })}
      </div>

      <div className="sg-tray">
        {state.tiles.map(tile => {
          const cells = rotateShape(tile.baseCells, tile.rotation)
          return (
            <button
              key={tile.id}
              disabled={!tile.available}
              className={state.selected === tile.id ? 'sg-tile sg-tile--selected' : 'sg-tile'}
              onMouseDown={(e) => handleDragStart(tile, e.clientX, e.clientY)}
              onTouchStart={(e) => {
                const t = e.touches[0]
                handleDragStart(tile, t.clientX, t.clientY)
              }}
              onClick={() => {
                // click without drag = tap-to-select fallback, same dual
                // mode as CombatScreen's card tap vs. drag
                if (didDragRef.current) { didDragRef.current = false; return }
                if (state.cutMode) return dispatch({ type: 'SELECT_CUT_TARGET', id: tile.id })
                dispatch({ type: 'SELECT_TILE', id: tile.id })
              }}
            >
              <TileShapePreview cells={cells} shade={tile.shade ?? 1} />
            </button>
          )
        })}
      </div>

      <div className="sg-controls">
        {cutUnlocked && (
          <button disabled={state.cutUsed} onClick={() => dispatch({ type: 'TOGGLE_CUT_MODE' })}>
            {state.cutUsed ? 'Cut used' : state.cutMode ? 'Cancel cut' : 'Cut a tile'}
          </button>
        )}
        <button
          disabled={denPieces < getCumulativeExtraTileCost(state.extraTilesPurchased + 1)}
          onClick={() => dispatch({ type: 'BUY_EXTRA_TILE' })}
        >
          Buy 1x1 tile ({getExtraTileCost(state.extraTilesPurchased)} den pieces)
        </button>
        {autoplaceUnlocked && (
          <button onClick={() => dispatch({ type: 'AUTOPLACE' })}>Auto-place</button>
        )}
        <button onClick={() => dispatch({ type: 'SUBMIT' })}>Submit</button>
      </div>

      {/* drag ghost — same portal pattern as CombatScreen */}
      {dragState && createPortal(
        <div style={{
          position: 'fixed',
          left: dragState.x - 20,
          top: dragState.y - 20,
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: 0.85,
        }}>
          <TileShapePreview cells={dragState.cells} cellSize={16} shade={dragState.shade ?? 1} />
        </div>,
        document.body
      )}
    </div>
  )
}

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