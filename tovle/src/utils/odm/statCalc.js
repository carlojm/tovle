// src/utils/statCalc.js
// Bridges Tovle's equipped slot system to the ohthemisery Stats calculator.
// Handles bonus slots by merging stats of same-type items before passing in.

//scraped and mangled with claude's help

import Stats from './stats'
import islesItems from '../../data/islesItems.json'

// All situationals enabled — items with the enchantment get it applied,
// items without it contribute 0 so it's harmless.
// may change this later but for now keep them all on cuz it's funny
const ENABLED_BOXES = {
  shielding: true, poise: true, inure: true, steadfast: true, guard: true,
  second_wind: true, ethereal: true, reflexes: true, evasion: true,
  tempo: true, cloaked: true, earth_aspect: true,
  smite: true, duelist: true, slayer: true, point_blank: true, sniper: true,
  first_strike: true, regicide: true, trivium: true, stamina: true,
  technique: true, abyssal: true, fractal: true, skyseeker: true,
  retaliation_normal: false, retaliation_elite: false, retaliation_boss: false,
}

// No class abilities, Tovle has no class system.
const DISABLED_CLASS_BUFFS = {
  versatile: false, weapon_mastery: false, weapon_mastery_lv1: false,
  weapon_mastery_lv2: false, weapon_mastery_enhancement: false, formidable: false,
  dethroner_elite: false, dethroner_boss: false, culling: false,
  totemic_empowerment: false, taboo_lv1: false, taboo_lv2: false,
  taboo_burst: false, taboo: false, channeling: false,
  celestial_blessing: false, celestial_blessing_lv1: false, celestial_blessing_lv2: false,
}

const EMPTY_EXTRA_STATS = {
  damageMultipliers: [], resistanceMultipliers: [],
  healthMultipliers: [], speedMultipliers: [], attackSpeedMultipliers: [],
}

const SLOT_TYPE_TO_CALC_KEY = {
  helmet: 'helmet',
  chestplate: 'chestplate',
  leggings: 'leggings',
  boots: 'boots',
  mainhand: 'mainhand',
  offhand: 'offhand',
  // bonus slot types map to their calc key
  blade: 'mainhand',
  magic: 'mainhand',
  ranged: 'mainhand',
  tool: 'mainhand',
}

// Merge an array of stat objects into one by summing all keys.
function mergeStats(statObjects) {
  const merged = {}
  for (const stats of statObjects) {
    if (!stats) continue
    for (const [key, value] of Object.entries(stats)) {
      merged[key] = (merged[key] ?? 0) + Number(value)
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined
}

// Collect all equipped instances for a given calc key (e.g. 'mainhand', 'helmet').
// Includes both main slots and bonus slots.
function getInstancesForCalcKey(calcKey, slots, equipment) {
  return slots
    .filter(slot => SLOT_TYPE_TO_CALC_KEY[slot.type] === calcKey && slot.itemId)
    .map(slot => equipment.find(e => e.id === slot.itemId))
    .filter(Boolean)
}

// Build the merged itemStats and fullItemData for the Stats constructor.
function buildStatInputs(slots, equipment) {
  const calcKeys = ['mainhand', 'offhand', 'helmet', 'chestplate', 'leggings', 'boots']

  const itemStats = {}
  const fullItemData = {}

  for (const key of calcKeys) {
    const instances = getInstancesForCalcKey(key, slots, equipment)

    if (instances.length === 0) {
      itemStats[key] = undefined
      fullItemData[key] = { masterwork: 0 } // same dummy ohthemisery uses for empty slots
      continue
    }

    // Merge all stats from all instances of this slot type
    const statObjects = instances.map(i => islesItems[i.itemKey]?.stats)
    itemStats[key] = mergeStats(statObjects)

    // Use the first item's metadata as the representative for type/base_item checks
    const firstDef = islesItems[instances[0].itemKey] ?? {}
    fullItemData[key] = {
      ...firstDef,
      stats: itemStats[key],
    }
  }

  return { itemStats, fullItemData }
}

// Main export — call with playerData's slots and equipment arrays.
// Returns a Stats instance with all calculated values, or null if nothing is equipped.
export function calcStats(slots, equipment) {
  if (!slots || !equipment) return null

  const hasAnyEquipped = slots.some(s => s.itemId)
  if (!hasAnyEquipped) return null

  const { itemStats, fullItemData } = buildStatInputs(slots, equipment)

  const formData = {
    region: 2,   // Isles
    health: 100, // full health
    tenacity: 0, vitality: 0, vigor: 0, focus: 0, perspicacity: 0,
  }

  return new Stats(itemStats, fullItemData, formData, ENABLED_BOXES, EMPTY_EXTRA_STATS, DISABLED_CLASS_BUFFS)
}