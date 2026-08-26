//these helpers written by CLAUDE orchestrated by ME
//go my boilerplate minion

// Client-side interaction logic for the shipment collection minigame.
// Board generation (walls, tile shapes, item placement) happens entirely
// client-side too, seeded from the item list the server sends — the server
// only owns the item list itself (via pendingShipment), since that's the
// only part with real economic weight. This file covers placing tiles,
// rotating them, and cutting them, plus small display helpers.

import { SLOT_ACCEPTS } from './equipUtils'

// ── Tier display ─────────────────────────────────────────────────────────
// Single source of truth for tier abbreviations shown on placeholder tiles.
// Matches the convention already used in Depthsle's GameOver/TIER_BADGE.
export const TIER_BADGE = {
  'Tier 1': 'I',
  'Tier 2': 'II',
  'Tier 3': 'III',
  'Tier 4': 'IV',
  'Tier 5': 'V',
  'Uncommon': 'Uc',
  'Unique': 'Uq',
  'Rare': 'R',
  'Artifact': 'A',
  'Epic': 'E',
}

// ── Slot display ─────────────────────────────────────────────────────────
// Placeholder letters until real icons exist (per Carlo: H C L B M O).
const MAIN_SLOT_KEYS = ['helmet', 'chestplate', 'leggings', 'boots', 'mainhand', 'offhand']

export const SLOT_LETTER = {
  helmet: 'H',
  chestplate: 'C',
  leggings: 'L',
  boots: 'B',
  mainhand: 'M',
  offhand: 'O',
}

// islesItems[item.itemKey].type -> one of the 6 main slot keys, or null if
// it doesn't match any (shouldn't happen for real equipment, but a bad
// lookup here shouldn't crash the board renderer).
export function getMainSlotForItemType(itemType) {
  for (const slotKey of MAIN_SLOT_KEYS) {
    if (SLOT_ACCEPTS[slotKey].includes(itemType)) return slotKey
  }
  return null
}

// ── Shape math ───────────────────────────────────────────────────────────
// Shapes are arrays of [row, col] offsets, always normalized so the
// smallest row/col is 0 — keeps rotation and placement math consistent
// regardless of how a shape was originally generated.

export function normalizeShape(cells) {
  const minR = Math.min(...cells.map(c => c[0]))
  const minC = Math.min(...cells.map(c => c[1]))
  return cells.map(([r, c]) => [r - minR, c - minC])
}

function rotate90(cells) {
  return normalizeShape(cells.map(([r, c]) => [c, -r]))
}

export function rotateShape(baseCells, times) {
  let cells = baseCells
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) cells = rotate90(cells)
  return cells
}

export function footprintFor(cells, anchorR, anchorC) {
  return cells.map(([dr, dc]) => [anchorR + dr, anchorC + dc])
}

// Converts a drop cell (where the player's cursor/finger is) into the
// top-left anchor footprintFor expects, treating the drop cell as the
// shape's bottom-right corner instead of its top-left. Matches how a
// tile dragged up from a tray below the board naturally feels — the
// point under your finger is the near/bottom edge of the shape, not
// the far one.
export function anchorFromDropCell(cells, dropR, dropC) {
  const maxR = Math.max(...cells.map(c => c[0]))
  const maxC = Math.max(...cells.map(c => c[1]))
  // drop cell is the shape's center (rounded down for even-sized bounding
  // boxes, so there's a consistent rule rather than ambiguity)
  const centerR = Math.ceil(maxR / 2)
  const centerC = Math.ceil(maxC / 2)
  return { anchorR: dropR - centerR, anchorC: dropC - centerC }
}


// ── Placement validity ──────────────────────────────────────────────────
// isCellFree(r, c) is injected by the caller so this stays independent of
// however the board component represents its cells.
//
// Deliberately does NOT reject a placement just because the anchor (the
// shape's [0,0] offset) happens to land on a wall — a J-shaped tile's
// anchor cell isn't necessarily part of the tile itself. Only the actual
// occupied cells matter for collision. (Fixes the bug Carlo flagged in the
// prototype where hovering a wall under the anchor blocked otherwise-valid
// placements.)
export function canPlaceTile(cells, anchorR, anchorC, rows, cols, isCellFree) {
  const fp = footprintFor(cells, anchorR, anchorC)
  return fp.every(([r, c]) =>
    r >= 0 && r < rows && c >= 0 && c < cols && isCellFree(r, c)
  )
}

// ── Cutting ──────────────────────────────────────────────────────────────
// A cut is a straight line between two points on the tile's own local grid
// (its own bounding box, not board coordinates — meant to run on an
// enlarged tray preview, not the main board). Diagonals are allowed — the
// only line that's unusable is one that passes exactly through a cell's
// center, which is rejected as ambiguous rather than silently picking a
// side for it.
//
// Splitting is done by side-of-line test + connected-component flood fill,
// not by requiring exactly two pieces — a line that clips a winding shape
// at multiple points naturally produces 3+ pieces, which is intentional
// per Carlo: "if a player can line up to cut a shape into more than two,
// it should be allowed because its fun."

function sideOfLine(A, B, r, c) {
  // doubled coordinates keep this exact-integer math — cell centers sit at
  // half-integer points (r+0.5, c+0.5), so doubling avoids floating point
  // equality checks when testing for the degenerate case
  const dr2 = B.r - A.r
  const dc2 = B.c - A.c
  const val = dc2 * ((2 * r + 1) - 2 * A.r) - dr2 * ((2 * c + 1) - 2 * A.c)
  return val === 0 ? 0 : (val > 0 ? 1 : -1)
}

function neighborsUnbounded(r, c) {
  return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
}

function keyOf(r, c) {
  return r + '_' + c
}

function componentsOf(cellList) {
  const set = new Set(cellList.map(([r, c]) => keyOf(r, c)))
  const seen = new Set()
  const comps = []
  for (const [r, c] of cellList) {
    const k = keyOf(r, c)
    if (seen.has(k)) continue
    const comp = []
    const stack = [[r, c]]
    seen.add(k)
    while (stack.length) {
      const [cr, cc] = stack.pop()
      comp.push([cr, cc])
      neighborsUnbounded(cr, cc).forEach(([nr, nc]) => {
        const nk = keyOf(nr, nc)
        if (set.has(nk) && !seen.has(nk)) {
          seen.add(nk)
          stack.push([nr, nc])
        }
      })
    }
    comps.push(comp)
  }
  return comps
}

// cells: the tile's own shape (array of [r,c] offsets)
// A, B: two distinct local points defining the cut line
// returns { valid: false, reason } or { valid: true, pieces: [[r,c]...][] }
export function evaluateCut(cells, A, B) {
  if (A.r === B.r && A.c === B.c) {
    return { valid: false, reason: 'Choose two different points.' }
  }
  const sides = cells.map(([r, c]) => sideOfLine(A, B, r, c))
  if (sides.includes(0)) {
    return { valid: false, reason: 'That line runs through the middle of a cell — try a different angle.' }
  }
  if (!(sides.some(s => s > 0) && sides.some(s => s < 0))) {
    return { valid: false, reason: "That line doesn't cross the tile." }
  }
  const groupPos = cells.filter((_, i) => sides[i] > 0)
  const groupNeg = cells.filter((_, i) => sides[i] < 0)
  const pieces = [...componentsOf(groupPos), ...componentsOf(groupNeg)].map(normalizeShape)
  return { valid: true, pieces }
}







// ── Board generation ─────────────────────────────────────────────────────
// Everything below builds the actual puzzle board client-side, seeded only
// by the item list the server already committed to (via pendingShipment).
// Layout itself (walls, tile shapes, item positions) has no economic weight,
// so it doesn't need to be deterministic or reproducible — the generated
// board gets cached whole in localStorage for resume, same as Depthsle's
// persistence.js does for run state. If localStorage is cleared, a fresh
// board just gets generated from the same item list; nothing is lost since
// the item list itself is what pendingShipment protects.

const BOARD_SIZES = [6, 7, 8, 9]
const WALL_DENSITY = 0.18

function keyOfBoard(r, c) {
  return r + '_' + c
}

function inBoundsSize(r, c, size) {
  return r >= 0 && r < size && c >= 0 && c < size
}

function neighbors4(r, c, size) {
  return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => inBoundsSize(a, b, size))
}

// Picks the smallest board size (7x7 -> 8x8 -> 9x9) that fits every item
// plus its wall budget. Returns null if even 9x9 can't fit everything —
// caller is responsible for trimming the item list and retrying.
export function pickBoardSize(totalItemCount) {
  for (const size of BOARD_SIZES) {
    const wallCount = Math.round(WALL_DENSITY * size * size)
    if (totalItemCount + wallCount <= size * size) return { size, wallCount }
  }
  return null
}

// Places walls one at a time, only keeping a candidate if the remaining
// free cells stay in a single connected region — per Carlo: walls shouldn't
// ever seal off a pocket of the board that a tile could never reach.
export function generateWalls(size, wallCount) {
  const walls = new Set()

  function freeCellsConnected() {
    const allFree = []
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!walls.has(keyOfBoard(r, c))) allFree.push([r, c])
      }
    }
    if (allFree.length === 0) return true
    const seen = new Set([keyOfBoard(...allFree[0])])
    const stack = [allFree[0]]
    while (stack.length) {
      const [r, c] = stack.pop()
      neighbors4(r, c, size).forEach(([nr, nc]) => {
        const k = keyOfBoard(nr, nc)
        if (!walls.has(k) && !seen.has(k)) {
          seen.add(k)
          stack.push([nr, nc])
        }
      })
    }
    return seen.size === allFree.length
  }

  let attempts = 0
  while (walls.size < wallCount && attempts < wallCount * 40) {
    attempts++
    const r = Math.floor(Math.random() * size)
    const c = Math.floor(Math.random() * size)
    const k = keyOfBoard(r, c)
    if (walls.has(k)) continue
    walls.add(k)
    if (!freeCellsConnected()) walls.delete(k) // would seal off a pocket — reject and try elsewhere
  }
  return walls
}

// Scatters items onto random free (non-wall) cells, one item per cell.
// items: array of anything — this doesn't care about shape, just needs a
// distinct cell per entry. Returns a Map of 'r_c' -> item.
export function placeItemsOnBoard(size, walls, items) {
  const freeCells = []
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!walls.has(keyOfBoard(r, c))) freeCells.push([r, c])
    }
  }
  // shuffle
  for (let i = freeCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[freeCells[i], freeCells[j]] = [freeCells[j], freeCells[i]]
  }
  const placements = new Map()
  items.forEach((item, i) => {
    if (i >= freeCells.length) return // shouldn't happen if pickBoardSize was respected
    const [r, c] = freeCells[i]
    placements.set(keyOfBoard(r, c), item)
  })
  return placements
}

// Grows one random polyomino tile via a random walk across free, unreserved
// cells — same technique as the prototype: since the shape is built by
// walking real board cells, it's guaranteed to fit back where it grew,
// no separate validity search needed. reservedSet is mutated so multiple
// tiles generated in sequence don't claim overlapping guaranteed spots.
function growTile(size, walls, reservedSet, targetSize, forcedStart = null) {
  for (let attempt = 0; attempt < (forcedStart ? 1 : 60); attempt++) {
    const start = forcedStart ?? [Math.floor(Math.random() * size), Math.floor(Math.random() * size)]
    const sk = keyOfBoard(...start)
    if (walls.has(sk) || reservedSet.has(sk)) return null // forced start is already claimed — caller must know

    const shape = [start]
    const inShape = new Set([sk])
    let frontier = neighbors4(...start, size).filter(([r, c]) => {
      const k = keyOfBoard(r, c)
      return !walls.has(k) && !reservedSet.has(k) && !inShape.has(k)
    })

    while (shape.length < targetSize && frontier.length > 0) {
      const idx = Math.floor(Math.random() * frontier.length)
      const [r, c] = frontier.splice(idx, 1)[0]
      const k = keyOfBoard(r, c)
      if (inShape.has(k)) continue
      shape.push([r, c])
      inShape.add(k)
      neighbors4(r, c, size).forEach(([nr, nc]) => {
        const nk = keyOfBoard(nr, nc)
        if (!walls.has(nk) && !reservedSet.has(nk) && !inShape.has(nk)) frontier.push([nr, nc])
      })
    }

    if (shape.length >= Math.min(4, targetSize)) {
      shape.forEach(([r, c]) => reservedSet.add(keyOfBoard(r, c)))
      return normalizeShape(shape)
    }
  }
  return null
}

// Generates the tile pool for a board. tileCount and sizeRange are the
// tunable knobs for difficulty — see notes below.
// cutUnlocked widens the max tile size, per Carlo: bigger tiles only make
// sense once cutting exists to break them back down.

// placements: Map of cellKey -> { kind, item } from placeItemsOnBoard.
// sacrificeCount: how many equipment items are allowed to go unguaranteed —
// this is the actual knob for "at least n-1 of equipment is collectible
// with optimal play." 1 means exactly one equipment item can be left
// uncoverable by design; 0 means every equipment item is guaranteed
// reachable by some tile (though the player may still choose not to
// collect it, or not have room to fit everything).
export function generateTilePool(size, walls, tileCount, cutUnlocked, placements, sacrificeCount = 1) {
  const reserved = new Set()
  const minSize = 5
  const maxSize = cutUnlocked ? 10 : 8
  const tiles = []

  const equipmentCells = [...placements.entries()]
    .filter(([, entry]) => entry.kind === 'equipment')
    .map(([k]) => k.split('_').map(Number))

  for (let i = equipmentCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[equipmentCells[i], equipmentCells[j]] = [equipmentCells[j], equipmentCells[i]]
  }
  const guaranteedCells = equipmentCells.slice(0, Math.max(0, equipmentCells.length - sacrificeCount))

  let tileIndex = 0

  // Seed from equipment cells where possible. A forced start only ever
  // tries the exact cell it's given — if an earlier tile's growth already
  // claimed it (which can legitimately happen; growth isn't required to
  // avoid other items' cells), fall back to a normal free placement
  // instead of losing this slot outright. This item loses its explicit
  // guarantee in that case, but tileCount is still honored.
  for (const cell of guaranteedCells) {
    if (tileIndex >= tileCount) break
    const targetSize = minSize + Math.floor(Math.random() * (maxSize - minSize + 1))
    let shape = growTile(size, walls, reserved, targetSize, cell)
    if (!shape) shape = growTile(size, walls, reserved, targetSize)
    if (shape) tiles.push({ id: 'tile' + tileIndex++, baseCells: shape, rotation: 0, available: true, shade: -20 + Math.random() * 40 })
  }

  // Fill remaining slots, shrinking the target size on failure instead of
  // aborting on the first dead-end — a tight board can run out of the
  // *preferred* size well before it runs out of room entirely.
  while (tileIndex < tileCount) {
    let shape = null
    for (let s = maxSize; s >= 2 && !shape; s--) {
      shape = growTile(size, walls, reserved, s)
    }
    if (!shape) break // genuinely no room left anywhere
    tiles.push({ id: 'tile' + tileIndex++, baseCells: shape, rotation: 0, available: true, shade: -20 + Math.random() * 40 })
  }

  return tiles
}

// Top-level entry point: given the server's rolled item lists, builds one
// complete, ready-to-play board. Everything returned here is what gets
// cached in localStorage for resume.
export function generateShipmentBoard(equipmentItems, fillerItems, cutUnlocked) {
  let fillerPool = [...fillerItems]
  let equipmentPool = [...equipmentItems]
  let sized = pickBoardSize(equipmentPool.length + fillerPool.length)

  // overflow: shrink filler first, then equipment, per Carlo's stated priority
  while (!sized && fillerPool.length > 0) {
    fillerPool = fillerPool.slice(0, -1)
    sized = pickBoardSize(equipmentPool.length + fillerPool.length)
  }
  while (!sized && equipmentPool.length > 0) {
    equipmentPool = equipmentPool.slice(0, -1)
    sized = pickBoardSize(equipmentPool.length + fillerPool.length)
  }
  if (!sized) sized = { size: 9, wallCount: Math.round(WALL_DENSITY * 81) } // last resort, shouldn't hit

  const { size, wallCount } = sized
  const walls = generateWalls(size, wallCount)
  const combinedItems = [
    ...equipmentPool.map(item => ({ kind: 'equipment', item })),
    ...fillerPool.map(item => ({ kind: 'filler', item })),
  ]
  const placements = placeItemsOnBoard(size, walls, combinedItems)

  // tile count: enough to cover most but not all items — roughly half the
  // item count, minimum 3, with a little randomness so it doesn't feel
  // mechanically identical every day
  const tileCount = Math.max(3, Math.round(combinedItems.length / 3) + Math.floor(Math.random() * 3) - 1)
  const tiles = generateTilePool(size, walls, tileCount, cutUnlocked, placements)

  return { size, walls: [...walls], placements: [...placements.entries()], tiles }
}

// ── Extra tile purchase ──────────────────────────────────────────────────
// Price doubles each use within a single board: 100, 200, 400, ...
export function getExtraTileCost(purchaseCount) {
  return 100 * Math.pow(2, purchaseCount)
}

// Total cost if all `count` purchased extra tiles end up used
export function getCumulativeExtraTileCost(count) {
  return count > 0 ? 100 * (Math.pow(2, count) - 1) : 0
}



// ── Board persistence ────────────────────────────────────────────────────
// Much simpler than Depthsle's persistence.js — tiles here are plain data
// (no ability functions to strip/rehydrate), so this is just Set/Map <-> 
// plain-array conversion for localStorage.

function boardStorageKey(townId) {
  return `shipment_board_${townId}_v1`
}

export function saveShipmentBoard(townId, state) {
  try {
    const payload = {
      ...state,
      walls: [...state.walls],
      placements: [...state.placements.entries()],
    }
    localStorage.setItem(boardStorageKey(townId), JSON.stringify(payload))
  } catch (err) {
    console.error('Failed to save shipment board', err)
  }
}

export function loadShipmentBoard(townId, rolledDate) {
  try {
    const raw = localStorage.getItem(boardStorageKey(townId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.rolledDate !== rolledDate) {
      localStorage.removeItem(boardStorageKey(townId))
      return null
    }
    return {
      ...parsed,
      walls: new Set(parsed.walls),
      placements: new Map(parsed.placements),
    }
  } catch (err) {
    console.error('Failed to load shipment board', err)
    localStorage.removeItem(boardStorageKey(townId))
    return null
  }
}

export function clearShipmentBoard(townId) {
  localStorage.removeItem(boardStorageKey(townId))
}