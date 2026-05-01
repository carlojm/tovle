//functions needed by the frontend and the backend

export function getRepForLevel(level) {
  let total = 0
  for (let i = 1; i <= level; i++) {
    total += Math.round(100 * Math.pow(i, 1.3))
  }
  return total
}

export function getTownLevel(reputation) {
  let level = 0
  while (reputation >= getRepForLevel(level + 1)) {
    level++
  }
  return level
}

// reputation needed for next level
export function getRepForNextLevel(reputation) {
  const currentLevel = getTownLevel(reputation)
  return getRepForLevel(currentLevel + 1)
}