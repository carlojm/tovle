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
  description: 'Fire DoT, AoE burst, chain explosions.',
  abilities: [
    {
      id: 'fireball',
      tree: 'flamecaller',
      name: 'Fireball',
      trigger: 'right_click',
      cardType: 'offense',
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
      cooldownBase: 8,
      damageType: 'magic',
      rarityValues: R([14, 17, 20, 23, 26]),
      description(r) { return `Full front-row magic damage (**${rv(this.rarityValues, r)}**) + **burn** on all hit mobs.` },
      execute(state, ctx) {
        const { rarity } = ctx
        let s = dealDamageRow(state, 0, rv(this.rarityValues, rarity), 'magic', { cardTree: 'flamecaller' })
        for (const e of enemiesInRow(s, 0)) {
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
      cooldownBase: 16,
      damageType: 'magic',
      rarityValues: R([36, 45, 54, 63, 72]),
      description(r) { return `Mark a 3×3 area. Next turn: **${rv(this.rarityValues, r)}** magic damage + burn on all hit mobs.` },
      execute(state, ctx) {
        const { targetCell, rarity } = ctx
        const cell = targetCell ?? centerCell(state)
        return placeToken(state, cell, 'meteor_marker', 1, { damage: rv(this.rarityValues, rarity) })
      },
    },
    {
      id: 'igneous_rune',
      tree: 'flamecaller',
      name: 'Igneous Rune',
      trigger: 'sneak_left_click',
      cardType: 'utility',
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
  description: 'Push/pull, crowd control, thorns, damage absorption.',
  abilities: [
    {
      id: 'beasts_claw',
      tree: 'earthbound',
      name: "Beast's Claw",
      trigger: 'right_click',
      cardType: 'offense',
      cooldownBase: 6,
      damageType: 'melee',
      rarityValues: R([1.00, 1.10, 1.20, 1.30, 1.40]),
      description(r) { return `3×2 melee attack dealing **${Math.round(rv(this.rarityValues, r) * 100)}%** damage. Stuns hit mobs for **1 turn**.` },
      execute(state, ctx) {
        const { rarity, runStats } = ctx
        const dmg = Math.round(runStats.meleeDamage * rv(this.rarityValues, rarity))
        const cells = front3x2Cells(state)
        let s = state
        const hits = []
        for (const cell of cells) {
          for (const e of enemiesAt(s, cell)) {
            s = dealDamage(s, e.instanceId, dmg, 'melee')
            s = applyStatus(s, e.instanceId, 'stun', 1)
            hits.push(e)
          }
        }
        return { ...s, _lastCardHits: hits }
      },
    },
    {
      id: 'earthen_wrath',
      tree: 'earthbound',
      name: 'Earthen Wrath',
      trigger: 'swap',
      cardType: 'offense',
      cooldownBase: 14,
      damageType: 'melee',
      rarityValues: R([0.60, 0.70, 0.80, 0.90, 1.00]),
      description(r) { return `Deal **${Math.round(rv(this.rarityValues, r) * 100)}%** melee damage to all mobs. **Doubled** if you took damage recently.` },
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
      cooldownBase: 9,
      damageType: 'melee',
      rarityValues: R([1.00, 1.10, 1.20, 1.30, 1.40]),
      description(r) { return `3×2 attack (**${Math.round(rv(this.rarityValues, r) * 100)}%** dmg). Pulls hit mobs to front center + stuns for **2 turns**.` },
      execute(state, ctx) {
        const { rarity, runStats } = ctx
        const dmg = Math.round(runStats.meleeDamage * rv(this.rarityValues, rarity))
        const cells = front3x2Cells(state)
        const pullTarget = { row: 0, col: Math.floor(state.gridState.width / 2) }
        let s = state
        const hits = []
        for (const cell of cells) {
          for (const e of enemiesAt(s, cell)) {
            s = dealDamage(s, e.instanceId, dmg, 'melee')
            s = pullEnemy(s, e.instanceId, pullTarget)
            s = applyStatus(s, e.instanceId, 'stun', 2)
            hits.push(e)
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
  description: 'Single-target burst, weakness stacking, vexes.',
  abilities: [
    {
      id: 'advancing_shadows',
      tree: 'shadowdancer',
      name: 'Advancing Shadows',
      trigger: 'right_click',
      cardType: 'offense',
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
  description: 'Freeze tiles, shatter for burst, setup-then-detonate.',
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

// ─── STUBS: Dawnbringer, Steelsage, Windwalker ────────────────────────────────
// Abilities are defined in depthsle-abilities.md but not yet implemented.
// These stubs allow the seeded class-select to reference all 7 trees.

const dawnbringer = {
  id: 'dawnbringer',
  name: 'Dawnbringer',
  emoji: '☀️',
  description: 'Healing, absorption, buffs, stuns. (Coming soon)',
  abilities: [],
}

const steelsage = {
  id: 'steelsage',
  name: 'Steelsage',
  emoji: '⚙️',
  description: 'Ranged projectiles, momentum stacking, bleed. (Coming soon)',
  abilities: [],
}

const windwalker = {
  id: 'windwalker',
  name: 'Windwalker',
  emoji: '💨',
  description: 'Push/pull, wall collisions, cooldown reduction. (Coming soon)',
  abilities: [],
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
