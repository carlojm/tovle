// Enemy definitions for Depthsle.
// HP and damage scale with room difficulty: multiply by (1 + roomNumber * 0.08).
//
// action bar: fills each enemy_turn tick by (speed / 100). Enemy acts when >= 1.0.
// actions: array of {type, priority} — pick highest-priority valid action each tick.
//
// Cell positions are {row, col}. Row 0 = front (closest to player), row N = back.

export const ENEMIES = {
  zombie: {
    id: 'zombie',
    name: 'Zombie',
    emoji: '🧟',
    isElite: false,
    baseHp: 40,
    actionBarMax: 1.0,
    actionBarSpeed: 0.25,   // fills in 4 turns
    moveSpeed: 1,            // tiles toward player per move action
    baseDamage: 8,
    actions: [
      { type: 'melee', minRange: 0, maxRange: 1 },  // hits adjacent row
      { type: 'move',  minRange: 2, maxRange: 99 }, // move toward player if far
    ],
  },

  skeleton: {
    id: 'skeleton',
    name: 'Skeleton',
    emoji: '💀',
    isElite: false,
    baseHp: 24,
    actionBarMax: 1.0,
    actionBarSpeed: 0.33,   // fills in 3 turns
    moveSpeed: 1,
    baseDamage: 6,
    actions: [
      { type: 'ranged', minRange: 1, maxRange: 99 }, // shoots from any distance
      { type: 'melee',  minRange: 0, maxRange: 1 },  // fallback if somehow adjacent
    ],
  },

  spider: {
    id: 'spider',
    name: 'Cave Spider',
    emoji: '🕷️',
    isElite: false,
    baseHp: 18,
    actionBarMax: 1.0,
    actionBarSpeed: 0.5,    // fills in 2 turns — fast
    moveSpeed: 2,
    baseDamage: 5,
    actions: [
      { type: 'melee',  minRange: 0, maxRange: 1 },
      { type: 'poison', minRange: 0, maxRange: 1 },  // applies poison (burn-like, magic type) on hit
      { type: 'move',   minRange: 2, maxRange: 99 },
    ],
    onHit: ['poison'],  // always applies poison on melee contact
  },

  bee: {
    id: 'bee',
    name: 'Giant Bee',
    emoji: '🐝',
    isElite: false,
    baseHp: 14,
    actionBarMax: 1.0,
    actionBarSpeed: 0.4,
    moveSpeed: 1,
    baseDamage: 4,
    actions: [
      { type: 'sting',  minRange: 0, maxRange: 1 },  // melee + bleed
      { type: 'move',   minRange: 2, maxRange: 99 },
    ],
    onHit: ['bleed'],
  },

  // ── Elites ────────────────────────────────────────────────────────────────

  elite_zombie: {
    id: 'elite_zombie',
    name: 'Zombie Brute',
    emoji: '🧟',
    isElite: true,
    baseHp: 100,
    actionBarMax: 1.0,
    actionBarSpeed: 0.2,    // slow but hits hard
    moveSpeed: 1,
    baseDamage: 18,
    enrageThreshold: 0.5,   // enrages below 50% HP: +50% damage, +speed
    enragedSpeedBonus: 0.15,
    enragedDamageBonus: 0.5,
    actions: [
      { type: 'slam',  minRange: 0, maxRange: 1 },   // hits front 2 rows wide
      { type: 'melee', minRange: 0, maxRange: 1 },
      { type: 'move',  minRange: 2, maxRange: 99 },
    ],
  },

  elite_spider: {
    id: 'elite_spider',
    name: 'Webspinner',
    emoji: '🕷️',
    isElite: true,
    baseHp: 60,
    actionBarMax: 1.0,
    actionBarSpeed: 0.4,
    moveSpeed: 2,
    baseDamage: 10,
    actions: [
      { type: 'web',    minRange: 0, maxRange: 99 }, // roots target for 2 turns
      { type: 'melee',  minRange: 0, maxRange: 1 },
      { type: 'poison', minRange: 0, maxRange: 1 },
      { type: 'move',   minRange: 2, maxRange: 99 },
    ],
    onKill: ['pull_to_cell'],  // when this enemy is killed, pull all mobs to its cell
  },
}

// Enemy groups by type for seeded room population.
export const BASIC_ENEMY_IDS = ['zombie', 'skeleton', 'spider', 'bee']
export const ELITE_ENEMY_IDS = ['elite_zombie', 'elite_spider']

// Scale an enemy's HP and damage for the current room number.
export function scaleEnemy(definition, roomNumber) {
  const mult = 1 + roomNumber * 0.08
  return {
    ...definition,
    baseHp: Math.round(definition.baseHp * mult),
    baseDamage: Math.round(definition.baseDamage * mult * 10) / 10,
  }
}

// Create a live enemy instance from a definition + cell position.
let _instanceCounter = 0
export function spawnEnemy(definition, cell, roomNumber = 0) {
  const scaled = scaleEnemy(definition, roomNumber)
  return {
    instanceId: `enemy_${++_instanceCounter}`,
    definitionId: definition.id,
    name: scaled.name,
    emoji: scaled.emoji,
    isElite: scaled.isElite,
    hp: scaled.baseHp,
    maxHp: scaled.baseHp,
    actionBar: 0,
    actionBarMax: scaled.actionBarMax,
    actionBarSpeed: scaled.actionBarSpeed,
    moveSpeed: scaled.moveSpeed,
    baseDamage: scaled.baseDamage,
    actions: scaled.actions,
    onHit: scaled.onHit ?? [],
    onKill: scaled.onKill ?? [],
    enrageThreshold: scaled.enrageThreshold ?? null,
    enragedSpeedBonus: scaled.enragedSpeedBonus ?? 0,
    enragedDamageBonus: scaled.enragedDamageBonus ?? 0,
    enraged: false,
    statuses: [],  // [{type, duration, stacks}]
    cell,          // {row, col}
  }
}
