// Depthsle combat state machine.
//
// Use with React's useReducer:
//   const [state, dispatch] = useReducer(combatReducer, null, buildInitialState)
//
// All state is plain-serialisable so it can be JSON-stringified to localStorage
// after every card play. Firestore gets only the completion stats.

import { buildDailySeed, deriveRng, randChoice, shuffle, randInt } from './rng.js'
import { buildRunStats } from './gearBridge.js'
import { fireEvent, clearAllPassives } from './passives.js'
import {
  dealDamage, dealDamageAoe, dealDamageRow, dealDamageCol,
  dealDamageFirstInCol, dealDamageFirstInRow,
  applyStatus, applyWeaknessStacks, applyBurnCompat as applyBurn,
  applyPlayerDoT, tickPlayerDoTs,
  healPlayer, healPlayerPercent, applyAbsorption, applyBuff,
  pushEnemy, pushAll, pullEnemy, pullAll,
  freezeTile, freezeTiles, shatterFrozenTiles,
  placeToken, removeToken,
  drawCard, removeCardFromHand, returnCardToHand,
  damagePlayer, tickPlayerBuffs, tickBurn, tickStatuses, tickEnemyActionBar,
  moveEnemyTowardPlayer,
  enemiesAt, enemiesInRow, enemiesInCol, isFrozen, isValidCell,
} from './effects.js'
import { ENEMIES, BASIC_ENEMY_IDS, ELITE_ENEMY_IDS, spawnEnemy } from '../data/enemies.js'
import { LAYOUTS, STANDARD_LAYOUT_IDS, ELITE_LAYOUT_IDS, ROOM_TYPES, seededRoomOptions } from '../data/layouts.js'
import { ABILITY_TREES, TREE_IDS, buildBasicAttackCard } from '../data/abilities.js'

// ─── Phase Constants ──────────────────────────────────────────────────────────

export const PHASES = {
  CLASS_SELECT: 'CLASS_SELECT',
  ROOM_SELECT: 'ROOM_SELECT',
  ROOM_START: 'ROOM_START',
  PLAYING: 'PLAYING',
  ROOM_CLEAR: 'ROOM_CLEAR',
  REWARD: 'REWARD',
  GAME_OVER: 'GAME_OVER',
}

export const SUB_PHASES = {
  DRAW: 'DRAW',
  PLAYER_TURN: 'PLAYER_TURN',
  ENEMY_TURN: 'ENEMY_TURN',
  CHECK_ROOM_CLEAR: 'CHECK_ROOM_CLEAR',
}

// ─── Initial State Builder ────────────────────────────────────────────────────

export function buildInitialState(playerData) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).replace(/-/g, '')
  const seed = buildDailySeed(today)
  const runStats = buildRunStats(playerData)

  // Seeded class options: pick 4 of the 7 trees.
  const rng = deriveRng(seed, 'classSelect', 0)
  const classOptions = shuffle(rng, TREE_IDS).slice(0, 4)

  return {
    phase: PHASES.CLASS_SELECT,
    subPhase: null,
    seed,
    dateString: today,
    runStats,

    player: {
      hp: runStats.maxHp,
      maxHp: runStats.maxHp,
      absorption: 0,
      buffs: [],
      playerDoTs: [],
      tookDamageRecently: false,
      tookDamageRecentlyTurnsLeft: 0,
      webbed: 0,
      // Passive-specific state.
      bulwarkCharged: false,
      bulwarkRechargeRemaining: 0,
      chaosTarget: null,
      chaosMultiplier: 1,
      sidearmReturnsRemaining: 3,
      whirlwindActive: false,
      whirlwindTurnsLeft: 0,
      sharpshooterStacks: 0,
      sharpshooterDecayTurns: 0,
      healOnKillPct: 0,
      healOnKillTurnsLeft: 0,
    },

    mainTree: null,
    abilities: [],          // [{id, tree, name, rarity, cardType, ...}]
    hand: [],               // [{instanceId, cardId, name, rarity, source}]
    classOptions,
    roomOptions: [],
    roomNumber: 0,
    roomsCleared: 0,
    currentRoom: null,      // {type, isElite, layout}
    gridState: {
      width: 3,
      height: 3,
      frozenTiles: new Set(),
      tokens: [],
    },
    enemies: [],

    killCount: 0,
    killCountRoom: 0,
    treasureScore: 0,

    // Transient event hints (cleared after reducer handles them).
    _pendingPassiveEvent: null,
    _lastKilledEnemy: null,
    _lastAoeHitCount: 0,
    _lastPushWasWallCollision: false,
    _dodgeBlocked: false,
    _dodgePushTarget: null,

    log: [],
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cloneState(state) {
  return {
    ...state,
    player: { ...state.player, buffs: [...state.player.buffs] },
    hand: [...state.hand],
    abilities: [...state.abilities],
    classOptions: [...state.classOptions],
    roomOptions: [...state.roomOptions],
    enemies: state.enemies.map(e => ({
      ...e,
      statuses: [...e.statuses],
      cell: { ...e.cell },
    })),
    gridState: {
      ...state.gridState,
      frozenTiles: new Set(state.gridState.frozenTiles),
      tokens: state.gridState.tokens.map(t => ({ ...t })),
    },
    log: [...state.log],
  }
}

function addLog(state, msg) {
  return { ...state, log: [...state.log, msg] }
}

// "Draw a card" = add an extra copy of the next basic attack stage.
// Used by abilities that say "draw one card to hand".
function drawExtraCard(state) {
  const weaponType = state.runStats?.weaponType ?? 'sword'
  const nextIndex = ((state._basicAttackChainIndex ?? 0) + 1)
  const card = buildBasicAttackCard(weaponType, nextIndex)
  return { ...state, hand: [...(state.hand ?? []), { ...card, instanceId: `extra_${Date.now()}_${Math.random()}` }] }
}

// Fire on_low_health if HP just crossed a threshold (call after any HP loss).
const LOW_HEALTH_THRESHOLDS = [0.40, 0.30, 0.25, 0.20]
function checkLowHealth(state) {
  const pct = state.player.hp / state.player.maxHp
  if (state.player.hp <= 0) return state
  let s = state
  for (const threshold of LOW_HEALTH_THRESHOLDS) {
    if (pct <= threshold) {
      s = fireEvent(s, 'on_low_health', { hpPct: pct, threshold })
    }
  }
  return s
}

// Draw the opening hand for a room (basic attack + any cooldown-ready abilities).
function buildOpeningHand(state) {
  const weaponType = state.runStats.weaponType ?? 'sword'
  const basicAttack = buildBasicAttackCard(weaponType, 0)
  let s = { ...state, hand: [basicAttack] }
  // Add any abilities that start off cooldown.
  for (const ability of state.abilities) {
    if (ability.cardType !== 'passive') {
      const card = { ...ability, instanceId: `card_${Date.now()}_${ability.id}`, cooldownRemaining: 0 }
      s = { ...s, hand: [...s.hand, card] }
    }
  }
  return s
}

// Pick enemies for a room based on seed + room number.
function buildRoomEnemies(state, isElite, layoutId) {
  const rng = deriveRng(state.seed, `room_enemies_${state.roomNumber}`, 0)
  const layout = LAYOUTS[layoutId]
  const count = layout.defaultEnemyCount

  const pool = isElite
    ? [...BASIC_ENEMY_IDS, ...ELITE_ENEMY_IDS]
    : BASIC_ENEMY_IDS

  const spawns = []
  const slots = shuffle(rng, [...layout.enemySlots]).slice(0, count)

  for (let i = 0; i < Math.min(count, slots.length); i++) {
    const defId = isElite && i === 0
      ? randChoice(rng, ELITE_ENEMY_IDS)  // guarantee one elite in elite rooms
      : randChoice(rng, pool)
    const def = ENEMIES[defId]
    spawns.push(spawnEnemy(def, slots[i], state.roomNumber))
  }
  return spawns
}

// Pick a layout for a room.
function pickLayout(state, isElite) {
  const rng = deriveRng(state.seed, `room_layout_${state.roomNumber}`, 0)
  const ids = isElite ? ELITE_LAYOUT_IDS : STANDARD_LAYOUT_IDS
  return randChoice(rng, ids)
}

// Register passives for acquired abilities.
function rebuildPassives(abilities, seed) {
  clearAllPassives()
  for (const ability of abilities) {
    if (ability.cardType === 'passive' && ability.registerPassive) {
      const rng = deriveRng(seed, `passive_rng_${ability.id}`, 0)
      ability.registerPassive(ability.rarity, rng)
    }
  }
}

// Roll a rarity index (0=Common … 4=Legendary) seeded per room/ability slot.
// Main tree gets +1 rarity (capped at 4).
function rollRarity(state, slotIndex, isMainTree) {
  const rng = deriveRng(state.seed, `rarity_roll_${state.roomNumber}`, slotIndex)
  // Weighted: Common 40 / Uncommon 30 / Rare 18 / Epic 10 / Legendary 2
  const weights = [40, 30, 18, 10, 2]
  const total = 100
  let r = rng() * total
  let rarity = 0
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r <= 0) { rarity = i; break }
  }
  if (isMainTree) rarity = Math.min(4, rarity + 1)
  return rarity
}

// Build 3 ability choices for the REWARD phase.
function buildAbilityChoices(state) {
  const mainTree = ABILITY_TREES[state.mainTree]
  if (!mainTree) return []

  const rng = deriveRng(state.seed, `reward_choices_${state.roomNumber}`, 0)

  // pool of abilities from all four class options the player hasn't acquired yet
  const allPooled = state.classOptions.flatMap(treeId => {
    const tree = ABILITY_TREES[treeId]
    return tree ? tree.abilities.filter(a =>
      a.cardType !== 'passive' || true  // include passives
    ) : []
  }).filter(a => !state.abilities.some(eq => eq.id === a.id))

  // separate main tree candidates from the rest
  const mainCandidates = allPooled.filter(a => a.tree === state.mainTree)
  const otherCandidates = allPooled.filter(a => a.tree !== state.mainTree)

  const picked = []

  // guarantee one from main tree if available
  if (mainCandidates.length > 0) {
    const mainPick = shuffle(rng, mainCandidates)[0]
    picked.push({ ...mainPick, rarity: rollRarity(state, 0, true) })
  }

  // fill remaining two slots from any tree
  const remaining = shuffle(rng, otherCandidates)
  for (const a of remaining) {
    if (picked.length >= 3) break
    if (picked.some(p => p.id === a.id)) continue
    picked.push({ ...a, rarity: rollRarity(state, picked.length, a.tree === state.mainTree) })
  }

  // if we still need more (e.g. other trees exhausted), pull from main
  const extraMain = shuffle(rng, mainCandidates).filter(a => !picked.some(p => p.id === a.id))
  for (const a of extraMain) {
    if (picked.length >= 3) break
    picked.push({ ...a, rarity: rollRarity(state, picked.length, true) })
  }

  return picked.map(a => ({
    ...a,
    descriptionText: typeof a.description === 'function'
      ? a.description(a.rarity)
      : (a.description ?? ''),
  }))
}

function buildUpgradeChoices(state) {
  const upgradeable = state.abilities.filter(a => a.rarity < 4)
  if (upgradeable.length === 0) return []
  const rng = deriveRng(state.seed, `upgrade_choices_${state.roomNumber}`, 0)
  return shuffle(rng, upgradeable).slice(0, 3)
}

// ─── Enemy AI ─────────────────────────────────────────────────────────────────

function resolveEnemyAction(state, enemy) {
  let s = { ...state }

  if (enemy.statuses.some(st => st.type === 'stun' || st.type === 'silence')) {
    return addLog(s, `${enemy.name} is stunned/silenced — skips turn`)
  }

  const distToPlayer = enemy.cell.row  // row 0 = adjacent to player
  const validActions = enemy.actions.filter(a =>
    distToPlayer >= a.minRange && distToPlayer <= a.maxRange
  )

  if (validActions.length === 0) return s

  const action = validActions[0]

  // Enraged damage bonus.
  let dmg = enemy.baseDamage
  if (enemy.enraged) dmg = Math.round(dmg * (1 + (enemy.enragedDamageBonus ?? 0)))

  switch (action.type) {
    case 'melee':
    case 'sting': {
      // Fire on_attack_received passive before applying damage.
      let payload = { damage: dmg, sourceEnemyId: enemy.instanceId }
      s = fireEvent(s, 'on_attack_received', payload)
      if (!s._dodgeBlocked) {
        s = damagePlayer(s, dmg, enemy.name)
      } else {
        // Dodging pushed the attacker.
        if (s._dodgePushTarget) s = pushEnemy(s, s._dodgePushTarget, 'back', 1)
        s = { ...s, _dodgeBlocked: false, _dodgePushTarget: null }
      }
      // On-hit status effects applied to player as DoTs.
      for (const effect of (enemy.onHit ?? [])) {
        if (effect === 'poison') s = applyPlayerDoT(s, 2, 3, 'magic')
        if (effect === 'bleed')  s = applyPlayerDoT(s, 1, 3, 'projectile')
      }
      break
    }
    case 'ranged': {
      let payload = { damage: dmg, sourceEnemyId: enemy.instanceId }
      s = fireEvent(s, 'on_attack_received', payload)
      if (!s._dodgeBlocked) {
        s = damagePlayer(s, dmg, `${enemy.name} (ranged)`)
      }
      break
    }
    case 'poison': {
      s = damagePlayer(s, Math.round(dmg * 0.6), enemy.name)
      break
    }
    case 'slam': {
      // Hits front 2 rows (for elite zombie). Implemented as wide melee.
      let payload = { damage: dmg * 1.2, sourceEnemyId: enemy.instanceId }
      s = fireEvent(s, 'on_attack_received', payload)
      if (!s._dodgeBlocked) {
        s = damagePlayer(s, Math.round(dmg * 1.2), `${enemy.name} (slam)`)
      }
      break
    }
    case 'web': {
      // Web the player slot (no-op for now; roots a random enemy conceptually — in real design this roots the player's ability draw)
      s = addLog(s, `${enemy.name} webs! Draw rate halved for 2 turns.`)
      s = { ...s, player: { ...s.player, webbed: 2 } }
      break
    }
    case 'move': {
      s = moveEnemyTowardPlayer(s, enemy.instanceId)
      break
    }
    default:
      break
  }

  return s
}

// ─── Token Tick ───────────────────────────────────────────────────────────────

function tickTokens(state) {
  let s = { ...state, gridState: { ...state.gridState, tokens: [...state.gridState.tokens] } }

  for (const token of [...s.gridState.tokens]) {
    switch (token.type) {
      case 'flame_spirit': {
        s = dealDamageAoe(s, token.cell, 1, token.data.damage, 'magic')
        break
      }
      case 'meteor_marker': {
        const newTurns = token.turnsLeft - 1
        if (newTurns <= 0) {
          s = dealDamageAoe(s, token.cell, 1, token.data.damage, 'magic')
          for (const e of enemiesAt(s, token.cell)) {
            s = applyBurn(s, e.instanceId, 2, 2)
          }
          s = removeToken(s, token.id)
        } else {
          s.gridState.tokens = s.gridState.tokens.map(t =>
            t.id === token.id ? { ...t, turnsLeft: newTurns } : t
          )
        }
        break
      }
      case 'rune': {
        // Check if any enemy just entered this row.
        const triggeredEnemy = s.enemies.find(e => e.cell.row === token.cell.row)
        if (triggeredEnemy) {
          s = dealDamageRow(s, token.cell.row, token.data.damage, 'magic')
          for (const e of enemiesInRow(s, token.cell.row)) {
            s = applyBurn(s, e.instanceId, 3, 2)
          }
          s = applyBuff(s, 'damage_bonus', 15, 2)
          s = removeToken(s, token.id)
        }
        break
      }
      case 'decoy': {
        const newTurns = token.turnsLeft - 1
        if (newTurns <= 0) {
          s = dealDamageAoe(s, token.cell, 1, token.data.damage, 'melee')
          for (const e of enemiesAt(s, token.cell)) {
            s = applyStatus(s, e.instanceId, 'stun', 1)
          }
          s = removeToken(s, token.id)
        } else {
          s.gridState.tokens = s.gridState.tokens.map(t =>
            t.id === token.id ? { ...t, turnsLeft: newTurns } : t
          )
        }
        break
      }
      case 'bomb': {
        const newTurns = token.turnsLeft - 1
        if (newTurns <= 0) {
          s = dealDamageAoe(s, token.cell, 1, token.data.damage, 'projectile')
          s = pullAll(s, token.cell)
          s = removeToken(s, token.id)
        } else {
          s.gridState.tokens = s.gridState.tokens.map(t =>
            t.id === token.id ? { ...t, turnsLeft: newTurns } : t
          )
        }
        break
      }
      case 'vex': {
        // Move vex toward nearest enemy; detonate on contact.
        const nearest = s.enemies[0]
        if (!nearest) {
          s = removeToken(s, token.id)
          break
        }
        const dr = Math.sign(nearest.cell.row - token.cell.row)
        const dc = Math.sign(nearest.cell.col - token.cell.col)
        const newCell = { row: token.cell.row + dr, col: token.cell.col + dc }
        const onTarget = enemiesAt(s, newCell)
        if (onTarget.length > 0) {
          for (const e of onTarget) {
            s = dealDamage(s, e.instanceId, token.data.damage, 'melee')
            s = applyWeaknessStacks(s, e.instanceId, token.data.weaknessStacks)
          }
          s = removeToken(s, token.id)
        } else {
          s.gridState.tokens = s.gridState.tokens.map(t =>
            t.id === token.id ? { ...t, cell: newCell, turnsLeft: t.turnsLeft - 1 } : t
          )
          if (token.turnsLeft <= 1) s = removeToken(s, token.id)
        }
        break
      }
      case 'snowstorm': {
        // Each turn: ~15% chance to freeze each unfrozen tile; damage mobs on newly frozen tiles.
        const rng = deriveRng(s.seed, `snowstorm_${s.roomNumber}_${s._turnCount ?? 0}`, token.id)
        const { width, height } = s.gridState
        const newFrozen = []
        for (let row = 0; row < height; row++) {
          for (let col = 0; col < width; col++) {
            if (!isFrozen(s, { row, col }) && rng() < 0.15) {
              newFrozen.push({ row, col })
            }
          }
        }
        if (newFrozen.length > 0) {
          s = freezeTiles(s, newFrozen)
          const dmg = token.data?.damage ?? 5
          for (const cell of newFrozen) {
            for (const e of enemiesAt(s, cell)) {
              s = dealDamage(s, e.instanceId, dmg, 'magic')
            }
          }
        }
        const newTurns = token.turnsLeft - 1
        if (newTurns <= 0) {
          s = removeToken(s, token.id)
        } else {
          s.gridState.tokens = s.gridState.tokens.map(t =>
            t.id === token.id ? { ...t, turnsLeft: newTurns } : t
          )
        }
        s = { ...s, _turnCount: (s._turnCount ?? 0) + 1 }
        break
      }
      case 'sundrop': {
        // Sundrop sits until the player "attacks" it (for now, auto-collect after 3 turns).
        const newTurns = token.turnsLeft - 1
        if (newTurns <= 0) {
          s = applyBuff(s, 'speed_bonus', 20, 3)
          s = applyBuff(s, 'resistance', 15, 3)
          s = removeToken(s, token.id)
          s = addLog(s, 'Sundrop collected! Speed and resistance gained.')
        } else {
          s.gridState.tokens = s.gridState.tokens.map(t =>
            t.id === token.id ? { ...t, turnsLeft: newTurns } : t
          )
        }
        break
      }
      default:
        break
    }
  }

  return s
}


//helper function for ending turn
//after the player's turn ends (manually or by running out of cards), run this
function resolveEnemyTurn(state) {
  let s = { ...state, subPhase: SUB_PHASES.ENEMY_TURN }
  s = tickPlayerBuffs(s)
  s = tickPlayerDoTs(s)
  s = addLog(s, '--- Enemy Turn ---')
  for (const enemy of [...s.enemies]) {
    s = tickBurn(s, enemy.instanceId)
    s = tickStatuses(s, enemy.instanceId)
  }
  s = tickTokens(s)
  for (const enemy of [...s.enemies]) {
    const { newState, acted } = tickEnemyActionBar(s, enemy.instanceId)
    s = newState
    if (acted) {
      const liveEnemy = s.enemies.find(e => e.instanceId === enemy.instanceId)
      if (liveEnemy) {
        s = resolveEnemyAction(s, liveEnemy)
        s = checkLowHealth(s)
      }
    }
  }
  if (s.player.hp <= 0) return { ...s, phase: PHASES.GAME_OVER }
  if (s.enemies.length === 0) {
    s = { ...s, phase: PHASES.ROOM_CLEAR, subPhase: null }
    return fireEvent(s, 'on_room_clear', {})
  }
  
  const hasBasicAttack = s.hand.some(c => c.isBasicAttack)
  if (!hasBasicAttack) {
    const weaponType = s.runStats.weaponType ?? 'sword'
    const basicCard = buildBasicAttackCard(weaponType, s._basicAttackChainIndex ?? 0)
    s = { ...s, hand: [...s.hand, basicCard] }
  }
  return { ...s, subPhase: SUB_PHASES.PLAYER_TURN }
}

// ─── Main Reducer ─────────────────────────────────────────────────────────────

export function combatReducer(state, action) {
  let s = cloneState(state)
  // Clear transient event hints.
  s._pendingPassiveEvent = null
  s._lastKilledEnemy = null
  s._lastAoeHitCount = 0
  s._lastPushWasWallCollision = false
  s._dodgeBlocked = false
  s._dodgePushTarget = null

  switch (action.type) {

    // ── CLASS_SELECT → ROOM_SELECT ──────────────────────────────────────────
    case 'SELECT_CLASS': {
      const { treeId } = action
      s = { ...s, mainTree: treeId, phase: PHASES.ROOM_SELECT }
      s = addLog(s, `Class selected: ${treeId}`)
      // Build first room options.
      const rng = deriveRng(s.seed, 'roomOptions', s.roomNumber)
      s.roomOptions = seededRoomOptions(rng, s.roomNumber)
      return s
    }

    // ── ROOM_SELECT → ROOM_START ────────────────────────────────────────────
    case 'SELECT_ROOM': {
      const { roomType } = action
      const roomDef = ROOM_TYPES[roomType]
      const isElite = roomDef.isElite
      const layoutId = pickLayout(s, isElite)
      const layout = LAYOUTS[layoutId]
      const enemies = buildRoomEnemies(s, isElite, layoutId)

      s = {
        ...s,
        phase: PHASES.ROOM_START,
        currentRoom: { type: roomType, isElite, layoutId },
        gridState: {
          ...s.gridState,
          width: layout.width,
          height: layout.height,
          frozenTiles: new Set(),
          tokens: [],
        },
        enemies,
        killCountRoom: 0,
      }
      s = addLog(s, `Entering ${roomDef.label} room (${layoutId}, ${enemies.length} enemies)`)

      // Build hand, fire room-start passives, then drop into PLAYER_TURN.
      s = { ...s, phase: PHASES.PLAYING, subPhase: SUB_PHASES.DRAW }
      s = buildOpeningHand(s)
      s = fireEvent(s, 'on_room_start', {})
      s = { ...s, subPhase: SUB_PHASES.PLAYER_TURN }
      return s
    }

    // ── PLAY_CARD ───────────────────────────────────────────────────────────
    case 'PLAY_CARD': {
      if (s.phase !== PHASES.PLAYING || s.subPhase !== SUB_PHASES.PLAYER_TURN) return s
      const { instanceId, targetCell, targetEnemyId, targetCol, targetRow } = action

      const card = s.hand.find(c => c.instanceId === instanceId)
      if (!card) return s

      s = removeCardFromHand(s, instanceId)
      s = addLog(s, `Player plays ${card.name}`)

      // Route to ability handler.
      s = resolveCardPlay(s, card, { targetCell, targetEnemyId, targetCol, targetRow })

      // Fire on_card_played passives.
      s = fireEvent(s, 'on_card_played', {
        card,
        hitTargets: s._lastCardHits ?? [],
        damageType: card.damageType ?? 'melee',
        isBasicAttack: card.isBasicAttack ?? false,
        damageDealt: s._lastCardDamage ?? 0,
      })

      // Pyromania check (dynamic — no passive event needed).
      // Sharpshooter stacks tick.
      if (card.damageType === 'projectile') {
        const stacks = Math.min(4, (s.player.sharpshooterStacks ?? 0) + 1)
        s = { ...s, player: { ...s.player, sharpshooterStacks: stacks, sharpshooterDecayTurns: 5 } }
      }

      // Bulwark recharge tick.
      if (!s.player.bulwarkCharged && s.player.bulwarkRechargeRemaining > 0) {
        const rem = s.player.bulwarkRechargeRemaining - 1
        s = { ...s, player: { ...s.player,
          bulwarkRechargeRemaining: rem,
          bulwarkCharged: rem === 0,
        }}
      }

      // Whirlwind tick.
      if (s.player.whirlwindActive) {
        const ww = s.player.whirlwindTurnsLeft - 1
        s = { ...s, player: { ...s.player, whirlwindActive: ww > 0, whirlwindTurnsLeft: Math.max(0, ww) } }
      }

      // After playing a card, stay in PLAYER_TURN (player may play more cards).
      // Transition to ENEMY_TURN happens with END_TURN action.

      //but if hand is empty, end turn
      if (s.hand.length === 0 && s.subPhase === SUB_PHASES.PLAYER_TURN) {
        return resolveEnemyTurn(s)
      }

      return s
    }

    // ── END_TURN → ENEMY_TURN ───────────────────────────────────────────────
    case 'END_TURN': {
      if (s.phase !== PHASES.PLAYING) return s
      //logic extracted out to resolveEnemyTurn function above
      return resolveEnemyTurn(s)
    }

    // ── CLAIM_REWARD ────────────────────────────────────────────────────────
    case 'CLAIM_REWARD': {
      if (s.phase !== PHASES.ROOM_CLEAR) return s
      const roomType = s.currentRoom?.type
      if (['ability', 'elite_ability'].includes(roomType)) {
        // Build 3 ability choices.
        s = { ...s, phase: PHASES.REWARD, rewardChoices: buildAbilityChoices(s) }
      } else if (['upgrade', 'elite_upgrade'].includes(roomType)) {
        const upgradeChoices = buildUpgradeChoices(s)
        s = { ...s, phase: PHASES.REWARD, rewardType: 'upgrade', upgradeChoices }
      } else if (['treasure', 'elite_treasure'].includes(roomType)) {
        const scoreGain = 100 * (1 + s.roomNumber * 0.15) * (s.currentRoom.isElite ? 1.5 : 1)
        s = { ...s, treasureScore: s.treasureScore + Math.round(scoreGain) }
        s = addLog(s, `Treasure! +${Math.round(scoreGain)} score`)
        s = progressToNextRoom(s)
      }
      return s
    }

    // ── SELECT_REWARD ────────────────────────────────────────────────────────
    case 'SELECT_REWARD': {
      if (s.phase !== PHASES.REWARD) return s

      // Upgrade room: player picks a stat boost.
      if (action.abilityId === '__skip__') {
        //case for no upgrades available
        s = progressToNextRoom(s)
        return s
      }

      if (s.rewardType === 'upgrade') {
        const {abilityId} = action
        if (!abilityId) return s
        s = {
          ...s,
          abilities: s.abilities.map(a =>
            a.id === abilityId
              ? { ...a, rarity: Math.min(4, a.rarity + 1) }
              : a
          ),
        }
        const upgraded = s.abilities.find(a => a.id === abilityId)
        s = addLog(s, `${upgraded?.name} upgraded to ${['Common','Uncommon','Rare','Epic','Legendary'][upgraded?.rarity]}`)
        rebuildPassives(s.abilities, s.seed)
        s = progressToNextRoom(s)
        return s
      }

      const { abilityId } = action
      const chosen = s.rewardChoices?.find(a => a.id === abilityId)
      if (!chosen) return s

      s = { ...s, abilities: [...s.abilities, chosen] }
      s = addLog(s, `Acquired ${chosen.name} (${['Common','Uncommon','Rare','Epic','Legendary'][chosen.rarity]})`)

      // Re-register all passives.
      rebuildPassives(s.abilities, s.seed)

      // Apply at-run-start effects for new passive (Toughness, etc.)
      if (chosen.applyAtAcquisition) {
        s = chosen.applyAtAcquisition(s, chosen.rarity)
      }

      s = progressToNextRoom(s)
      return s
    }

    // ── ACKNOWLEDGE_GAME_OVER ────────────────────────────────────────────────
    case 'ACKNOWLEDGE_GAME_OVER': {
      // No state change needed — caller handles save.
      return s
    }

    default:
      return state
  }
}

// ─── Room Progression ────────────────────────────────────────────────────────

function progressToNextRoom(state) {
  let s = {
    ...state,
    phase: PHASES.ROOM_SELECT,
    subPhase: null,
    roomNumber: state.roomNumber + 1,
    roomsCleared: state.roomsCleared + 1,
    rewardChoices: null,
    rewardType: null,
  }
  // Build next room options.
  const rng = deriveRng(s.seed, 'roomOptions', s.roomNumber)
  s.roomOptions = seededRoomOptions(rng, s.roomNumber)
  return s
}

// ─── Card Play Routing ────────────────────────────────────────────────────────

// Dispatch a card play to the appropriate ability handler from abilities.js.
function resolveCardPlay(state, card, ctx) {
  const enemiesBefore = state.enemies.map(e => ({ instanceId: e.instanceId, hp: e.hp }))
  let s = { ...state, _lastCardHits: [], _lastCardDamage: 0 }

  if (card.isBasicAttack) {
    s = resolveBasicAttack(s, card, ctx)
  } else if (card.id === 'draw_card' || card.cardId === 'draw_card') {
    return drawExtraCard(s)
  } else if (card.id === 'lightning_bottle_generated' || card.cardId === 'lightning_bottle_generated') {
    const damage = Math.round((s.runStats.magicDamage ?? 10) * 1.5)
    if (ctx.targetCell) {
      s = dealDamageAoe(s, ctx.targetCell, 1, damage, 'magic')
      for (const e of s.enemies.filter(en =>
        Math.abs(en.cell.row - ctx.targetCell.row) <= 1 &&
        Math.abs(en.cell.col - ctx.targetCell.col) <= 1
      )) {
        s = applyStatus(s, e.instanceId, 'stun', 1)
      }
    }
  } else if (card.id === 'permafrost_generated' || card.cardId === 'permafrost_generated') {
    if (ctx.targetCell) {
      const cells = []
      for (let dr = 0; dr <= 1; dr++)
        for (let dc = 0; dc <= 1; dc++)
          cells.push({ row: ctx.targetCell.row + dr, col: ctx.targetCell.col + dc })
      s = freezeTiles(s, cells)
      for (const e of s.enemies.filter(en => cells.some(c => c.row === en.cell.row && c.col === en.cell.col))) {
        s = applyWeaknessStacks(s, e.instanceId, 2)
      }
    }
  } else {
    const tree = ABILITY_TREES[card.tree]
    if (!tree) return s
    const ability = tree.abilities.find(a => a.id === (card.cardId ?? card.id))
    if (!ability?.execute) return s
    s = ability.execute(s, { ...ctx, rarity: card.rarity, runStats: s.runStats })
  }

  // Derive _lastCardHits from HP changes if ability didn't set it explicitly
  if (s._lastCardHits.length === 0) {
    const hits = enemiesBefore
      .map(({ instanceId, hp }) => {
        const after = s.enemies.find(e => e.instanceId === instanceId)
        // hit if HP changed or enemy died
        if (!after || after.hp < hp) {
          return state.enemies.find(e => e.instanceId === instanceId)
        }
        return null
      })
      .filter(Boolean)
    s = { ...s, _lastCardHits: hits }
  }

  // Derive _lastCardDamage from total HP lost if not set explicitly
  if (s._lastCardDamage === 0) {
    const totalDamage = enemiesBefore.reduce((sum, { instanceId, hp }) => {
      const after = s.enemies.find(e => e.instanceId === instanceId)
      const hpAfter = after ? after.hp : 0
      return sum + Math.max(0, hp - hpAfter)
    }, 0)
    s = { ...s, _lastCardDamage: totalDamage }
  }

  return s
}

// Resolve a basic attack hit pattern.
function resolveBasicAttack(state, card, ctx) {
  let s = state
  const rs = s.runStats
  const dmg = rs.meleeDamage
  const { targetCell, targetCol, targetRow } = ctx

  let hits = []

  switch (card.attackPattern) {
    case 'single':
      if (targetCell) {
        for (const e of enemiesAt(s, targetCell)) hits.push(e)
      }
      break
    case 'row':
      hits = enemiesInRow(s, targetRow ?? 0)
      break
    case 'col':
      hits = enemiesInCol(s, targetCol ?? 0)
      break
    case 'row_wide': // full width × 1 row
      hits = enemiesInRow(s, 0)
      break
    case 'row2': // front 2 rows
      hits = s.enemies.filter(e => e.cell.row <= 1)
      break
    default:
      break
  }

  let totalDmg = 0
  for (const e of hits) {
    const before = e.hp
    let hitDmg = dmg
    const isChaosTarget = s.player.chaosTarget === e.instanceId
    // Chaos dagger: multiplied damage on marked target; draw on kill.
    if (isChaosTarget) {
      hitDmg = Math.round(hitDmg * (s.player.chaosMultiplier ?? 2))
      s = { ...s, player: { ...s.player, chaosTarget: null, chaosMultiplier: 1 } }
    }
    s = dealDamage(s, e.instanceId, hitDmg, 'melee', { isBasicAttack: true })
    const hpAfter = s.enemies.find(en => en.instanceId === e.instanceId)?.hp ?? 0
    totalDmg += Math.max(0, before - hpAfter)
    // Draw a card on chaos kill.
    if (isChaosTarget && hpAfter <= 0) {
      s = drawExtraCard(s)
    }
  }

  // Axe Stage 2: push back 1.
  if (card.pushBack && hits.length > 0) {
    for (const e of hits) s = pushEnemy(s, e.instanceId, 'back', 1)
  }

  // Advance chain index.
  const chainLength = card.chainLength ?? 1
  const nextIndex = ((state._basicAttackChainIndex ?? 0) + 1) % chainLength
  s = { ...s, _basicAttackChainIndex: nextIndex, _lastCardHits: hits, _lastCardDamage: totalDmg }

  return s
}
