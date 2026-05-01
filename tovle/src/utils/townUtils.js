//functions needed by the frontend and the backend

//total reputation needed to reach a given level
//could be memoized later but prob fine for now
export function getRepForLevel(level) {
  let total = 0
  for (let i = 1; i <= level; i++) {
    total += Math.round(100 * Math.pow(i, 1.2))
  }
  return total
}

//derive town level by total reputation
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