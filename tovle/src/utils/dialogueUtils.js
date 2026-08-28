// evaluate entry conditions to find the starting node
export const resolveEntryNode = (dialogue, conditions, playerData, flags) => {
  for (const entry of dialogue.entry) {
    if (entry.default) return entry.node
    const conditionFn = conditions[entry.condition]
    if (conditionFn && conditionFn(playerData, flags)) return entry.node
  }
  return dialogue.entry[dialogue.entry.length - 1].node
}

// resolve text — handles both string and function nodes
export const resolveText = (text, playerData) => {
  if (typeof text === 'function') return text(playerData)
  return text
}