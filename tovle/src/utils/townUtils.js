//functions needed by the frontend and the backend

//total reputation needed to reach a given level
//could be memoized later but prob fine for now
// export function getRepForLevel(level) {
//   let total = 0
//   for (let i = 1; i <= level; i++) {
//     const cost = i === 1
//       ? Math.round(100 * Math.pow(i, 1.2))
//       : Math.round(100 * Math.pow(i, 1.15)) - 100
//     total += cost
//   }
//   return total
// }
function getRepForLevel(level) {
  let total = 0
  for (let i = 1; i <= level; i++) {
    const cost = i === 1
      ? 150
      : Math.round(120 * Math.sqrt(i) + (i * 30))
    total += cost
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

// reputation threshold for current level
export function getRepForCurrentLevel(reputation) {
  const currentLevel = getTownLevel(reputation)
  return getRepForLevel(currentLevel)
}