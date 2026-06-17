// Atomic effect functions for Depthsle combat.
//
// Rules:
//   - Every function takes state and returns a NEW state object (never mutates).
//   - State shape is defined in combatReducer.js.
//   - Effects that produce log entries append to state.log.
//   - Push/pull automatically trigger wall collision damage when applicable.

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cloneState(state) {
  return {
    ...state,
    player: { ...state.player, buffs: [...state.player.buffs] },
    enemies: state.enemies.map(e => ({
      ...e,
      statuses: [...e.statuses],
      cell: { ...e.cell },
    })),
    gridState: {
      ...state.gridState,
      frozenTiles: new Set(state.gridState.frozenTiles),
      tokens: state.gridState.tokens.map(t => ({ ...t, cell: { ...t.cell } })),
    },
    log: [...state.log],
  }
}

function log(state, msg) {
  return { ...state, log: [...state.log, msg] }
}

// Find a live enemy by instanceId.
function findEnemy(state, instanceId) {
  return state.enemies.find(e => e.instanceId === instanceId)
}

// Replace an enemy in the array (immutably).
function replaceEnemy(state, updated) {
  return {
    ...state,
    enemies: state.enemies.map(e => e.instanceId === updated.instanceId ? updated : e),
  }
}

// Resolve all active buff modifiers for a stat on the player.
export function getPlayerBuff(state, buffType) {
  return state.player.buffs
    .filter(b => b.type === buffType)
    .reduce((acc, b) => acc + b.value, 0)
}

// Tile key for frozenTiles Set.
const tileKey = ({ row, col }) => `${row},${col}`

// Is a tile frozen?
function isFrozen(state, cell) {
  return state.gridState.frozenTiles.has(tileKey(cell))
}

// All enemies on a given cell.
function enemiesAt(state, cell) {
  return state.enemies.filter(e => e.cell.row === cell.row && e.cell.col === cell.col)
}

// All enemies in a row.
function enemiesInRow(state, row) {
  return state.enemies.filter(e => e.cell.row === row)
}

// All enemies in a col.
function enemiesInCol(state, col) {
  return state.enemies.filter(e => e.cell.col === col)
}

// All live enemies within a square radius of a cell (Chebyshev distance).
function enemiesInRadius(state, centerCell, radius) {
  return state.enemies.filter(e =>
    Math.abs(e.cell.row - centerCell.row) <= radius &&
    Math.abs(e.cell.col - centerCell.col) <= radius
  )
}

// Nearest other enemy (by Manhattan distance) excluding one instanceId.
function nearestEnemy(state, cell, excludeId) {
  const others = state.enemies.filter(e => e.instanceId !== excludeId)
  if (others.length === 0) return null
  return others.reduce((best, e) => {
    const d = Math.abs(e.cell.row - cell.row) + Math.abs(e.cell.col - cell.col)
    const bd = Math.abs(best.cell.row - cell.row) + Math.abs(best.cell.col - cell.col)
    return d < bd ? e : best
  })
}

// Pyromania bonus: % damage per burning mob.
function pyromaniaBonus(state) {
  const passive = state.equippedPassives?.find(p => p.id === 'pyromania')
  if (!passive) return 0
  const burningCount = state.enemies.filter(e => e.statuses.some(s => s.type === 'burn')).length
  return burningCount * passive.rarityValues[passive.rarity] / 100
}

// Sharpshooter bonus for projectile damage.
function sharpshooterBonus(state) {
  const passive = state.equippedPassives?.find(p => p.id === 'sharpshooter')
  if (!passive) return 0
  return (state.player.sharpshooterStacks ?? 0) * passive.rarityValues[passive.rarity] / 100
}

// Icebreaker bonus vs frozen/debuffed targets.
function icebreakerBonus(state, enemy) {
  const passive = state.equippedPassives?.find(p => p.id === 'icebreaker')
  if (!passive) return 0
  const vals = passive.rarityValues[passive.rarity]
  let bonus = 0
  if (isFrozen(state, enemy.cell)) bonus += vals.frozen / 100
  else if (enemy.statuses.length > 0) bonus += vals.debuff / 100
  return bonus
}

// Aeromancy bonus: damage when stacked or pushing into wall.
function aeromancyBonus(state, enemy, isWallCollision = false) {
  const passive = state.equippedPassives?.find(p => p.id === 'aeromancy')
  if (!passive) return 0
  const stacked = enemiesAt(state, enemy.cell).length > 1
  if (!stacked && !isWallCollision) return 0
  return passive.rarityValues[passive.rarity] / 100
}

// Weakness stacks → bonus damage multiplier.
function weaknessMultiplier(enemy) {
  const ws = enemy.statuses.find(s => s.type === 'weakness')
  if (!ws) return 1
  return 1 + ws.stacks * 0.1  // +10% per stack, max 5 = +50%
}

// Deadly Strike bonus vs weakened enemy.
function deadlyStrikeBonus(state, enemy) {
  const passive = state.equippedPassives?.find(p => p.id === 'deadly_strike')
  if (!passive) return 0
  if (!enemy.statuses.some(s => s.type === 'weakness')) return 0
  return passive.rarityValues[passive.rarity] / 100
}

// Dethroner bonus vs elites.
function dethronerBonus(state, enemy) {
  const passive = state.equippedPassives?.find(p => p.id === 'dethroner')
  if (!passive) return 0
  if (!enemy.isElite) return 0
  return passive.rarityValues[passive.rarity] / 100
}

// Primordial Mastery bonus for Flamecaller magic damage.
function primordialMasteryBonus(state, cardTree) {
  const passive = state.equippedPassives?.find(p => p.id === 'primordial_mastery')
  if (!passive || cardTree !== 'flamecaller') return 0
  return passive.rarityValues[passive.rarity] / 100
}

// Compute final damage for a hit, applying all relevant passive bonuses.
export function computeDamage(state, baseAmount, damageType, enemy, opts = {}) {
  let dmg = baseAmount

  // Resistance buff reduces incoming damage.
  const resistance = getPlayerBuff(state, 'resistance') / 100
  // (resistance is a player buff, applied when player takes damage not here)

  // Damage type bonuses from passives.
  if (damageType === 'magic') {
    dmg *= 1 + pyromaniaBonus(state)
    dmg *= 1 + primordialMasteryBonus(state, opts.cardTree ?? '')
    dmg *= 1 + icebreakerBonus(state, enemy)
  }
  if (damageType === 'projectile') {
    dmg *= 1 + sharpshooterBonus(state)
    dmg *= 1 + icebreakerBonus(state, enemy)
  }
  if (damageType === 'melee') {
    dmg *= 1 + icebreakerBonus(state, enemy)
  }

  // Weakness stacks.
  dmg *= weaknessMultiplier(enemy)

  // Deadly Strike vs weakened.
  dmg *= 1 + deadlyStrikeBonus(state, enemy)

  // Dethroner vs elites.
  dmg *= 1 + dethronerBonus(state, enemy)

  // Aeromancy.
  dmg *= 1 + aeromancyBonus(state, enemy, opts.isWallCollision)

  // Player damage_bonus buff (flat %).
  dmg *= 1 + getPlayerBuff(state, 'damage_bonus') / 100

  return Math.max(1, Math.round(dmg))
}

// ─── Core Damage Atoms ────────────────────────────────────────────────────────

// Apply damage to a single enemy. Returns new state (may remove enemy if dead).
export function dealDamage(state, enemyId, amount, damageType = 'melee', opts = {}) {
  let s = cloneState(state)
  const enemy = findEnemy(s, enemyId)
  if (!enemy) return s

  const finalDmg = computeDamage(s, amount, damageType, enemy, opts)
  const newHp = Math.max(0, enemy.hp - finalDmg)
  const updated = { ...enemy, hp: newHp }

  s = replaceEnemy(s, updated)
  s = log(s, `${enemy.name} takes ${finalDmg} ${damageType} damage (${newHp}/${enemy.maxHp} HP)`)

  // Enrage check.
  if (updated.enrageThreshold && !updated.enraged && newHp / updated.maxHp <= updated.enrageThreshold) {
    s = replaceEnemy(s, { ...updated, enraged: true })
    s = log(s, `${enemy.name} enrages!`)
  }

  if (newHp <= 0) {
    s = killEnemy(s, enemyId, opts)
  }

  return s
}

// Deal damage to all enemies in a 2D area (Chebyshev radius from center).
export function dealDamageAoe(state, centerCell, radius, amount, damageType = 'magic', opts = {}) {
  let s = cloneState(state)
  const targets = enemiesInRadius(s, centerCell, radius)
  const hitCount = targets.length
  for (const e of targets) {
    s = dealDamage(s, e.instanceId, amount, damageType, opts)
  }
  // Passive: on_aoe_hit_three_plus
  if (hitCount >= 3) {
    s = { ...s, _lastAoeHitCount: hitCount }
  }
  return s
}

// Deal damage to all enemies in a row.
export function dealDamageRow(state, row, amount, damageType = 'magic', opts = {}) {
  let s = cloneState(state)
  const targets = enemiesInRow(s, row)
  const hitCount = targets.length
  for (const e of targets) {
    s = dealDamage(s, e.instanceId, amount, damageType, opts)
  }
  if (hitCount >= 3) s = { ...s, _lastAoeHitCount: hitCount }
  return s
}

// Deal damage to all enemies in a column.
export function dealDamageCol(state, col, amount, damageType = 'magic', opts = {}) {
  let s = cloneState(state)
  const targets = enemiesInCol(s, col)
  const hitCount = targets.length
  for (const e of targets) {
    s = dealDamage(s, e.instanceId, amount, damageType, opts)
  }
  if (hitCount >= 3) s = { ...s, _lastAoeHitCount: hitCount }
  return s
}

// Deal damage to enemies along a line between two cells (inclusive).
export function dealDamageLine(state, cellA, cellB, amount, damageType = 'magic', opts = {}) {
  let s = cloneState(state)
  const cells = cellsBetween(cellA, cellB)
  const hitIds = new Set()
  for (const cell of cells) {
    for (const e of enemiesAt(s, cell)) {
      if (!hitIds.has(e.instanceId)) {
        hitIds.add(e.instanceId)
        s = dealDamage(s, e.instanceId, amount, damageType, opts)
      }
    }
  }
  return s
}

// Hit the first enemy encountered in a column (for ranged/projectile shots).
export function dealDamageFirstInCol(state, col, amount, damageType = 'projectile', opts = {}) {
  let s = cloneState(state)
  const inCol = s.enemies
    .filter(e => e.cell.col === col)
    .sort((a, b) => a.cell.row - b.cell.row)
  if (inCol.length === 0) return s
  s = dealDamage(s, inCol[0].instanceId, amount, damageType, opts)
  return s
}

// Hit the first enemy in a row.
export function dealDamageFirstInRow(state, row, amount, damageType = 'projectile', opts = {}) {
  let s = cloneState(state)
  const inRow = s.enemies
    .filter(e => e.cell.row === row)
    .sort((a, b) => a.cell.col - b.cell.col)
  if (inRow.length === 0) return s
  s = dealDamage(s, inRow[0].instanceId, amount, damageType, opts)
  return s
}

// Shrapnel: deal % of primaryDamage to all 8 surrounding cells.
export function dealDamageShrapnel(state, centerCell, primaryDamage, shrapnelPct, damageType = 'melee', opts = {}) {
  let s = cloneState(state)
  const shrapnel = Math.round(primaryDamage * shrapnelPct)
  const adjacent = [
    { row: centerCell.row - 1, col: centerCell.col - 1 },
    { row: centerCell.row - 1, col: centerCell.col },
    { row: centerCell.row - 1, col: centerCell.col + 1 },
    { row: centerCell.row,     col: centerCell.col - 1 },
    { row: centerCell.row,     col: centerCell.col + 1 },
    { row: centerCell.row + 1, col: centerCell.col - 1 },
    { row: centerCell.row + 1, col: centerCell.col },
    { row: centerCell.row + 1, col: centerCell.col + 1 },
  ].filter(c => isValidCell(s, c))
  for (const cell of adjacent) {
    for (const e of enemiesAt(s, cell)) {
      s = dealDamage(s, e.instanceId, shrapnel, damageType, opts)
    }
  }
  return s
}

// ─── Status Effects ───────────────────────────────────────────────────────────

// Apply a non-stacking status (stun, root, silence, slow, burn) to an enemy.
// burn replaces if new duration is longer or equal.
export function applyStatus(state, enemyId, statusType, duration) {
  let s = cloneState(state)
  const enemy = findEnemy(s, enemyId)
  if (!enemy) return s

  // Stun overrides root, silence, slow (they're all pauses).
  const existing = enemy.statuses.findIndex(st => st.type === statusType)
  let updatedStatuses
  if (existing >= 0) {
    updatedStatuses = enemy.statuses.map((st, i) =>
      i === existing ? { ...st, duration: Math.max(st.duration, duration) } : st
    )
  } else {
    updatedStatuses = [...enemy.statuses, { type: statusType, duration, stacks: 1 }]
  }

  s = replaceEnemy(s, { ...enemy, statuses: updatedStatuses })
  s = log(s, `${enemy.name} gains ${statusType} for ${duration} turns`)
  return s
}

// Apply stacking weakness (max 5 stacks).
export function applyWeaknessStacks(state, enemyId, stacks) {
  let s = cloneState(state)
  const enemy = findEnemy(s, enemyId)
  if (!enemy) return s

  const existing = enemy.statuses.find(st => st.type === 'weakness')
  let updatedStatuses
  if (existing) {
    updatedStatuses = enemy.statuses.map(st =>
      st.type === 'weakness'
        ? { ...st, stacks: Math.min(5, st.stacks + stacks) }
        : st
    )
  } else {
    updatedStatuses = [...enemy.statuses, { type: 'weakness', duration: Infinity, stacks: Math.min(5, stacks) }]
  }
  s = replaceEnemy(s, { ...enemy, statuses: updatedStatuses })
  s = log(s, `${enemy.name} gains ${stacks} weakness stack(s)`)
  return s
}

// Apply burn (DoT). Does not stack — refreshes duration.
export function applyBurn(state, enemyId, damagePerTurn, duration, damageType = 'magic') {
  let s = applyStatus(state, enemyId, 'burn', duration)
  const enemy = findEnemy(s, enemyId)
  if (!enemy) return s
  s = replaceEnemy(s, { ...enemy, burnDamage: damagePerTurn, burnType: damageType })
  return s
}

// Alias used by imports that reference applyBurnCompat.
export { applyBurn as applyBurnCompat }

// Tick burn DoT for an enemy (called at start of each enemy turn).
export function tickBurn(state, enemyId) {
  let s = cloneState(state)
  const enemy = findEnemy(s, enemyId)
  if (!enemy) return s
  const burn = enemy.statuses.find(st => st.type === 'burn')
  if (!burn || burn.duration <= 0) return s
  s = dealDamage(s, enemyId, enemy.burnDamage ?? 2, enemy.burnType ?? 'magic', { isBurnTick: true })
  // Reduce duration.
  const updated = findEnemy(s, enemyId)
  if (!updated) return s
  const newStatuses = updated.statuses.map(st =>
    st.type === 'burn' ? { ...st, duration: st.duration - 1 } : st
  ).filter(st => !(st.type === 'burn' && st.duration <= 0))
  return replaceEnemy(s, { ...updated, statuses: newStatuses })
}

// Tick all non-burn statuses (decrement duration, remove expired).
export function tickStatuses(state, enemyId) {
  let s = cloneState(state)
  const enemy = findEnemy(s, enemyId)
  if (!enemy) return s
  const newStatuses = enemy.statuses
    .map(st => st.type === 'burn' ? st : { ...st, duration: st.duration - 1 })
    .filter(st => st.duration > 0 || st.duration === Infinity)
  return replaceEnemy(s, { ...enemy, statuses: newStatuses })
}

// ─── Player HP / Absorption ──────────────────────────────────────────────────

// Heal player by flat amount (capped at maxHp).
export function healPlayer(state, amount) {
  let s = cloneState(state)
  const before = s.player.hp
  const newHp = Math.min(s.player.maxHp, s.player.hp + Math.round(amount))
  s = { ...s, player: { ...s.player, hp: newHp } }
  if (newHp > before) s = log(s, `Player heals ${newHp - before} HP (${newHp}/${s.player.maxHp})`)
  return s
}

// Heal player by % of maxHp.
export function healPlayerPercent(state, pct) {
  return healPlayer(state, state.player.maxHp * pct)
}

// Grant absorption (temporary HP, separate pool). Additive.
export function applyAbsorption(state, amount) {
  let s = cloneState(state)
  const newAbs = (s.player.absorption ?? 0) + Math.round(amount)
  s = { ...s, player: { ...s.player, absorption: newAbs } }
  s = log(s, `Player gains ${Math.round(amount)} absorption`)
  return s
}

// Deal damage to player (absorption first, then HP).
export function damagePlayer(state, amount, source = 'enemy') {
  let s = cloneState(state)
  const resistance = Math.min(0.95, getPlayerBuff(s, 'resistance') / 100)
  let dmg = Math.round(amount * (1 - resistance))

  // Bulwark check: handled in passives, not here.

  // Absorption first.
  const abs = s.player.absorption ?? 0
  if (abs > 0) {
    const absUsed = Math.min(abs, dmg)
    dmg -= absUsed
    s = { ...s, player: { ...s.player, absorption: abs - absUsed } }
  }

  const newHp = Math.max(0, s.player.hp - dmg)
  s = { ...s, player: { ...s.player, hp: newHp, tookDamageRecently: true, tookDamageRecentlyTurnsLeft: 2 } }
  s = log(s, `Player takes ${dmg} damage from ${source} (${newHp}/${s.player.maxHp} HP)`)
  return s
}

// ─── Player Buffs ─────────────────────────────────────────────────────────────

// Apply a temporary buff to the player.
export function applyBuff(state, buffType, value, turnsRemaining) {
  let s = cloneState(state)
  const existing = s.player.buffs.findIndex(b => b.type === buffType)
  let newBuffs
  if (existing >= 0) {
    newBuffs = s.player.buffs.map((b, i) =>
      i === existing ? { ...b, value: Math.max(b.value, value), turnsRemaining: Math.max(b.turnsRemaining, turnsRemaining) } : b
    )
  } else {
    newBuffs = [...s.player.buffs, { type: buffType, value, turnsRemaining }]
  }
  s = { ...s, player: { ...s.player, buffs: newBuffs } }
  s = log(s, `Player gains ${buffType} +${value}% for ${turnsRemaining} turns`)
  return s
}

// Apply a permanent stat modifier (at run start, e.g. Toughness).
export function modifyStat(state, stat, value, mode = 'percent') {
  let s = cloneState(state)
  if (stat === 'max_hp') {
    const bonus = mode === 'percent' ? Math.round(s.player.maxHp * value / 100) : value
    s = { ...s, player: { ...s.player, maxHp: s.player.maxHp + bonus, hp: s.player.hp + bonus } }
    s = log(s, `Player max HP increased by ${bonus} (now ${s.player.maxHp})`)
  }
  return s
}

// Tick player buffs (call at end of each enemy turn).
export function tickPlayerBuffs(state) {
  let s = cloneState(state)
  const newBuffs = s.player.buffs
    .map(b => ({ ...b, turnsRemaining: b.turnsRemaining - 1 }))
    .filter(b => b.turnsRemaining > 0)
  // Tick tookDamageRecently.
  const tdr = (s.player.tookDamageRecentlyTurnsLeft ?? 0) - 1
  // Tick sharpshooter decay.
  const ssDecay = (s.player.sharpshooterDecayTurns ?? 0) - 1
  // Tick webbed.
  const webbed = Math.max(0, (s.player.webbed ?? 0) - 1)
  // Tick healOnKill window.
  const hokTurns = Math.max(0, (s.player.healOnKillTurnsLeft ?? 0) - 1)
  s = { ...s, player: {
    ...s.player,
    buffs: newBuffs,
    tookDamageRecentlyTurnsLeft: Math.max(0, tdr),
    tookDamageRecently: tdr > 0,
    sharpshooterDecayTurns: Math.max(0, ssDecay),
    sharpshooterStacks: ssDecay <= 0 ? 0 : s.player.sharpshooterStacks,
    webbed,
    healOnKillTurnsLeft: hokTurns,
    healOnKillPct: hokTurns > 0 ? s.player.healOnKillPct : 0,
  }}
  return s
}

// Apply a DoT to the player (poison, bleed). Separate from enemy statuses.
export function applyPlayerDoT(state, damagePerTurn, duration, type = 'magic') {
  let s = cloneState(state)
  const dots = [...(s.player.playerDoTs ?? [])]
  const existing = dots.findIndex(d => d.type === type)
  if (existing >= 0) {
    dots[existing] = { ...dots[existing], turnsLeft: Math.max(dots[existing].turnsLeft, duration) }
  } else {
    dots.push({ damage: damagePerTurn, turnsLeft: duration, type })
  }
  return { ...s, player: { ...s.player, playerDoTs: dots } }
}

// Tick player DoTs (call each enemy turn).
export function tickPlayerDoTs(state) {
  let s = cloneState(state)
  const dots = s.player.playerDoTs ?? []
  if (dots.length === 0) return s
  let totalDmg = 0
  const remaining = []
  for (const dot of dots) {
    totalDmg += dot.damage
    if (dot.turnsLeft > 1) remaining.push({ ...dot, turnsLeft: dot.turnsLeft - 1 })
  }
  if (totalDmg > 0) {
    s = damagePlayer(s, totalDmg, 'DoT')
    s = log(s, `Player takes ${totalDmg} DoT damage`)
  }
  return { ...s, player: { ...s.player, playerDoTs: remaining } }
}

// ─── Movement ─────────────────────────────────────────────────────────────────

const WALL_COLLISION_DAMAGE = 8 // flat damage; scales with room number in reducer

// Clamp a cell to grid bounds. Returns null if already in bounds, or new cell if clamped.
function clampCell(state, cell) {
  const { width, height } = state.gridState
  const clamped = {
    row: Math.max(0, Math.min(height - 1, cell.row)),
    col: Math.max(0, Math.min(width - 1, cell.col)),
  }
  const hitWall = clamped.row !== cell.row || clamped.col !== cell.col
  return { cell: clamped, hitWall }
}

function isValidCell(state, cell) {
  const { width, height } = state.gridState
  return cell.row >= 0 && cell.row < height && cell.col >= 0 && cell.col < width
}

// Cells between two points (line). Supports horizontal, vertical, and diagonal.
export function cellsBetween(a, b) {
  const cells = []
  const dr = Math.sign(b.row - a.row)
  const dc = Math.sign(b.col - a.col)
  let cur = { ...a }
  while (cur.row !== b.row || cur.col !== b.col) {
    cells.push({ ...cur })
    cur = { row: cur.row + dr, col: cur.col + dc }
  }
  cells.push({ ...b })
  return cells
}

// Push an enemy in a direction by N tiles.
// direction: 'back' | 'front' | 'left' | 'right'
export function pushEnemy(state, enemyId, direction, tiles) {
  let s = cloneState(state)
  const enemy = findEnemy(s, enemyId)
  if (!enemy) return s
  if (enemy.statuses.some(st => st.type === 'root' || st.type === 'stun')) return s

  // Whirlwind active: +1 tile.
  const extraTiles = s.player.whirlwindActive ? 1 : 0
  const totalTiles = tiles + extraTiles

  const delta = directionDelta(direction)
  let newCell = {
    row: enemy.cell.row + delta.row * totalTiles,
    col: enemy.cell.col + delta.col * totalTiles,
  }

  const { cell: clamped, hitWall } = clampCell(s, newCell)

  // Slide on frozen tiles: continue in same direction until non-frozen or wall.
  if (isFrozen(s, clamped) && !hitWall) {
    let slide = { ...clamped }
    while (isFrozen(s, { row: slide.row + delta.row, col: slide.col + delta.col }) &&
           isValidCell(s, { row: slide.row + delta.row, col: slide.col + delta.col })) {
      slide = { row: slide.row + delta.row, col: slide.col + delta.col }
    }
    newCell = slide
  } else {
    newCell = clamped
  }

  s = replaceEnemy(s, { ...enemy, cell: newCell })
  s = log(s, `${enemy.name} pushed ${direction} to (${newCell.row},${newCell.col})`)

  // Wall collision damage.
  if (hitWall) {
    const roomMult = 1 + (s.roomNumber ?? 0) * 0.08
    const wallDmg = Math.round(WALL_COLLISION_DAMAGE * roomMult)
    s = dealDamage(s, enemyId, wallDmg, 'melee', { isWallCollision: true })
    s = log(s, `Wall collision! ${enemy.name} takes ${wallDmg} damage`)
    s = { ...s, _lastPushWasWallCollision: true, _lastPushVictim: enemyId }
  }

  // Fire on_push passive event.
  s = { ...s, _pendingPassiveEvent: { type: 'on_push', payload: { enemyId, hitWall } } }

  return s
}

// Push all enemies in a direction.
export function pushAll(state, direction, tiles) {
  let s = cloneState(state)
  for (const e of [...s.enemies]) {
    s = pushEnemy(s, e.instanceId, direction, tiles)
  }
  return s
}

// Pull an enemy to a specific cell.
export function pullEnemy(state, enemyId, targetCell) {
  let s = cloneState(state)
  const enemy = findEnemy(s, enemyId)
  if (!enemy) return s
  if (enemy.statuses.some(st => st.type === 'root' || st.type === 'stun')) return s

  const { cell: clamped } = clampCell(s, targetCell)
  s = replaceEnemy(s, { ...enemy, cell: clamped })
  s = log(s, `${enemy.name} pulled to (${clamped.row},${clamped.col})`)
  return s
}

// Pull two enemies toward each other; deal collision damage if they end up on same cell.
export function pullTowardEachOther(state, enemyIdA, enemyIdB, collisionDamage, damageType = 'magic') {
  let s = cloneState(state)
  const a = findEnemy(s, enemyIdA)
  const b = findEnemy(s, enemyIdB)
  if (!a || !b) return s

  const midRow = Math.round((a.cell.row + b.cell.row) / 2)
  const midCol = Math.round((a.cell.col + b.cell.col) / 2)
  const mid = { row: midRow, col: midCol }

  s = pullEnemy(s, enemyIdA, mid)
  s = pullEnemy(s, enemyIdB, mid)

  // Collision check.
  const aNew = findEnemy(s, enemyIdA)
  const bNew = findEnemy(s, enemyIdB)
  if (aNew && bNew && aNew.cell.row === bNew.cell.row && aNew.cell.col === bNew.cell.col) {
    s = dealDamage(s, enemyIdA, collisionDamage, damageType)
    s = dealDamage(s, enemyIdB, collisionDamage, damageType)
    s = log(s, `Collision! ${a.name} and ${b.name} collide.`)
  }
  return s
}

// Pull all enemies toward a cell (used by Guarding Bolt, Gravity Bomb).
export function pullAll(state, targetCell) {
  let s = cloneState(state)
  for (const e of [...s.enemies]) {
    s = pullEnemy(s, e.instanceId, targetCell)
  }
  return s
}

function directionDelta(direction) {
  switch (direction) {
    case 'back':  return { row: 1, col: 0 }   // away from player
    case 'front': return { row: -1, col: 0 }  // toward player
    case 'left':  return { row: 0, col: -1 }
    case 'right': return { row: 0, col: 1 }
    case 'sideways_random': return Math.random() < 0.5 ? { row: 0, col: -1 } : { row: 0, col: 1 }
    default: return { row: 0, col: 0 }
  }
}

// ─── Tile Effects ─────────────────────────────────────────────────────────────

export function freezeTile(state, cell) {
  let s = cloneState(state)
  s.gridState.frozenTiles.add(tileKey(cell))
  return s
}

export function freezeTiles(state, cells) {
  let s = cloneState(state)
  for (const cell of cells) {
    s.gridState.frozenTiles.add(tileKey(cell))
  }
  return s
}

// Shatter all frozen tiles: damage mobs on them, remove frozen.
export function shatterFrozenTiles(state, damage, damageType = 'magic') {
  let s = cloneState(state)
  for (const key of [...s.gridState.frozenTiles]) {
    const [row, col] = key.split(',').map(Number)
    for (const e of enemiesAt(s, { row, col })) {
      s = dealDamage(s, e.instanceId, damage, damageType)
    }
  }
  s.gridState.frozenTiles.clear()
  return s
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

let _tokenCounter = 0

export function placeToken(state, cell, tokenType, lifespan, data = {}) {
  let s = cloneState(state)
  const token = {
    id: `token_${++_tokenCounter}`,
    type: tokenType,
    cell,
    turnsLeft: lifespan === Infinity ? 9999 : lifespan,
    data,
  }
  s = { ...s, gridState: { ...s.gridState, tokens: [...s.gridState.tokens, token] } }
  s = log(s, `Placed ${tokenType} token at (${cell.row},${cell.col})`)
  return s
}

export function removeToken(state, tokenId) {
  return {
    ...state,
    gridState: {
      ...state.gridState,
      tokens: state.gridState.tokens.filter(t => t.id !== tokenId),
    },
  }
}

// ─── Cards ────────────────────────────────────────────────────────────────────

let _cardInstanceCounter = 0

export function drawCard(state, cardDefinition, source = 'passive') {
  let s = cloneState(state)
  const instance = {
    instanceId: `card_${++_cardInstanceCounter}`,
    cardId: cardDefinition.id,
    source,
    rarity: cardDefinition.rarity ?? 0,
  }
  s = { ...s, hand: [...(s.hand ?? []), instance] }
  s = log(s, `Drew ${cardDefinition.name} (${source})`)
  return s
}

export function returnCardToHand(state, cardId) {
  // Re-add a card with the same cardId back to hand.
  const hand = state.hand ?? []
  const existing = hand.find(c => c.cardId === cardId)
  if (!existing) return state
  return { ...state, hand: [...hand, { ...existing, instanceId: `card_${++_cardInstanceCounter}` }] }
}

export function removeCardFromHand(state, instanceId) {
  return { ...state, hand: (state.hand ?? []).filter(c => c.instanceId !== instanceId) }
}

// ─── Enemy Death ──────────────────────────────────────────────────────────────

export function killEnemy(state, enemyId, opts = {}) {
  let s = cloneState(state)
  const enemy = findEnemy(s, enemyId)
  if (!enemy) return s

  const wasStacked = enemiesAt(s, enemy.cell).length > 1

  s = { ...s,
    enemies: s.enemies.filter(e => e.instanceId !== enemyId),
    killCount: (s.killCount ?? 0) + 1,
    killCountRoom: (s.killCountRoom ?? 0) + 1,
    _lastKilledEnemy: enemy,
    _lastKillWasWallCollision: opts.isWallCollision ?? false,
    _lastKillWasStacked: wasStacked,
  }
  s = log(s, `${enemy.name} defeated! (${s.killCount} total kills)`)

  // Heal-on-kill window (set by Apocalypse, Eternal Savior, Steel Stallion).
  if ((s.player.healOnKillPct ?? 0) > 0 && (s.player.healOnKillTurnsLeft ?? 0) > 0) {
    s = healPlayerPercent(s, s.player.healOnKillPct)
    s = log(s, `Heal on kill: +${Math.round(s.player.healOnKillPct * 100)}% max HP`)
  }

  return s
}

// ─── Enemy Movement (AI) ──────────────────────────────────────────────────────

// Move an enemy one step toward row 0 (player edge).
export function moveEnemyTowardPlayer(state, enemyId) {
  let s = cloneState(state)
  const enemy = findEnemy(s, enemyId)
  if (!enemy) return s
  if (enemy.statuses.some(st => st.type === 'root' || st.type === 'stun')) return s

  const targetRow = Math.max(0, enemy.cell.row - enemy.moveSpeed)
  const newCell = { ...enemy.cell, row: targetRow }

  // Slide on frozen tiles.
  const finalCell = isFrozen(s, newCell)
    ? { ...newCell, row: Math.max(0, newCell.row - 1) }
    : newCell

  s = replaceEnemy(s, { ...enemy, cell: finalCell })
  return s
}

// Increment an enemy's action bar. Returns { newState, acted }.
export function tickEnemyActionBar(state, enemyId) {
  let s = cloneState(state)
  const enemy = findEnemy(s, enemyId)
  if (!enemy) return { newState: s, acted: false }

  // Slowed = half speed.
  const isSlowed = enemy.statuses.some(st => st.type === 'slow') || isFrozen(s, enemy.cell)
  const speedMult = isSlowed ? 0.5 : 1
  let speed = enemy.actionBarSpeed * speedMult

  // Enraged speed bonus.
  if (enemy.enraged) speed += enemy.enragedSpeedBonus ?? 0

  const newBar = enemy.actionBar + speed
  if (newBar >= enemy.actionBarMax) {
    s = replaceEnemy(s, { ...enemy, actionBar: 0 })
    return { newState: s, acted: true }
  } else {
    s = replaceEnemy(s, { ...enemy, actionBar: newBar })
    return { newState: s, acted: false }
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export { isFrozen, enemiesAt, enemiesInRow, enemiesInCol, enemiesInRadius, nearestEnemy, isValidCell, findEnemy, replaceEnemy }
