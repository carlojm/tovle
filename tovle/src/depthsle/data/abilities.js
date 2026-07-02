// Ability definitions for Depthsle.
// All values come directly from agents/depthsle-abilities.md — do not alter
// rarity values or atom calls without updating that spec first.
//
// Each active ability has an execute(state, ctx) function.
//   ctx: { targetCell, targetEnemyId, targetCol, targetRow, rarity, runStats }
// Each passive ability has a registerPassive(rarity, rng) function.
//
// description(rarity) returns a string with **value** markers for bold rendering.
// Rarities: 0=Common 1=Uncommon 2=Rare 3=Epic 4=Legendary

import {
  dealDamage, dealDamageAoe, dealDamageRow, dealDamageCol,
  dealDamageLine, dealDamageFirstInCol, dealDamageFirstInRow,
  dealDamageShrapnel, pullEnemy, pullAll, pullTowardEachOther,
  pushEnemy, pushAll,
  applyStatus, applyWeaknessStacks, applyBurnCompat as applyBurn,
  healPlayer, healPlayerPercent, applyAbsorption, applyBuff,
  freezeTile, freezeTiles, shatterFrozenTiles,
  placeToken, drawCard, returnCardToHand,
  enemiesAt, enemiesInRow, enemiesInCol, enemiesInRadius,
  modifyStat, cellsBetween, isValidCell,
} from '../engine/effects.js'

import {
  registerPassive,
  makeRejuvenationHandler, makeBrambleShellHandler, makeBulwarkHandler,
  makeDetonationHandler, makeLightningBottleHandler, makePermafrostHandler,
  makeSundropHandler, makeEternalSaviorHandler, makePhantomForceHandler,
  makeEscapeArtistHandler, makeLastBreathHandler, makeEarthenCombosHandler,
  makeSplitArrowHandler, makeSharpshooterHandler, makeWindsweptCombosHandler,
  makeRestoringDraftHandler, makeSoothingCombosHandler, makeFlameSpirit,
  makeDarkCombosHandler, makeVolcanicCombosHandler, makeFocusedCombosHandler,
  makeFrigidCombosHandler, makeDodgingHandler, applyWhirlwind,
} from '../engine/passives.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const R = (vals) => vals  // rarity value array [C, Uc, R, E, L]

function rv(vals, rarity) { return vals[Math.min(4, rarity)] }

// Cells in a 3×2 block in front of the player (rows 0–1, all columns ≤ 2).
function front3x2Cells(state) {
  const cells = []
  for (let col = 0; col < state.gridState.width; col++) {
    cells.push({ row: 0, col })
    cells.push({ row: 1, col })
  }
  return cells
}

// All cells in a 2×2 block at targetCell.
function cells2x2(state, targetCell) {
  const result = []
  for (let dr = 0; dr <= 1; dr++) {
    for (let dc = 0; dc <= 1; dc++) {
      const c = { row: targetCell.row + dr, col: targetCell.col + dc }
      if (isValidCell(state, c)) result.push(c)
    }
  }
  return result
}

// All cells in a full row.
function rowCells(state, row) {
  const cells = []
  for (let col = 0; col < state.gridState.width; col++) cells.push({ row, col })
  return cells
}

// All cells in a full column.
function colCells(state, col) {
  const cells = []
  for (let row = 0; row < state.gridState.height; row++) cells.push({ row, col })
  return cells
}

// Center cell of the grid (used as default pull target).
function centerCell(state) {
  return {
    row: Math.floor(state.gridState.height / 2),
    col: Math.floor(state.gridState.width / 2),
  }
}

// ─── Basic Attack Chains ──────────────────────────────────────────────────────
// Defined here so combatReducer can import them.

export const BASIC_ATTACK_CHAINS = {
  sword: [
    { id: 'sword_1', name: 'Slash',      attackPattern: 'single',   chainLength: 3 },
    { id: 'sword_2', name: 'Wide Slash', attackPattern: 'row',      chainLength: 3 },
    { id: 'sword_3', name: 'Lunge',      attackPattern: 'col',      chainLength: 3 },
  ],
  axe: [
    { id: 'axe_1', name: 'Big Swing',   attackPattern: 'row_wide', chainLength: 3 },
    { id: 'axe_2', name: 'Bash',        attackPattern: 'single',   pushBack: true, chainLength: 3 },
    { id: 'axe_3', name: 'Heavy Sweep', attackPattern: 'row2',     chainLength: 3 },
  ],
  ranged: [
    { id: 'ranged_1', name: 'Row Shot',    attackPattern: 'row',  chainLength: 2 },
    { id: 'ranged_2', name: 'Column Shot', attackPattern: 'col',  chainLength: 2 },
  ],
  wand: [
    { id: 'wand_1', name: 'X Blast',    attackPattern: 'x_shape', chainLength: 2 },
    { id: 'wand_2', name: 'Wide Pulse', attackPattern: 'aoe3x3', chainLength: 2 },
  ],
  scythe: [
    { id: 'scythe_1', name: 'Scythe Swing', attackPattern: 'row', chainLength: 3 },
    { id: 'scythe_2', name: 'Arc',          attackPattern: 'row', chainLength: 3 },
    { id: 'scythe_3', name: 'Reap',         attackPattern: 'row', chainLength: 3 },
  ],
}

export function buildBasicAttackCard(weaponType, chainIndex) {
  const chain = BASIC_ATTACK_CHAINS[weaponType] ?? BASIC_ATTACK_CHAINS.sword
  const stage = chain[chainIndex % chain.length]
  return {
    ...stage,
    instanceId: `basic_${Date.now()}`,
    cardId: stage.id,
    isBasicAttack: true,
    source: 'basic',
    rarity: 0,
    damageType: weaponType === 'ranged' ? 'projectile' : weaponType === 'wand' ? 'magic' : 'melee',
    tree: null,
  }
}

// ─── FLAMECALLER ──────────────────────────────────────────────────────────────

const flamecaller = {
  id: 'flamecaller',
  name: 'Flamecaller',
  emoji: '🔥',
  description: 'Cast explosions and ignite enemies',
  abilities: [
    {
      id: 'fireball',
      tree: 'flamecaller',
      name: 'Fireball',
      trigger: 'right_click',
      cardType: 'offense',
      attackPattern: 'aoe2x2',
      cooldownBase: 5,
      damageType: 'magic',
      rarityValues: R([11, 13, 15, 17, 19]),
      description(r) { return `2×2 magic AoE. Deals **${rv(this.rarityValues, r)}** damage and applies **burn** to hit mobs.` },
      execute(state, ctx) {
        const { targetCell, rarity } = ctx
        const cell = targetCell ?? centerCell(state)
        let s = dealDamageAoe(state, cell, 0.5, rv(this.rarityValues, rarity), 'magic', { cardTree: 'flamecaller' })
        for (const e of enemiesInRadius(s, cell, 0.5)) {
          s = applyBurn(s, e.instanceId, 2, 2)
        }
        return s
      },
    },
    {
      id: 'flamestrike',
      tree: 'flamecaller',
      name: 'Flamestrike',
      trigger: 'sneak_right_click',
      cardType: 'offense',
      attackPattern: 'row',
      cooldownBase: 8,
      damageType: 'magic',
      rarityValues: R([14, 17, 20, 23, 26]),
      description(r) { return `Full row magic damage (**${rv(this.rarityValues, r)}**) + **burn** on all hit mobs.` },
      execute(state, ctx) {
        const { targetRow, rarity } = ctx
        const row = targetRow ?? 0
        let s = dealDamageRow(state, row, rv(this.rarityValues, rarity), 'magic', { cardTree: 'flamecaller' })
        for (const e of enemiesInRow(s, row)) {
          s = applyBurn(s, e.instanceId, 2, 2)
        }
        return s
      },
    },
    {
      id: 'pyroblast',
      tree: 'flamecaller',
      name: 'Pyroblast',
      trigger: 'sneak_bow',
      cardType: 'offense',
      attackPattern: 'col',
      cooldownBase: 10,
      damageType: 'magic',
      rarityValues: R([20, 24, 28, 32, 36]),
      description(r) { return `Full column magic damage (**${rv(this.rarityValues, r)}**) + **burn** on all hit mobs.` },
      execute(state, ctx) {
        const { targetCol, rarity } = ctx
        const col = targetCol ?? 0
        let s = dealDamageCol(state, col, rv(this.rarityValues, rarity), 'magic', { cardTree: 'flamecaller' })
        for (const e of enemiesInCol(s, col)) {
          s = applyBurn(s, e.instanceId, 2, 2)
        }
        return s
      },
    },
    {
      id: 'volcanic_meteor',
      tree: 'flamecaller',
      name: 'Volcanic Meteor',
      trigger: 'swap',
      cardType: 'offense',
      attackPattern: 'aoe3x3',
      cooldownBase: 16,
      damageType: 'magic',
      rarityValues: R([36, 45, 54, 63, 72]),
      description(r) { return `Mark a 3×3 area. In two turns: **${rv(this.rarityValues, r)}** magic damage + burn on all hit mobs.` },
      execute(state, ctx) {
        const { targetCell, rarity } = ctx
        const cell = targetCell ?? centerCell(state)
        return placeToken(state, cell, 'meteor_marker', 2, { damage: rv(this.rarityValues, rarity) })
      },
    },
    {
      id: 'igneous_rune',
      tree: 'flamecaller',
      name: 'Igneous Rune',
      trigger: 'sneak_left_click',
      cardType: 'utility',
      attackPattern: 'row',
      cooldownBase: 11,
      damageType: 'magic',
      rarityValues: R([20, 24, 28, 32, 36]),
      description(r) { return `Place a rune on a row. First mob to enter triggers: **${rv(this.rarityValues, r)}** row damage + burn + damage buff.` },
      execute(state, ctx) {
        const { targetRow, rarity } = ctx
        const row = targetRow ?? Math.floor(state.gridState.height / 2)
        return placeToken(state, { row, col: 0 }, 'rune', Infinity, { damage: rv(this.rarityValues, rarity) })
      },
    },
    {
      id: 'detonation',
      tree: 'flamecaller',
      name: 'Detonation',
      trigger: 'passive',
      cardType: 'passive',
      rarityValues: R([2, 2.5, 3, 3.5, 4]),
      description(r) { return `On enemy death, explosion deals **${rv(this.rarityValues, r)}** damage to adjacent tiles.` },
      registerPassive(rarity, _rng) {
        registerPassive('detonation', 'on_kill', makeDetonationHandler(rv(this.rarityValues, rarity)))
      },
    },
    {
      id: 'flame_spirit',
      tree: 'flamecaller',
      name: 'Flame Spirit',
      trigger: 'wildcard',
      cardType: 'passive',
      rarityValues: R([2, 2.5, 3, 3.5, 4]),
      description(r) { return `Hitting 3+ mobs at once summons a flame spirit dealing **${rv(this.rarityValues, r)}** AoE damage each turn.` },
      registerPassive(rarity, _rng) {
        registerPassive('flame_spirit', 'on_aoe_hit_three_plus', makeFlameSpirit(rv(this.rarityValues, rarity)))
      },
    },
    {
      id: 'primordial_mastery',
      tree: 'flamecaller',
      name: 'Primordial Mastery',
      trigger: 'passive',
      cardType: 'passive',
      rarityValues: R([8, 12, 16, 20, 24]),
      description(r) { return `All Flamecaller cards deal **+${rv(this.rarityValues, r)}%** more magic damage.` },
      registerPassive(rarity, _rng) {
        // Applied dynamically in computeDamage via state.equippedPassives check.
      },
      applyAtAcquisition(state, rarity) {
        const passives = [...(state.equippedPassives ?? []), { id: 'primordial_mastery', rarity, rarityValues: [8, 12, 16, 20, 24] }]
        return { ...state, equippedPassives: passives }
      },
    },
    {
      id: 'pyromania',
      tree: 'flamecaller',
      name: 'Pyromania',
      trigger: 'passive',
      cardType: 'passive',
      rarityValues: R([3, 4, 5, 6, 7.5]),
      description(r) { return `**+${rv(this.rarityValues, r)}%** damage per burning mob on the field.` },
      applyAtAcquisition(state, rarity) {
        const passives = [...(state.equippedPassives ?? []), { id: 'pyromania', rarity, rarityValues: [3, 4, 5, 6, 7.5] }]
        return { ...state, equippedPassives: passives }
      },
    },
    {
      id: 'volcanic_combos',
      tree: 'flamecaller',
      name: 'Volcanic Combos',
      trigger: 'combo',
      cardType: 'passive',
      rarityValues: R([0.60, 0.70, 0.80, 0.90, 1.00]),
      description(r) { return `Basic attacks have a **${Math.round(rv(this.rarityValues, r) * 100)}%** chance to apply burn.` },
      registerPassive(rarity, rng) {
        registerPassive('volcanic_combos', 'on_card_played', makeVolcanicCombosHandler(rv(this.rarityValues, rarity), rng))
      },
    },
    {
      id: 'apocalypse',
      tree: 'flamecaller',
      name: 'Apocalypse',
      trigger: 'lifeline',
      cardType: 'passive',
      rarityValues: R([[40, 0.05], [50, 0.07], [60, 0.09], [70, 0.11], [80, 0.13]]),
      description(r) {
        const [dmg, heal] = rv(this.rarityValues, r)
        return `Below 25% HP: deal **${dmg}** magic damage to all mobs. Kills heal **${Math.round(heal * 100)}%** HP.`
      },
      registerPassive(rarity, _rng) {
        const [damage, healPct] = rv(this.rarityValues, rarity)
        registerPassive('apocalypse', 'on_low_health', (state, payload) => {
          if ((state.player.hp / state.player.maxHp) > 0.25) return state
          let s = state
          const firedKey = 'lowHealthFired_apocalypse'
          if (s.player[firedKey]) return s
          for (const e of [...s.enemies]) {
            s = dealDamage(s, e.instanceId, damage, 'magic')
          }
          s = { ...s, player: { ...s.player, [firedKey]: true, healOnKillPct: healPct, healOnKillTurnsLeft: 5 } }
          return s
        })
      },
    },
  ],
}

// ─── EARTHBOUND ───────────────────────────────────────────────────────────────

const earthbound = {
  id: 'earthbound',
  name: 'Earthbound',
  emoji: '🪨',
  description: 'Root enemies and withstand attacks',
  abilities: [
    {
      id: 'beasts_claw',
      tree: 'earthbound',
      name: "Beast's Claw",
      trigger: 'right_click',
      cardType: 'offense',
      attackPattern: 'aoe3x2',
      cooldownBase: 6,
      damageType: 'melee',
      rarityValues: R([1.00, 1.10, 1.20, 1.30, 1.40]),
      description(r) { return `3×2 melee attack dealing **${Math.round(rv(this.rarityValues, r) * 100)}%** damage. Stuns hit mobs for **1 turn**.` },
      execute(state, ctx) {
        const { targetCell, rarity, runStats } = ctx
        const cell = targetCell ?? centerCell(state)
        const dmg = Math.round(runStats.meleeDamage * rv(this.rarityValues, rarity))
        let s = state
        for (let dr = 0; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const c = { row: cell.row + dr, col: cell.col + dc }
            if (isValidCell(s, c)) {
              for (const e of enemiesAt(s, c)) {
                s = dealDamage(s, e.instanceId, dmg, 'melee')
                s = applyStatus(s, e.instanceId, 'stun', 1)
              }
            }
          }
        }
        return s
      },
    },
    {
      id: 'earthen_wrath',
      tree: 'earthbound',
      name: 'Earthen Wrath',
      trigger: 'swap',
      cardType: 'offense',
      attackPattern: 'all_enemies',
      cooldownBase: 14,
      damageType: 'melee',
      rarityValues: R([0.60, 0.70, 0.80, 0.90, 1.00]),
      description(r) { return `Deal **${Math.round(rv(this.rarityValues, r) * 100)}%** melee damage to all mobs. Doubled after taking damage.` },
      execute(state, ctx) {
        const { rarity, runStats } = ctx
        let dmg = Math.round(runStats.meleeDamage * rv(this.rarityValues, rarity))
        if (state.player.tookDamageRecently) dmg *= 2
        let s = state
        for (const e of [...s.enemies]) {
          s = dealDamage(s, e.instanceId, dmg, 'melee')
        }
        return s
      },
    },
    {
      id: 'earthquake',
      tree: 'earthbound',
      name: 'Earthquake',
      trigger: 'sneak_bow',
      cardType: 'offense',
      attackPattern: 'aoe3x3',
      cooldownBase: 11,
      damageType: 'magic',
      rarityValues: R([20, 25, 30, 35, 40]),
      description(r) { return `3×3 magic AoE dealing **${rv(this.rarityValues, r)}** damage. Roots hit mobs for **1 turn**.` },
      execute(state, ctx) {
        const { targetCell, rarity } = ctx
        const cell = targetCell ?? centerCell(state)
        let s = dealDamageAoe(state, cell, 1, rv(this.rarityValues, rarity), 'magic')
        for (const e of enemiesInRadius(s, cell, 1)) {
          s = applyStatus(s, e.instanceId, 'root', 1)
        }
        return s
      },
    },
    {
      id: 'iron_grip',
      tree: 'earthbound',
      name: 'Iron Grip',
      trigger: 'sneak_right_click',
      cardType: 'utility',
      attackPattern: 'aoe3x2',
      cooldownBase: 9,
      damageType: 'melee',
      rarityValues: R([1.00, 1.10, 1.20, 1.30, 1.40]),
      description(r) { return `3×2 attack (**${Math.round(rv(this.rarityValues, r) * 100)}%** dmg). Pulls hit mobs to you + stuns for **2 turns**.` },
      execute(state, ctx) {
        const { targetCell, rarity, runStats } = ctx
        const cell = targetCell ?? centerCell(state)
        const dmg = Math.round(runStats.meleeDamage * rv(this.rarityValues, rarity))
        const pullTarget = { row: 0, col: Math.floor(state.gridState.width / 2) }
        let s = state
        const hits = []
        for (let dr = 0; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const c = { row: cell.row + dr, col: cell.col + dc }
            if (isValidCell(s, c)) {
              for (const e of enemiesAt(s, c)) {
                s = dealDamage(s, e.instanceId, dmg, 'melee')
                s = pullEnemy(s, e.instanceId, pullTarget)
                s = applyStatus(s, e.instanceId, 'stun', 2)
                hits.push(e)
              }
            }
          }
        }
        return { ...s, _lastCardHits: hits }
      },
    },
    {
      id: 'taunt',
      tree: 'earthbound',
      name: 'Taunt',
      trigger: 'sneak_left_click',
      cardType: 'utility',
      attackPattern: 'front_2rows_wide', // TODO make sure it works
      cooldownBase: 12,
      damageType: 'melee',
      rarityValues: R([[0.10, 0.01], [0.15, 0.015], [0.20, 0.02], [0.25, 0.025], [0.30, 0.03]]),
      description(r) {
        const [dmgBonus, absPct] = rv(this.rarityValues, r)
        return `Hit 2 front rows. Gain **${Math.round(absPct * 100)}%** max HP as absorption per mob hit. Taunted mobs take **+${Math.round(dmgBonus * 100)}%** damage.`
      },
      execute(state, ctx) {
        const { rarity, runStats } = ctx
        const [_dmgBonus, absPct] = rv(this.rarityValues, rarity)
        const dmg = Math.round(runStats.meleeDamage)
        let s = state
        let hitCount = 0
        for (let row = 0; row <= 1; row++) {
          for (const e of enemiesInRow(s, row)) {
            s = dealDamage(s, e.instanceId, dmg, 'melee')
            s = applyStatus(s, e.instanceId, 'taunt', 3)
            hitCount++
          }
        }
        s = applyAbsorption(s, hitCount * absPct * s.player.maxHp)
        return s
      },
    },
    {
      id: 'bramble_shell',
      tree: 'earthbound',
      name: 'Bramble Shell',
      trigger: 'passive',
      cardType: 'passive',
      rarityValues: R([0.60, 0.70, 0.80, 0.90, 1.00]),
      description(r) { return `Return **${Math.round(rv(this.rarityValues, r) * 100)}%** of damage received back to the attacker.` },
      registerPassive(rarity, _rng) {
        registerPassive('bramble_shell', 'on_attack_received', makeBrambleShellHandler(rv(this.rarityValues, rarity)))
      },
    },
    {
      id: 'bulwark',
      tree: 'earthbound',
      name: 'Bulwark',
      trigger: 'passive',
      cardType: 'passive',
      rarityValues: R([12, 11, 10, 8, 6]),
      description(r) { return `Block one incoming attack every **${rv(this.rarityValues, r)}** card plays.` },
      applyAtAcquisition(state, rarity) {
        return { ...state, player: { ...state.player, bulwarkCharged: true } }
      },
      registerPassive(rarity, _rng) {
        registerPassive('bulwark', 'on_attack_received', makeBulwarkHandler(rv(this.rarityValues, rarity)))
      },
    },
    {
      id: 'toughness',
      tree: 'earthbound',
      name: 'Toughness',
      trigger: 'passive',
      cardType: 'passive',
      rarityValues: R([10, 12.5, 15, 17.5, 20]),
      description(r) { return `Gain **+${rv(this.rarityValues, r)}%** max HP at run start.` },
      applyAtAcquisition(state, rarity) {
        return modifyStat(state, 'max_hp', rv(this.rarityValues, rarity), 'percent')
      },
    },
    {
      id: 'earthen_combos',
      tree: 'earthbound',
      name: 'Earthen Combos',
      trigger: 'combo',
      cardType: 'passive',
      rarityValues: R([0.60, 0.70, 0.80, 0.90, 1.00]),
      description(r) { return `**${Math.round(rv(this.rarityValues, r) * 100)}%** chance to spread a hit mob's status effect to adjacent mobs.` },
      registerPassive(rarity, rng) {
        registerPassive('earthen_combos', 'on_card_played', makeEarthenCombosHandler(rv(this.rarityValues, rarity), rng))
      },
    },
  ],
}

// ─── SHADOWDANCER ─────────────────────────────────────────────────────────────

const shadowdancer = {
  id: 'shadowdancer',
  name: 'Shadowdancer',
  emoji: '🌑',
  description: 'Single-target attacks and weakness stacking',
  abilities: [
    {
      id: 'advancing_shadows',
      tree: 'shadowdancer',
      name: 'Advancing Shadows',
      trigger: 'right_click',
      cardType: 'offense',
      attackPattern: 'single',
      cooldownBase: 10,
      damageType: 'melee',
      rarityValues: R([1.50, 1.75, 2.00, 2.25, 2.50]),
      description(r) { return `Heavy single-target melee hit (**${Math.round(rv(this.rarityValues, r) * 100)}%** dmg). Draw one card.` },
      execute(state, ctx) {
        const { targetEnemyId, rarity, runStats } = ctx
        if (!targetEnemyId) return state
        const dmg = Math.round(runStats.meleeDamage * rv(this.rarityValues, rarity))
        let s = dealDamage(state, targetEnemyId, dmg, 'melee')
        s = drawCard(s, { id: 'draw_adv_shadows', name: 'Draw', rarity: 0 }, 'advancing_shadows')
        return { ...s, _lastCardHits: [{ instanceId: targetEnemyId }] }
      },
    },
    {
      id: 'blade_flurry',
      tree: 'shadowdancer',
      name: 'Blade Flurry',
      trigger: 'sneak_right_click',
      cardType: 'offense',
      attackPattern: 'row',
      cooldownBase: 5,
      damageType: 'melee',
      rarityValues: R([8, 10, 12, 14, 16]),
      description(r) { return `Hit a row **3 times** for **${rv(this.rarityValues, r)}** damage each. Knocks back 1 tile.` },
      execute(state, ctx) {
        const { rarity, targetRow } = ctx
        const dmg = rv(this.rarityValues, rarity)
        const row = targetRow ?? 0
        let s = state
        const hits = []
        for (let i = 0; i < 3; i++) {
          for (const e of enemiesInRow(s, row)) {
            s = dealDamage(s, e.instanceId, dmg, 'melee')
            hits.push(e)
          }
        }
        for (const e of [...new Set(hits.map(e => e.instanceId))]) {
          s = pushEnemy(s, e, 'back', 1)
        }
        return { ...s, _lastCardHits: hits }
      },
    },
    {
      id: 'chaos_dagger',
      tree: 'shadowdancer',
      name: 'Chaos Dagger',
      trigger: 'swap',
      cardType: 'utility',
      attackPattern: 'single',
      cooldownBase: 14,
      rarityValues: R([2, 2.25, 2.5, 2.75, 3]),
      description(r) { return `Stun a target for 1 turn. Next basic attack on them deals **${rv(this.rarityValues, r)}×** damage. Kill = draw a card.` },
      execute(state, ctx) {
        const { targetEnemyId, rarity } = ctx
        if (!targetEnemyId) return state
        let s = applyStatus(state, targetEnemyId, 'stun', 1)
        s = { ...s, player: { ...s.player, chaosTarget: targetEnemyId, chaosMultiplier: rv(this.rarityValues, rarity) } }
        return s
      },
    },
    {
      id: 'dummy_decoy',
      tree: 'shadowdancer',
      name: 'Dummy Decoy',
      trigger: 'sneak_bow',
      cardType: 'utility',
      attackPattern: 'single',
      cooldownBase: 14,
      rarityValues: R([20, 25, 30, 35, 40]),
      description(r) { return `Place a decoy mobs advance toward. Explodes after 3 turns: **${rv(this.rarityValues, r)}** AoE melee damage + stun.` },
      execute(state, ctx) {
        const { targetCell, rarity } = ctx
        const cell = targetCell ?? centerCell(state)
        return placeToken(state, cell, 'decoy', 3, { damage: rv(this.rarityValues, rarity) })
      },
    },
    {
      id: 'cloak_of_shadows',
      tree: 'shadowdancer',
      name: 'Cloak of Shadows',
      trigger: 'sneak_left_click',
      cardType: 'utility',
      attackPattern: 'aoe3x3',
      cooldownBase: 10,
      rarityValues: R([1, 2, 3, 4, 5]),
      description(r) { return `Apply **${rv(this.rarityValues, r)}** weakness stack(s) to all mobs in a 3×3 area.` },
      execute(state, ctx) {
        const { targetCell, rarity } = ctx
        const cell = targetCell ?? centerCell(state)
        const stacks = rv(this.rarityValues, rarity)
        let s = state
        for (const e of enemiesInRadius(s, cell, 1)) {
          s = applyWeaknessStacks(s, e.instanceId, stacks)
        }
        return s
      },
    },
    {
      id: 'brutalize',
      tree: 'shadowdancer',
      name: 'Brutalize',
      trigger: 'passive',
      cardType: 'passive',
      rarityValues: R([0.12, 0.15, 0.18, 0.21, 0.24]),
      description(r) { return `Melee attacks deal **${Math.round(rv(this.rarityValues, r) * 100)}%** of hit damage as shrapnel to adjacent mobs.` },
      registerPassive(rarity, _rng) {
        const pct = rv(this.rarityValues, rarity)
        registerPassive('brutalize', 'on_card_played', (state, payload) => {
          const { hitTargets, damageDealt, damageType } = payload
          if (damageType !== 'melee' || !hitTargets?.length) return state
          let s = state
          for (const e of hitTargets) {
            const enemy = s.enemies.find(en => en.instanceId === e.instanceId)
            if (enemy) s = dealDamageShrapnel(s, enemy.cell, damageDealt, pct, 'melee')
          }
          return s
        })
      },
    },
    {
      id: 'dark_combos',
      tree: 'shadowdancer',
      name: 'Dark Combos',
      trigger: 'combo',
      cardType: 'passive',
      rarityValues: R([0.60, 0.70, 0.80, 0.90, 1.00]),
      description(r) { return `**${Math.round(rv(this.rarityValues, r) * 100)}%** chance on basic attacks to apply 1 weakness stack.` },
      registerPassive(rarity, rng) {
        registerPassive('dark_combos', 'on_card_played', makeDarkCombosHandler(rv(this.rarityValues, rarity), rng))
      },
    },
    {
      id: 'deadly_strike',
      tree: 'shadowdancer',
      name: 'Deadly Strike',
      trigger: 'passive',
      cardType: 'passive',
      rarityValues: R([10, 15, 20, 25, 30]),
      description(r) { return `**+${rv(this.rarityValues, r)}%** damage to mobs with any weakness stack.` },
      applyAtAcquisition(state, rarity) {
        const passives = [...(state.equippedPassives ?? []), { id: 'deadly_strike', rarity, rarityValues: [10, 15, 20, 25, 30] }]
        return { ...state, equippedPassives: passives }
      },
    },
    {
      id: 'dethroner',
      tree: 'shadowdancer',
      name: 'Dethroner',
      trigger: 'passive',
      cardType: 'passive',
      rarityValues: R([14, 21, 28, 35, 42]),
      description(r) { return `**+${rv(this.rarityValues, r)}%** damage to elite enemies.` },
      applyAtAcquisition(state, rarity) {
        const passives = [...(state.equippedPassives ?? []), { id: 'dethroner', rarity, rarityValues: [14, 21, 28, 35, 42] }]
        return { ...state, equippedPassives: passives }
      },
    },
    {
      id: 'phantom_force',
      tree: 'shadowdancer',
      name: 'Phantom Force',
      trigger: 'wildcard',
      cardType: 'passive',
      rarityValues: R([[6, 1], [7.5, 1], [9, 2], [10.5, 2], [12, 3]]),
      description(r) {
        const [dmg, stacks] = rv(this.rarityValues, r)
        return `Killing a weakened mob spawns a vex dealing **${dmg}** damage + **${stacks}** weakness stack(s) on contact.`
      },
      registerPassive(rarity, _rng) {
        const [damage, stacks] = rv(this.rarityValues, rarity)
        registerPassive('phantom_force', 'on_kill', makePhantomForceHandler(damage, stacks))
      },
    },
    {
      id: 'escape_artist',
      tree: 'shadowdancer',
      name: 'Escape Artist',
      trigger: 'lifeline',
      cardType: 'passive',
      rarityValues: R([50, 60, 70, 80, 90]),
      description(r) { return `Below 30% HP: stun front 2 rows, gain **${rv(this.rarityValues, r)}%** resistance, draw a card per mob stunned.` },
      registerPassive(rarity, _rng) {
        registerPassive('escape_artist', 'on_low_health', (state, payload) => {
          if ((state.player.hp / state.player.maxHp) > 0.30) return state
          return makeEscapeArtistHandler(rv(this.rarityValues, rarity))(state, payload, rarity)
        })
      },
    },
  ],
}

// ─── FROSTBORN ────────────────────────────────────────────────────────────────

const frostborn = {
  id: 'frostborn',
  name: 'Frostborn',
  emoji: '❄️',
  description: 'Cast ice spells and freeze tiles',
  abilities: [
    {
      id: 'ice_lance',
      tree: 'frostborn',
      name: 'Ice Lance',
      trigger: 'right_click',
      cardType: 'offense',
      cooldownBase: 5,
      damageType: 'magic',
      rarityValues: R([12.5, 15, 17.5, 20, 22.5]),
      description(r) { return `Column magic damage (**${rv(this.rarityValues, r)}**). Freezes tiles under hit mobs.` },
      execute(state, ctx) {
        const { targetCol, rarity } = ctx
        const col = targetCol ?? 0
        const priorEnemies = [...state.enemies]
        let s = dealDamageCol(state, col, rv(this.rarityValues, rarity), 'magic')
        for (const e of priorEnemies.filter(e => e.cell.col === col)) {
          s = freezeTile(s, e.cell)
        }
        return s
      },
    },
    {
      id: 'avalanche',
      tree: 'frostborn',
      name: 'Avalanche',
      trigger: 'swap',
      cardType: 'offense',
      cooldownBase: 14,
      damageType: 'magic',
      rarityValues: R([28, 35, 42, 49, 56]),
      description(r) { return `Shatter all frozen tiles: **${rv(this.rarityValues, r)}** magic damage + **2-turn stun** on hit mobs.` },
      execute(state, ctx) {
        const { rarity } = ctx
        let s = shatterFrozenTiles(state, rv(this.rarityValues, rarity), 'magic')
        for (const e of s.enemies) {
          s = applyStatus(s, e.instanceId, 'stun', 2)
        }
        return s
      },
    },
    {
      id: 'ice_barrier',
      tree: 'frostborn',
      name: 'Ice Barrier',
      trigger: 'sneak_right_click',
      cardType: 'utility',
      cooldownBase: 10,
      damageType: 'magic',
      rarityValues: R([15, 18, 21, 24, 27]),
      description(r) { return `Freeze a full row. Deal **${rv(this.rarityValues, r)}** magic damage to all mobs on it.` },
      execute(state, ctx) {
        const { targetCell, rarity } = ctx
        const row = targetCell?.row ?? 0
        let s = state
        s = dealDamageRow(s, row, rv(this.rarityValues, rarity), 'magic')
        s = freezeTiles(s, rowCells(s, row))
        return s
      },
    },
    {
      id: 'piercing_cold',
      tree: 'frostborn',
      name: 'Piercing Cold',
      trigger: 'sneak_bow',
      cardType: 'offense',
      cooldownBase: 9,
      damageType: 'magic',
      rarityValues: R([18, 21, 24, 27, 30]),
      description(r) { return `Row magic damage (**${rv(this.rarityValues, r)}**). Freezes all tiles in the row.` },
      execute(state, ctx) {
        const { targetRow, rarity } = ctx
        const row = targetRow ?? 0
        let s = dealDamageRow(state, row, rv(this.rarityValues, rarity), 'magic')
        s = freezeTiles(s, rowCells(s, row))
        return s
      },
    },
    {
      id: 'snowstorm',
      tree: 'frostborn',
      name: 'Snowstorm',
      trigger: 'sneak_left_click',
      cardType: 'utility',
      cooldownBase: 11,
      damageType: 'magic',
      rarityValues: R([5, 7, 9, 11, 13]),
      description(r) { return `Randomly freezes tiles over 4 turns (~15% per turn). Mobs on newly frozen tiles take **${rv(this.rarityValues, r)}** damage.` },
      execute(state, ctx) {
        const { rarity } = ctx
        return placeToken(state, { row: 0, col: 0 }, 'snowstorm', 4, {
          damage: rv(this.rarityValues, rarity),
          tilesPerTurn: 0.15,
        })
      },
    },
    {
      id: 'frigid_combos',
      tree: 'frostborn',
      name: 'Frigid Combos',
      trigger: 'combo',
      cardType: 'passive',
      rarityValues: R([0.60, 0.70, 0.80, 0.90, 1.00]),
      description(r) { return `**${Math.round(rv(this.rarityValues, r) * 100)}%** chance on basic attacks to freeze the hit mob's tile.` },
      registerPassive(rarity, rng) {
        registerPassive('frigid_combos', 'on_card_played', makeFrigidCombosHandler(rv(this.rarityValues, rarity), rng))
      },
    },
    {
      id: 'icebreaker',
      tree: 'frostborn',
      name: 'Icebreaker',
      trigger: 'passive',
      cardType: 'passive',
      rarityValues: R([
        { frozen: 20, debuff: 10 }, { frozen: 27, debuff: 13.5 },
        { frozen: 33, debuff: 16.5 }, { frozen: 40, debuff: 20 }, { frozen: 46, debuff: 23 }
      ]),
      description(r) {
        const { frozen, debuff } = rv(this.rarityValues, r)
        return `**+${frozen}%** damage to mobs on frozen tiles. **+${debuff}%** to any debuffed mob.`
      },
      applyAtAcquisition(state, rarity) {
        const passives = [...(state.equippedPassives ?? []), { id: 'icebreaker', rarity, rarityValues: this.rarityValues }]
        return { ...state, equippedPassives: passives }
      },
    },
    {
      id: 'permafrost',
      tree: 'frostborn',
      name: 'Permafrost',
      trigger: 'wildcard',
      cardType: 'passive',
      rarityValues: R([1, 1, 2, 2, 3]),
      description(r) { return `Every 3 kills, add a Permafrost card. Play to freeze a 2×2 area + apply **${rv(this.rarityValues, r)}** weakness stack(s).` },
      registerPassive(rarity, _rng) {
        registerPassive('permafrost', 'on_kill', makePermafrostHandler(rv(this.rarityValues, rarity)))
      },
    },
    {
      id: 'cryobox',
      tree: 'frostborn',
      name: 'Cryobox',
      trigger: 'lifeline',
      cardType: 'passive',
      rarityValues: R([0.10, 0.12, 0.14, 0.16, 0.18]),
      description(r) { return `Below 25% HP: freeze front 2 rows, stun all mobs, gain **${Math.round(rv(this.rarityValues, r) * 100)}%** max HP as absorption.` },
      registerPassive(rarity, _rng) {
        registerPassive('cryobox', 'on_low_health', (state, payload) => {
          if ((state.player.hp / state.player.maxHp) > 0.25) return state
          const firedKey = 'lowHealthFired_cryobox'
          if (state.player[firedKey]) return state
          let s = state
          const front2 = s.enemies.filter(e => e.cell.row <= 1)
          const cells = []
          for (let row = 0; row <= 1; row++) {
            for (let col = 0; col < s.gridState.width; col++) cells.push({ row, col })
          }
          s = freezeTiles(s, cells)
          for (const e of front2) s = applyStatus(s, e.instanceId, 'stun', 2)
          s = applyAbsorption(s, rv(this.rarityValues, rarity) * s.player.maxHp)
          s = { ...s, player: { ...s.player, [firedKey]: true } }
          return s
        })
      },
    },
  ],
}

// ─── DAWNBRINGER ─────────────────────────────────────────────────────────────

const dawnbringer = {
  id: 'dawnbringer',
  name: 'Dawnbringer',
  emoji: '☀️',
  description: 'Cast stuns and self buffs',
  abilities: [
    {
      id: 'bottled_sunlight',
      tree: 'dawnbringer',
      name: 'Bottled Sunlight',
      trigger: 'sneak_right_click',
      cardType: 'utility',
      cooldownBase: 10,
      damageType: null,
      rarityValues: R([0.05, 0.075, 0.10, 0.125, 0.15]),
      description(r) { return `Gain **${Math.round(rv(this.rarityValues, r) * 100)}%** of your max HP as absorption.` },
      execute(state, ctx) {
        const { rarity } = ctx
        return applyAbsorption(state, Math.round(rv(this.rarityValues, rarity) * state.player.maxHp))
      },
    },
    {
      id: 'lightning_bottle',
      tree: 'dawnbringer',
      name: 'Lightning Bottle',
      trigger: 'wildcard',
      cardType: 'passive',
      rarityValues: R([6, 7.5, 9, 10.5, 12]),
      description(r) { return `Every 2 kills, add a Lightning Bottle card. Play it for **${rv(this.rarityValues, r)}** magic AOE damage + **stun**.` },
      registerPassive(rarity, _rng) {
        registerPassive('lightning_bottle', 'on_kill', makeLightningBottleHandler(rv(this.rarityValues, rarity)))
      },
    },
    {
      id: 'ward_of_light',
      tree: 'dawnbringer',
      name: 'Ward of Light',
      trigger: 'right_click',
      cardType: 'utility',
      cooldownBase: 8,
      damageType: null,
      rarityValues: R([0.32, 0.40, 0.48, 0.56, 0.64]),
      description(r) { return `Heal yourself for **${Math.round(rv(this.rarityValues, r) * 100)}%** of your max HP.` },
      execute(state, ctx) {
        const { rarity } = ctx
        return healPlayerPercent(state, rv(this.rarityValues, rarity))
      },
    },
    {
      id: 'radiant_blessing',
      tree: 'dawnbringer',
      name: 'Radiant Blessing',
      trigger: 'sneak_left_click',
      cardType: 'utility',
      cooldownBase: 12,
      damageType: null,
      rarityValues: R([12, 16, 20, 24, 28]),
      description(r) { return `Gain **+${rv(this.rarityValues, r)}%** damage + **20% resistance** for 3 turns. Draw one card.` },
      execute(state, ctx) {
        const { rarity } = ctx
        let s = applyBuff(state, 'damage_bonus', rv(this.rarityValues, rarity), 3)
        s = applyBuff(s, 'resistance', 20, 3)
        s = drawCard(s, { id: 'draw_radiant', name: 'Draw', rarity: 0 }, 'radiant_blessing')
        return s
      },
    },
    {
      id: 'divine_beam',
      tree: 'dawnbringer',
      name: 'Divine Beam',
      trigger: 'sneak_bow',
      cardType: 'offense',
      cooldownBase: 11,
      damageType: 'magic',
      rarityValues: R([[1, 5], [2, 7.5], [2, 10], [3, 12.5], [4, 15]]),
      description(r) {
        const [stun, dmg] = rv(this.rarityValues, r)
        return `Row magic damage (**${dmg}**). Stuns all hit mobs for **${stun} turn${stun > 1 ? 's' : ''}**.`
      },
      execute(state, ctx) {
        const { targetRow, rarity } = ctx
        const row = targetRow ?? 0
        const [stun, dmg] = rv(this.rarityValues, rarity)
        let s = dealDamageRow(state, row, dmg, 'magic')
        for (const e of state.enemies.filter(en => en.cell.row === row)) {
          s = applyStatus(s, e.instanceId, 'stun', stun)
        }
        return s
      },
    },
    {
      id: 'spark_of_inspiration',
      tree: 'dawnbringer',
      name: 'Spark of Inspiration',
      trigger: 'swap',
      cardType: 'utility',
      cooldownBase: 18,
      damageType: null,
      rarityValues: R([60, 75, 90, 105, 120]),
      description(r) { return `Gain **20% resistance** + **+${rv(this.rarityValues, r)}% speed** for 3 turns.` },
      execute(state, ctx) {
        const { rarity } = ctx
        let s = applyBuff(state, 'resistance', 20, 3)
        s = applyBuff(s, 'speed_bonus', rv(this.rarityValues, rarity), 3)
        return s
      },
    },
    {
      id: 'enlightenment',
      tree: 'dawnbringer',
      name: 'Enlightenment',
      trigger: 'passive',
      cardType: 'passive',
      rarityValues: R([3, 4, 5, 6, 7]),
      description(r) { return `**${rv(this.rarityValues, r)}%** chance to upgrade each ability reward by one rarity tier.` },
      applyAtAcquisition(state, rarity) {
        const bonus = (state.player.rewardRarityBonus ?? 0) + rv(this.rarityValues, rarity) / 100
        return { ...state, player: { ...state.player, rewardRarityBonus: bonus } }
      },
    },
    {
      id: 'rejuvenation',
      tree: 'dawnbringer',
      name: 'Rejuvenation',
      trigger: 'passive',
      cardType: 'passive',
      rarityValues: R([0.025, 0.05, 0.075, 0.10, 0.125]),
      description(r) { return `Heal **${Math.round(rv(this.rarityValues, r) * 100)}%** of max HP after clearing each room.` },
      registerPassive(rarity, _rng) {
        registerPassive('rejuvenation', 'on_room_clear', makeRejuvenationHandler(rv(this.rarityValues, rarity)))
      },
    },
    {
      id: 'soothing_combos',
      tree: 'dawnbringer',
      name: 'Soothing Combos',
      trigger: 'combo',
      cardType: 'passive',
      rarityValues: R([0.06, 0.07, 0.08, 0.09, 0.10]),
      description(r) { return `Hitting 3+ mobs at once heals you for **${Math.round(rv(this.rarityValues, r) * 100)}%** of max HP.` },
      registerPassive(rarity, _rng) {
        registerPassive('soothing_combos', 'on_aoe_hit_three_plus', makeSoothingCombosHandler(rv(this.rarityValues, rarity)))
      },
    },
    {
      id: 'sundrops',
      tree: 'dawnbringer',
      name: 'Sundrops',
      trigger: 'wildcard',
      cardType: 'passive',
      rarityValues: R([0.20, 0.25, 0.30, 0.35, 0.40]),
      description(r) { return `Kills have a **${Math.round(rv(this.rarityValues, r) * 100)}%** chance to spawn a sundrop. Collect it for +20% speed + 15% resistance.` },
      registerPassive(rarity, rng) {
        registerPassive('sundrops', 'on_kill', makeSundropHandler(rv(this.rarityValues, rarity), rng))
      },
    },
    {
      id: 'eternal_savior',
      tree: 'dawnbringer',
      name: 'Eternal Savior',
      trigger: 'lifeline',
      cardType: 'passive',
      rarityValues: R([0.05, 0.06, 0.07, 0.08, 0.09]),
      description(r) { return `Below 20% HP: gain **90% resistance** for 5 turns. Kills during this window heal **${Math.round(rv(this.rarityValues, r) * 100)}%** HP.` },
      registerPassive(rarity, _rng) {
        const healPct = rv(this.rarityValues, rarity)
        registerPassive('eternal_savior', 'on_low_health', (state, payload) => {
          if ((state.player.hp / state.player.maxHp) > 0.20) return state
          return makeEternalSaviorHandler(healPct)(state, payload, rarity)
        })
      },
    },
  ],
}

// ─── STEELSAGE ────────────────────────────────────────────────────────────────

const steelsage = {
  id: 'steelsage',
  name: 'Steelsage',
  emoji: '⚙️',
  description: 'Shoot projectiles and bleed enemies',
  abilities: [
    {
      id: 'sidearm',
      tree: 'steelsage',
      name: 'Sidearm',
      trigger: 'right_click',
      cardType: 'offense',
      cooldownBase: 6,
      damageType: 'projectile',
      rarityValues: R([7, 9, 12, 14, 17]),
      description(r) { return `Single-target shot dealing **${rv(this.rarityValues, r)}** damage. On kill, return to hand (up to 3 times).` },
      execute(state, ctx) {
        const { targetEnemyId, rarity } = ctx
        if (!targetEnemyId) return state
        const dmg = rv(this.rarityValues, rarity)
        const before = state.enemies.find(e => e.instanceId === targetEnemyId)?.hp ?? 0
        let s = dealDamage(state, targetEnemyId, dmg, 'projectile')
        const after = s.enemies.find(e => e.instanceId === targetEnemyId)?.hp ?? -1
        if (after <= 0 && s.player.sidearmReturnsRemaining > 0) {
          s = returnCardToHand(s, { ...this, instanceId: `sidearm_return_${Date.now()}`, cooldownRemaining: 0, rarity })
          s = { ...s, player: { ...s.player, sidearmReturnsRemaining: s.player.sidearmReturnsRemaining - 1 } }
        }
        return { ...s, _lastCardHits: [{ instanceId: targetEnemyId }], _lastCardDamage: Math.max(0, before - Math.max(0, after)) }
      },
    },
    {
      id: 'firework_blast',
      tree: 'steelsage',
      name: 'Firework Blast',
      trigger: 'sneak_right_click',
      cardType: 'offense',
      cooldownBase: 9,
      damageType: 'projectile',
      rarityValues: R([[13, 24], [18, 32], [22, 40], [26, 48], [31, 56]]),
      description(r) {
        const [base, max] = rv(this.rarityValues, r)
        return `Column shot. Deals **${base}–${max}** projectile damage (more the farther the mob).`
      },
      execute(state, ctx) {
        const { targetCol, rarity } = ctx
        const col = targetCol ?? 0
        const [base, max] = rv(this.rarityValues, rarity)
        const { height } = state.gridState
        let s = state
        const hits = []
        for (const e of s.enemies.filter(en => en.cell.col === col)) {
          const dist = Math.min(1, e.cell.row / Math.max(1, height - 1))
          const dmg = Math.round(base + (max - base) * dist)
          s = dealDamage(s, e.instanceId, dmg, 'projectile')
          hits.push(e)
        }
        return { ...s, _lastCardHits: hits }
      },
    },
    {
      id: 'scrapshot',
      tree: 'steelsage',
      name: 'Scrapshot',
      trigger: 'sneak_left_click',
      cardType: 'offense',
      cooldownBase: 8,
      damageType: 'projectile',
      rarityValues: R([35, 43, 52, 59, 68]),
      description(r) { return `Hit first mob in a column for **${rv(this.rarityValues, r)}** damage. Push it back 1. Deal 33% as shrapnel to adjacent mobs.` },
      execute(state, ctx) {
        const { targetCol, rarity } = ctx
        const col = targetCol ?? 0
        const dmg = rv(this.rarityValues, rarity)
        let s = dealDamageFirstInCol(state, col, dmg, 'projectile')
        const hit = state.enemies.find(e => e.cell.col === col)
        if (hit) {
          s = pushEnemy(s, hit.instanceId, 'back', 1)
          s = dealDamageShrapnel(s, hit.cell, dmg, 0.33, 'projectile')
        }
        return { ...s, _lastCardHits: hit ? [hit] : [] }
      },
    },
    {
      id: 'rapid_fire',
      tree: 'steelsage',
      name: 'Rapid Fire',
      trigger: 'wildcard',
      cardType: 'offense',
      cooldownBase: 14,
      damageType: 'projectile',
      rarityValues: R([4, 5, 6, 7, 8]),
      description(r) { return `Fire a barrage of **${rv(this.rarityValues, r)}** projectiles per turn for 3 turns (8 damage each, spread across the grid).` },
      execute(state, ctx) {
        const { rarity } = ctx
        const projectilesPerTurn = rv(this.rarityValues, rarity)
        const totalShots = projectilesPerTurn * 3
        let s = state
        const hits = []
        // Spread shots evenly across all enemies (simplified from random path selection).
        if (s.enemies.length === 0) return s
        for (let i = 0; i < totalShots; i++) {
          const target = s.enemies[i % s.enemies.length]
          if (target) {
            s = dealDamage(s, target.instanceId, 8, 'projectile')
            if (!hits.find(h => h.instanceId === target.instanceId)) hits.push(target)
          }
        }
        return { ...s, _lastCardHits: hits }
      },
    },
    {
      id: 'gravity_bomb',
      tree: 'steelsage',
      name: 'Gravity Bomb',
      trigger: 'swap',
      cardType: 'utility',
      cooldownBase: 15,
      damageType: 'projectile',
      rarityValues: R([18, 22, 26, 30, 34]),
      description(r) { return `Place a bomb. Detonates after 2 turns: **${rv(this.rarityValues, r)}** AoE projectile damage + pulls all mobs toward it.` },
      execute(state, ctx) {
        const { targetCell, rarity } = ctx
        const cell = targetCell ?? centerCell(state)
        return placeToken(state, cell, 'bomb', 2, { damage: rv(this.rarityValues, rarity) })
      },
    },
    {
      id: 'volley',
      tree: 'steelsage',
      name: 'Volley',
      trigger: 'sneak_bow',
      cardType: 'offense',
      cooldownBase: 11,
      damageType: 'projectile',
      rarityValues: R([10, 13, 16, 20, 24]),
      description(r) { return `Fire one arrow into each row, hitting the first mob in each for **${rv(this.rarityValues, r)}** damage.` },
      execute(state, ctx) {
        const { rarity } = ctx
        const dmg = rv(this.rarityValues, rarity)
        let s = state
        const hits = []
        for (let row = 0; row < s.gridState.height; row++) {
          const result = dealDamageFirstInRow(s, row, dmg, 'projectile')
          const hit = state.enemies.find(e => e.cell.row === row)
          if (hit) hits.push(hit)
          s = result
        }
        return { ...s, _lastCardHits: hits }
      },
    },
    {
      id: 'focused_combos',
      tree: 'steelsage',
      name: 'Focused Combos',
      trigger: 'combo',
      cardType: 'passive',
      rarityValues: R([0.60, 0.70, 0.80, 0.90, 1.00]),
      description(r) { return `**${Math.round(rv(this.rarityValues, r) * 100)}%** chance on projectile cards to apply bleed (3 dmg/turn for 2 turns).` },
      registerPassive(rarity, rng) {
        registerPassive('focused_combos', 'on_card_played', makeFocusedCombosHandler(rv(this.rarityValues, rarity), rng))
      },
    },
    {
      id: 'sharpshooter',
      tree: 'steelsage',
      name: 'Sharpshooter',
      trigger: 'passive',
      cardType: 'passive',
      rarityValues: R([4, 5, 6, 7, 8]),
      description(r) { return `Projectile hits build stacks (max 4). Each stack gives **+${rv(this.rarityValues, r)}%** projectile damage. Decays after 5 idle turns.` },
      registerPassive(_rarity, _rng) {
        registerPassive('sharpshooter', 'on_card_played', makeSharpshooterHandler())
      },
      applyAtAcquisition(state, rarity) {
        const passives = [...(state.equippedPassives ?? []), { id: 'sharpshooter', rarity, rarityValues: [4, 5, 6, 7, 8] }]
        return { ...state, equippedPassives: passives }
      },
    },
    {
      id: 'split_arrow',
      tree: 'steelsage',
      name: 'Split Arrow',
      trigger: 'passive',
      cardType: 'passive',
      rarityValues: R([0.40, 0.50, 0.60, 0.70, 0.80]),
      description(r) { return `Projectile hits that target a single mob also strike the nearest other mob for **${Math.round(rv(this.rarityValues, r) * 100)}%** of the damage.` },
      registerPassive(rarity, _rng) {
        registerPassive('split_arrow', 'on_card_played', makeSplitArrowHandler(rv(this.rarityValues, rarity)))
      },
    },
    {
      id: 'steel_stallion',
      tree: 'steelsage',
      name: 'Steel Stallion',
      trigger: 'lifeline',
      cardType: 'passive',
      rarityValues: R([0.05, 0.08, 0.10, 0.12, 0.15]),
      description(r) { return `Below 25% HP: trample the front row for massive damage. Kills during this heal **${Math.round(rv(this.rarityValues, r) * 100)}%** HP each.` },
      registerPassive(rarity, _rng) {
        const healPct = rv(this.rarityValues, rarity)
        registerPassive('steel_stallion', 'on_low_health', (state, _payload) => {
          if ((state.player.hp / state.player.maxHp) > 0.25) return state
          const firedKey = 'lowHealthFired_steel_stallion'
          if (state.player[firedKey]) return state
          let s = state
          for (const e of s.enemies.filter(en => en.cell.row === 0)) {
            s = dealDamage(s, e.instanceId, 200, 'melee')
          }
          s = { ...s, player: { ...s.player, [firedKey]: true, healOnKillPct: healPct, healOnKillTurnsLeft: 5 } }
          return { ...s, log: [...s.log, 'Steel Stallion charges!'] }
        })
      },
    },
  ],
}

// ─── WINDWALKER ───────────────────────────────────────────────────────────────

const windwalker = {
  id: 'windwalker',
  name: 'Windwalker',
  emoji: '💨',
  description: 'Control enemies through pushing and grouping attacks',
  abilities: [
    {
      id: 'aeroblast',
      tree: 'windwalker',
      name: 'Aeroblast',
      trigger: 'sneak_right_click',
      cardType: 'offense',
      cooldownBase: 5,
      damageType: 'magic',
      rarityValues: R([10, 12, 14, 16, 18]),
      description(r) { return `3×2 front magic damage (**${rv(this.rarityValues, r)}**). Pushes all hit mobs back 1 tile.` },
      execute(state, ctx) {
        const { rarity } = ctx
        const dmg = rv(this.rarityValues, rarity)
        const cells = front3x2Cells(state)
        let s = state
        const hits = []
        for (const cell of cells) {
          for (const e of enemiesAt(s, cell)) {
            s = dealDamage(s, e.instanceId, dmg, 'magic')
            s = pushEnemy(s, e.instanceId, 'back', 1)
            hits.push(e)
          }
        }
        return { ...s, _lastCardHits: hits }
      },
    },
    {
      id: 'wind_walk',
      tree: 'windwalker',
      name: 'Wind Walk',
      trigger: 'right_click',
      cardType: 'offense',
      cooldownBase: 9,
      damageType: 'magic',
      rarityValues: R([12, 14, 16, 18, 20]),
      description(r) { return `Row magic damage (**${rv(this.rarityValues, r)}**). Pushes hit mobs sideways 1 tile + stuns for **1 turn**.` },
      execute(state, ctx) {
        const { targetRow, rarity } = ctx
        const row = targetRow ?? 0
        const dmg = rv(this.rarityValues, rarity)
        let s = dealDamageRow(state, row, dmg, 'magic')
        let col = 0
        for (const e of state.enemies.filter(en => en.cell.row === row)) {
          // Alternate push direction left/right per mob.
          const dir = col % 2 === 0 ? 'back' : 'back'
          s = pushEnemy(s, e.instanceId, dir, 1)
          s = applyStatus(s, e.instanceId, 'stun', 1)
          col++
        }
        return s
      },
    },
    {
      id: 'guarding_bolt',
      tree: 'windwalker',
      name: 'Guarding Bolt',
      trigger: 'sneak_left_click',
      cardType: 'utility',
      cooldownBase: 13,
      damageType: 'magic',
      rarityValues: R([[15, 0.02], [18, 0.03], [21, 0.04], [24, 0.05], [27, 0.06]]),
      description(r) {
        const [dmg, absPct] = rv(this.rarityValues, r)
        return `3×3 magic damage (**${dmg}**), pull mobs to center. Gain **${Math.round(absPct * 100)}%** max HP absorption per mob pulled.`
      },
      execute(state, ctx) {
        const { targetCell, rarity } = ctx
        const cell = targetCell ?? centerCell(state)
        const [dmg, absPct] = rv(this.rarityValues, rarity)
        let s = dealDamageAoe(state, cell, 1, dmg, 'magic')
        let hitCount = 0
        for (const e of enemiesInRadius(state, cell, 1)) {
          s = pullEnemy(s, e.instanceId, cell)
          hitCount++
        }
        s = applyAbsorption(s, hitCount * absPct * s.player.maxHp)
        return s
      },
    },
    {
      id: 'thundercloud_form',
      tree: 'windwalker',
      name: 'Thundercloud Form',
      trigger: 'swap',
      cardType: 'utility',
      cooldownBase: 18,
      damageType: 'magic',
      rarityValues: R([[1, 1], [1, 2], [1, 3], [2, 3], [2, 4]]),
      description(r) {
        const [tiles, stun] = rv(this.rarityValues, r)
        return `Push ALL mobs back **${tiles}** tile(s). Mobs that hit a wall are stunned for **${stun} turn${stun > 1 ? 's' : ''}**.`
      },
      execute(state, ctx) {
        const { rarity } = ctx
        const [tiles, stun] = rv(this.rarityValues, rarity)
        let s = pushAll(state, { row: 0, col: 0 })
        // Stun mobs that ended up against the far wall.
        const backRow = s.gridState.height - 1
        for (const e of s.enemies.filter(en => en.cell.row >= backRow - tiles + 1)) {
          s = applyStatus(s, e.instanceId, 'stun', stun)
        }
        return s
      },
    },
    {
      id: 'skyhook',
      tree: 'windwalker',
      name: 'Skyhook',
      trigger: 'sneak_bow',
      cardType: 'utility',
      cooldownBase: 10,
      damageType: 'magic',
      rarityValues: R([20, 24, 28, 32, 36]),
      description(r) { return `Pull two mobs toward each other. If they collide, both take **${rv(this.rarityValues, r)}** magic damage.` },
      execute(state, ctx) {
        const { targetCell, rarity } = ctx
        const dmg = rv(this.rarityValues, rarity)
        if (state.enemies.length < 2) return state
        // Pick nearest two enemies to targetCell (or just first two).
        const cell = targetCell ?? centerCell(state)
        const sorted = [...state.enemies].sort((a, b) => {
          const da = Math.abs(a.cell.row - cell.row) + Math.abs(a.cell.col - cell.col)
          const db = Math.abs(b.cell.row - cell.row) + Math.abs(b.cell.col - cell.col)
          return da - db
        })
        const [mobA, mobB] = sorted
        let s = pullTowardEachOther(state, mobA.instanceId, mobB.instanceId)
        // Collision: if they share a cell after pull, deal damage to both.
        const afterA = s.enemies.find(e => e.instanceId === mobA.instanceId)
        const afterB = s.enemies.find(e => e.instanceId === mobB.instanceId)
        if (afterA && afterB && afterA.cell.row === afterB.cell.row && afterA.cell.col === afterB.cell.col) {
          s = dealDamage(s, mobA.instanceId, dmg, 'magic')
          s = dealDamage(s, mobB.instanceId, dmg, 'magic')
        }
        return s
      },
    },
    {
      id: 'aeromancy',
      tree: 'windwalker',
      name: 'Aeromancy',
      trigger: 'passive',
      cardType: 'passive',
      rarityValues: R([12, 16, 20, 24, 28]),
      description(r) { return `**+${rv(this.rarityValues, r)}%** damage when pushing mobs into walls, or to mobs sharing a tile with another mob.` },
      applyAtAcquisition(state, rarity) {
        const passives = [...(state.equippedPassives ?? []), { id: 'aeromancy', rarity, rarityValues: [12, 16, 20, 24, 28] }]
        return { ...state, equippedPassives: passives }
      },
    },
    {
      id: 'dodging',
      tree: 'windwalker',
      name: 'Dodging',
      trigger: 'passive',
      cardType: 'passive',
      rarityValues: R([0.15, 0.20, 0.25, 0.30, 0.35]),
      description(r) { return `**${Math.round(rv(this.rarityValues, r) * 100)}%** chance when attacked to dodge and push the attacker back 1 tile instead.` },
      registerPassive(rarity, rng) {
        registerPassive('dodging', 'on_attack_received', makeDodgingHandler(rv(this.rarityValues, rarity), rng))
      },
    },
    {
      id: 'one_with_the_wind',
      tree: 'windwalker',
      name: 'One with the Wind',
      trigger: 'passive',
      cardType: 'passive',
      rarityValues: R([8, 10, 12, 14, 16]),
      description(r) { return `If no enemies are in the front 2 rows, gain **${rv(this.rarityValues, r)}%** resistance + **${rv(this.rarityValues, r)}%** speed per card play.` },
      registerPassive(rarity, _rng) {
        const val = rv(this.rarityValues, rarity)
        registerPassive('one_with_the_wind', 'on_card_played', (state) => {
          const frontClear = !state.enemies.some(e => e.cell.row <= 1)
          if (!frontClear) return state
          let s = applyBuff(state, 'resistance', val, 1)
          s = applyBuff(s, 'speed_bonus', val, 1)
          return s
        })
      },
    },
    {
      id: 'restoring_draft',
      tree: 'windwalker',
      name: 'Restoring Draft',
      trigger: 'passive',
      cardType: 'passive',
      rarityValues: R([0.01, 0.015, 0.02, 0.025, 0.03]),
      description(r) { return `Killing a mob by pushing it into a wall heals you for **${Math.round(rv(this.rarityValues, r) * 100)}%** max HP.` },
      registerPassive(rarity, _rng) {
        registerPassive('restoring_draft', 'on_kill', makeRestoringDraftHandler(rv(this.rarityValues, rarity)))
      },
    },
    {
      id: 'whirlwind',
      tree: 'windwalker',
      name: 'Whirlwind',
      trigger: 'wildcard',
      cardType: 'utility',
      cooldownBase: 12,
      damageType: null,
      rarityValues: R([2, 2, 3, 3, 4]),
      description(r) { return `All push effects deal **+1 tile** for the next **${rv(this.rarityValues, r)}** card plays.` },
      execute(state, ctx) {
        const { rarity } = ctx
        return applyWhirlwind(state, rv(this.rarityValues, rarity))
      },
    },
    {
      id: 'windswept_combos',
      tree: 'windwalker',
      name: 'Windswept Combos',
      trigger: 'combo',
      cardType: 'passive',
      rarityValues: R([5, 7.5, 10, 12.5, 15]),
      description(r) { return `Any time an enemy is pushed, gain **+${rv(this.rarityValues, r)}%** speed for 2 turns.` },
      registerPassive(rarity, _rng) {
        registerPassive('windswept_combos', 'on_push', makeWindsweptCombosHandler(rv(this.rarityValues, rarity)))
      },
    },
    {
      id: 'last_breath',
      tree: 'windwalker',
      name: 'Last Breath',
      trigger: 'lifeline',
      cardType: 'passive',
      rarityValues: R([[2, 0.04], [3, 0.05], [3, 0.06], [4, 0.07], [4, 0.08]]),
      description(r) {
        const [cards, absPct] = rv(this.rarityValues, r)
        return `Below 30% HP: draw **${cards}** cards, push front row to the back. Gain **${Math.round(absPct * 100)}%** max HP absorption per mob pushed.`
      },
      registerPassive(rarity, _rng) {
        const [cardCount, absorptionPct] = rv(this.rarityValues, rarity)
        registerPassive('last_breath', 'on_low_health', (state, payload) => {
          if ((state.player.hp / state.player.maxHp) > 0.30) return state
          return makeLastBreathHandler(cardCount, absorptionPct)(state, payload, rarity)
        })
      },
    },
  ],
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const ABILITY_TREES = {
  flamecaller,
  earthbound,
  shadowdancer,
  frostborn,
  dawnbringer,
  steelsage,
  windwalker,
}

export const TREE_IDS = Object.keys(ABILITY_TREES)

// Flat lookup of all abilities across all trees.
export const ALL_ABILITIES = Object.values(ABILITY_TREES).flatMap(t => t.abilities)

export function getAbility(id) {
  return ALL_ABILITIES.find(a => a.id === id)
}
