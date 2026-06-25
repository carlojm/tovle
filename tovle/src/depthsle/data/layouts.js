// Room grid layouts.
// Standard rooms: 3×3 or 3×4 (width × height).
// Elite rooms:    4×4 or 4×5.
// Player attacks from outside the grid — row 0 is the front (closest to player).
//
// Each layout: { width, height, enemySlots: [{row, col}] }
// enemySlots lists valid spawn positions for enemies.

export const LAYOUTS = {
  // Standard 3×3 — up to 4 enemies
  s3x3: {
    id: 's3x3',
    width: 3,
    height: 3,
    enemySlots: [
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
      { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 },
      { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 },
    ],
    defaultEnemyCount: 3,
  },

  // Standard 3×4 — more depth, up to 5 enemies
  s3x4: {
    id: 's3x4',
    width: 3,
    height: 4,
    enemySlots: [
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
      { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 },
      { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 },
      { row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 },
    ],
    defaultEnemyCount: 5,
  },

  // Elite 4×4 — up to 5 enemies (elites take up more space conceptually)
  e4x4: {
    id: 'e4x4',
    width: 4,
    height: 4,
    enemySlots: [
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 },
      { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 },
      { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 },
      { row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 },
    ],
    defaultEnemyCount: 4,
  },

  // Elite 4×5
  e4x5: {
    id: 'e4x5',
    width: 4,
    height: 5,
    enemySlots: [
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 },
      { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 },
      { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 },
      { row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 },
      { row: 4, col: 0 }, { row: 4, col: 1 }, { row: 4, col: 2 }, { row: 4, col: 3 },
    ],
    defaultEnemyCount: 6,
  },
}

export const STANDARD_LAYOUT_IDS = ['s3x3', 's3x4']
export const ELITE_LAYOUT_IDS = ['e4x4', 'e4x5']

// Room types and their weights for the room selection roll.
// Adjust weights to tune the run feel.
export const ROOM_TYPES = {
  ability:        { label: 'Ability Room',       reward: 'Ability',   emoji: '✨', weight: 30, isElite: false, gridRow: 1, gridCol: 1 },
  elite_ability:  { label: 'Elite Ability Room', reward: 'Ability',   emoji: '💫', weight: 8,  isElite: true,  gridRow: 3, gridCol: 1 },
  upgrade:        { label: 'Upgrade Room',       reward: 'Upgrade',   emoji: '⬆️', weight: 25, isElite: false, gridRow: 1, gridCol: 9 },
  elite_upgrade:  { label: 'Elite Upgrade Room', reward: 'Upgrade',   emoji: '🔥', weight: 6,  isElite: true,  gridRow: 3, gridCol: 9 },
  treasure:       { label: 'Treasure Room',      reward: 'Treasure',  emoji: '💎', weight: 20, isElite: false, gridRow: 2, gridCol: 3 },
  elite_treasure: { label: 'Elite Treasure Room',reward: 'Treasure',  emoji: '👑', weight: 5,  isElite: true,  gridRow: 2, gridCol: 7 },
}

// Build a weighted list of options for ROOM_SELECT.
// Returns 3 choices, always ensuring at least one non-elite option.
export function seededRoomOptions(rng, roomNumber) {
  const types = Object.keys(ROOM_TYPES)
  const weights = types.map(t => ROOM_TYPES[t].weight)
  const totalWeight = weights.reduce((a, b) => a + b, 0)

  const pick = () => {
    let r = rng() * totalWeight
    for (let i = 0; i < types.length; i++) {
      r -= weights[i]
      if (r <= 0) return types[i]
    }
    return types[types.length - 1]
  }

  const choices = [pick(), pick(), pick()]
  // Guarantee at least one non-elite option.
  if (choices.every(c => ROOM_TYPES[c].isElite)) {
    choices[0] = 'ability'
  }
  return choices
}
