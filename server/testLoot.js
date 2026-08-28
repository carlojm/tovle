import { rollLoot, scoreToLuckMultiplier } from './loot.js'

const printGrid = (grid) => {
  console.log('\n--- GRID (3x9) ---')
  for (let row = 0; row < 3; row++) {
    const rowItems = grid.slice(row * 9, row * 9 + 9)
    const rowStr = rowItems.map(slot => {
      if (!slot) return ''.padEnd(28)
      const label = `${slot.name}${slot.quantity > 1 ? ` x${slot.quantity}` : ''}`
      return label.padEnd(28)
    }).join(' | ')
    console.log(rowStr)
  }
}

const printItems = (items) => {
  console.log('\n--- ITEMS ROLLED ---')
  const counts = {}
  for (const item of items) {
    counts[item.itemId] = (counts[item.itemId] ?? 0) + 1
  }
  for (const [id, count] of Object.entries(counts)) {
    console.log(`  ${id}: ${count}`)
  }
  console.log(`  TOTAL: ${items.length} items`)
}

const runTest = (label, multipliers) => {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`TEST: ${label}`)
  console.log('='.repeat(60))
  const { items, grid } = rollLoot(multipliers)
  printItems(items)
  printGrid(grid)
}

// base luck, average score
runTest('Base luck, average score (score 55)', {
  global: scoreToLuckMultiplier(55),
  items: {}
})

// base luck, perfect score
runTest('Base luck, perfect score (score 100)', {
  global: scoreToLuckMultiplier(100),
  items: {}
})

// base luck, bad score
runTest('Base luck, bad score (score 25)', {
  global: scoreToLuckMultiplier(25),
  items: {}
})

// luck tier 3, perfect score
runTest('Luck tier 3, perfect score', {
  global: (1.0 + 3 * 0.1) * scoreToLuckMultiplier(100),
  items: {}
})

// high multiplier to test stacking
runTest('High multiplier (5x) to test grid stacking', {
  global: 5.0,
  items: {}
})

// item specific multiplier
runTest('Harbinger item multiplier 8x', {
  global: 1.0,
  items: { harbinger: 8.0 }
})