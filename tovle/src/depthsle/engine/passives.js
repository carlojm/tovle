// Passive registry for Depthsle.
//
// Abilities register handlers for specific event types. When an event fires
// (e.g. on_kill), all registered handlers for that event run in sequence and
// return updated state.
//
// Event types:
//   on_kill             — payload: { enemy } (the dead enemy instance)
//   on_push             — payload: { enemyId, hitWall }
//   on_attack_received  — payload: { damage, source } (before HP is applied)
//   on_card_played      — payload: { card, hitTargets, damageType }
//   on_draw             — payload: { card }
//   on_heal             — payload: { amount }
//   on_room_start       — payload: {}
//   on_room_clear       — payload: {}
//   on_low_health       — payload: { threshold } (fires once per run per passive)
//   on_aoe_hit_three_plus — payload: { hitCount }
//
// Handlers are pure: (state, payload) => newState.

const _registry = new Map() // eventType → [{ abilityId, handler, rarity }]

export function registerPassive(abilityId, eventType, handler, rarity = 0) {
  if (!_registry.has(eventType)) _registry.set(eventType, [])
  // Replace if already registered (e.g. rarity upgrade).
  const existing = _registry.get(eventType)
  const idx = existing.findIndex(e => e.abilityId === abilityId)
  if (idx >= 0) {
    existing[idx] = { abilityId, handler, rarity }
  } else {
    existing.push({ abilityId, handler, rarity })
  }
}

export function unregisterPassive(abilityId) {
  for (const [, handlers] of _registry) {
    const idx = handlers.findIndex(e => e.abilityId === abilityId)
    if (idx >= 0) handlers.splice(idx, 1)
  }
}

export function clearAllPassives() {
  _registry.clear()
}

// Fire all registered handlers for an event type.
// Returns new state after all handlers have run.
export function fireEvent(state, eventType, payload = {}) {
  const handlers = _registry.get(eventType) ?? []
  let s = state
  for (const { abilityId, handler, rarity } of handlers) {
    // Skip if this passive has already fired for a one-time event.
    if (eventType === 'on_low_health') {
      const firedKey = `lowHealthFired_${abilityId}`
      if (s.player[firedKey]) continue
    }
    try {
      s = handler(s, payload, rarity)
    } catch (err) {
      console.error(`Passive ${abilityId} error on ${eventType}:`, err)
    }
  }
  return s
}

// ─── Passive handler factories ────────────────────────────────────────────────
// These are used by abilities.js to build their onEvent handlers.

import {
  healPlayerPercent, applyBuff, applyAbsorption, applyStatus,
  dealDamage, dealDamageAoe, applyWeaknessStacks, drawCard, placeToken,
  killEnemy, enemiesAt, applyBurnCompat as applyBurn,
  findEnemy,
} from './effects.js'
import { randInt } from './rng.js'

// Re-export findEnemy for use in passives (it's not exported from effects.js directly).
export { findEnemy }

// ── Rejuvenation: heal % maxHp on room clear.
export function makeRejuvenationHandler(pct) {
  return (state) => healPlayerPercent(state, pct)
}

// ── Bramble Shell: reflect % of received damage to attacker.
export function makeBrambleShellHandler(pct) {
  return (state, payload) => {
    const { sourceEnemyId, damage } = payload
    if (!sourceEnemyId) return state
    return dealDamage(state, sourceEnemyId, Math.round(damage * pct), 'melee')
  }
}

// ── Bulwark: block one attack. Recharges every N card plays.
export function makeBulwarkHandler(rechargeCards) {
  return (state, payload) => {
    if (!state.player.bulwarkCharged) return state
    // Nullify the damage by returning state without calling damagePlayer.
    // (The reducer checks player.bulwarkCharged before calling damagePlayer.)
    const newState = { ...state, player: {
      ...state.player,
      bulwarkCharged: false,
      bulwarkRechargeRemaining: rechargeCards,
    }}
    return { ...newState, log: [...newState.log, 'Bulwark blocks the attack!'] }
  }
}

// ── Detonation: on kill, AOE magic damage to surrounding tiles.
export function makeDetonationHandler(damage) {
  return (state, payload) => {
    const { enemy } = payload
    if (!enemy) return state
    return dealDamageAoe(state, enemy.cell, 1, damage, 'magic')
  }
}

// ── Lightning Bottle wildcard: every 2 kills, add a Lightning Bottle card.
export function makeLightningBottleHandler(damage) {
  return (state, payload, rarity) => {
    const kills = state.killCount ?? 0
    if (kills > 0 && kills % 2 === 0) {
      const cardDef = { id: 'lightning_bottle_generated', name: 'Lightning Bottle', rarity, damage }
      return drawCard(state, cardDef, 'lightning_bottle')
    }
    return state
  }
}

// ── Permafrost wildcard: every 3 kills, add a Permafrost card.
export function makePermafrostHandler(stacks) {
  return (state, payload, rarity) => {
    const kills = state.killCount ?? 0
    if (kills > 0 && kills % 3 === 0) {
      const cardDef = { id: 'permafrost_generated', name: 'Permafrost', rarity, weaknessStacks: stacks }
      return drawCard(state, cardDef, 'permafrost')
    }
    return state
  }
}

// ── Sundrops: on kill, chance to spawn sundrop token.
export function makeSundropHandler(chance, rng) {
  return (state, payload) => {
    const { enemy } = payload
    if (!enemy) return state
    if (rng() < chance) {
      return placeToken(state, enemy.cell, 'sundrop', 999, {})
    }
    return state
  }
}

// ── Eternal Savior lifeline: below 20% HP, gain resistance + heal on kill.
export function makeEternalSaviorHandler(healPct) {
  return (state, payload, rarity) => {
    const firedKey = 'lowHealthFired_eternal_savior'
    let s = applyBuff(state, 'resistance', 90, 5)
    s = { ...s, player: { ...s.player, [firedKey]: true, healOnKillPct: healPct, healOnKillTurnsLeft: 5 } }
    return { ...s, log: [...s.log, 'Eternal Savior activates!'] }
  }
}

// ── Phantom Force: on kill of weakened mob, spawn vex token.
export function makePhantomForceHandler(damage, weaknessStacks) {
  return (state, payload) => {
    const { enemy } = payload
    if (!enemy) return state
    if (!enemy.statuses?.some(s => s.type === 'weakness')) return state
    return placeToken(state, enemy.cell, 'vex', 15, { damage, weaknessStacks })
  }
}

// ── Escape Artist lifeline: stun front 2 rows, gain resistance, draw cards per stun.
export function makeEscapeArtistHandler(resistancePct) {
  return (state, payload, rarity) => {
    const firedKey = 'lowHealthFired_escape_artist'
    let s = state
    const frontMobs = s.enemies.filter(e => e.cell.row <= 1)
    let stunCount = 0
    for (const e of frontMobs) {
      s = applyStatus(s, e.instanceId, 'stun', 2)
      stunCount++
    }
    s = applyBuff(s, 'resistance', resistancePct, 3)
    for (let i = 0; i < stunCount; i++) {
      s = drawCard(s, { id: 'draw_escape', name: 'Draw', rarity: 0 }, 'escape_artist')
    }
    s = { ...s, player: { ...s.player, [firedKey]: true } }
    return { ...s, log: [...s.log, 'Escape Artist activates!'] }
  }
}

// ── Last Breath lifeline: draw cards, push front row to back, absorption per push.
export function makeLastBreathHandler(cardCount, absorptionPct) {
  return (state, payload, rarity) => {
    const firedKey = 'lowHealthFired_last_breath'
    let s = state
    const { height } = s.gridState
    const frontRow = s.enemies.filter(e => e.cell.row === 0)
    let pushCount = 0
    for (const e of frontRow) {
      s = { ...s } // push to back
      s.enemies = s.enemies.map(en =>
        en.instanceId === e.instanceId ? { ...en, cell: { ...en.cell, row: height - 1 } } : en
      )
      pushCount++
    }
    s = applyAbsorption(s, pushCount * absorptionPct * s.player.maxHp)
    for (let i = 0; i < cardCount; i++) {
      s = drawCard(s, { id: 'draw_last_breath', name: 'Draw', rarity: 0 }, 'last_breath')
    }
    s = { ...s, player: { ...s.player, [firedKey]: true } }
    return { ...s, log: [...s.log, 'Last Breath activates!'] }
  }
}

// ── Earthen Combos: chance to spread status effects on hit.
export function makeEarthenCombosHandler(chance, rng) {
  return (state, payload) => {
    const { hitTargets } = payload
    if (!hitTargets?.length) return state
    if (rng() >= chance) return state
    let s = state
    for (const e of hitTargets) {
      const enemy = s.enemies.find(en => en.instanceId === e.instanceId)
      if (!enemy || !enemy.statuses.length) continue
      const statusToSpread = enemy.statuses[0]
      // Adjacent enemies.
      const adjacent = s.enemies.filter(en =>
        en.instanceId !== e.instanceId &&
        Math.abs(en.cell.row - enemy.cell.row) <= 1 &&
        Math.abs(en.cell.col - enemy.cell.col) <= 1
      )
      for (const adj of adjacent) {
        s = applyStatus(s, adj.instanceId, statusToSpread.type, statusToSpread.duration)
      }
    }
    return s
  }
}

// ── Split Arrow: hit nearest other mob for % of primary damage.
export function makeSplitArrowHandler(pct) {
  return (state, payload) => {
    const { hitTargets, damageDealt, damageType } = payload
    if (hitTargets?.length !== 1) return state
    const primary = hitTargets[0]
    const nearest = state.enemies.find(e => {
      if (e.instanceId === primary.instanceId) return false
      return true
    })
    if (!nearest) return state
    return dealDamage(state, nearest.instanceId, Math.round(damageDealt * pct), damageType ?? 'projectile')
  }
}

// ── Sharpshooter: gain stacks on projectile hit, decay after 5 turns.
export function makeSharpshooterHandler() {
  return (state, payload) => {
    if (payload.damageType !== 'projectile') return state
    const stacks = Math.min(4, (state.player.sharpshooterStacks ?? 0) + 1)
    return { ...state, player: { ...state.player, sharpshooterStacks: stacks, sharpshooterDecayTurns: 5 } }
  }
}

// ── Windswept Combos: speed bonus on push.
export function makeWindsweptCombosHandler(speedBonus) {
  return (state) => applyBuff(state, 'speed_bonus', speedBonus, 2)
}

// ── Restoring Draft: heal on push-kill.
export function makeRestoringDraftHandler(healPct) {
  return (state, payload) => {
    const { enemy } = payload
    if (!enemy) return state
    const wasWall = state._lastKillWasWallCollision
    const wasStacked = state._lastKillWasStacked
    if (!wasWall && !wasStacked) return state
    return healPlayerPercent(state, healPct)
  }
}

// ── Pyromania: dynamic — applied in computeDamage, no passive event needed.
// ── Icebreaker: dynamic — applied in computeDamage, no passive event needed.
// ── Aeromancy: dynamic — applied in computeDamage, no passive event needed.
// ── Sharpshooter bonus: dynamic — applied in computeDamage.
// ── Primordial Mastery: dynamic — applied in computeDamage.
// ── Deadly Strike: dynamic — applied in computeDamage.
// ── Dethroner: dynamic — applied in computeDamage.

// ── Soothing Combos: heal on AOE hitting 3+ mobs.
export function makeSoothingCombosHandler(healPct) {
  return (state) => healPlayerPercent(state, healPct)
}

// ── Flame Spirit wildcard: on AOE 3+, place flame spirit token.
export function makeFlameSpirit(damage) {
  return (state, payload) => {
    const { centerCell } = payload
    const cell = centerCell ?? { row: 0, col: Math.floor(state.gridState.width / 2) }
    return placeToken(state, cell, 'flame_spirit', 9999, { damage })
  }
}

// ── Dark Combos: basic attacks have % chance to apply 1 weakness stack.
export function makeDarkCombosHandler(chance, rng) {
  return (state, payload) => {
    const { hitTargets, isBasicAttack } = payload
    if (!isBasicAttack || !hitTargets?.length) return state
    let s = state
    for (const e of hitTargets) {
      if (rng() < chance) s = applyWeaknessStacks(s, e.instanceId, 1)
    }
    return s
  }
}

// ── Volcanic Combos: basic attacks have % chance to apply burn.
export function makeVolcanicCombosHandler(chance, rng) {
  return (state, payload) => {
    const { hitTargets, isBasicAttack } = payload
    if (!isBasicAttack || !hitTargets?.length) return state
    let s = state
    for (const e of hitTargets) {
      if (rng() < chance) s = applyBurn(s, e.instanceId, 2, 2)
    }
    return s
  }
}

// ── Focused Combos (Steelsage): projectile cards have % chance to bleed.
export function makeFocusedCombosHandler(chance, rng) {
  return (state, payload) => {
    const { hitTargets, damageType } = payload
    if (damageType !== 'projectile' || !hitTargets?.length) return state
    let s = state
    for (const e of hitTargets) {
      if (rng() < chance) s = applyBurn(s, e.instanceId, 3, 2)
    }
    return s
  }
}

// ── Frigid Combos: basic attacks have % chance to freeze the hit mob's tile.
export function makeFrigidCombosHandler(chance, rng) {
  return (state, payload) => {
    const { hitTargets, isBasicAttack } = payload
    if (!isBasicAttack || !hitTargets?.length) return state
    let s = { ...state, gridState: { ...state.gridState, frozenTiles: new Set(state.gridState.frozenTiles) } }
    for (const e of hitTargets) {
      if (rng() < chance) {
        const enemy = s.enemies.find(en => en.instanceId === e.instanceId)
        if (enemy) {
          s.gridState.frozenTiles.add(`${enemy.cell.row},${enemy.cell.col}`)
        }
      }
    }
    return s
  }
}

// ── Dodging: % chance to push attacker back 1 tile instead of taking damage.
export function makeDodgingHandler(chance, rng) {
  return (state, payload) => {
    const { sourceEnemyId } = payload
    if (!sourceEnemyId) return state
    if (rng() >= chance) return state
    // Signal to reducer: block the damage and push the attacker.
    let s = { ...state, _dodgeBlocked: true }
    s = { ...s } // pushEnemy would be called in reducer
    s = { ...s, _dodgePushTarget: sourceEnemyId }
    return { ...s, log: [...s.log, 'Dodged! Attacker pushed back.'] }
  }
}

// ── Toughness: applied at run start in buildRunState.
// ── One with the Wind: dynamic — checked each card play.
// ── Whirlwind: applied as player state flag.

export function applyWhirlwind(state, turns) {
  return { ...state, player: { ...state.player, whirlwindActive: true, whirlwindTurnsLeft: turns } }
}
