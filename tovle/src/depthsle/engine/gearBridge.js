// Converts player gear stats into Depthsle run stats, locked at run start.
//
// Source of truth: calcStats() from statCalc.js, which is also used by
// EquipPanel.jsx to show the player their aggregated gear values.
//
// Normalization targets (tunable):
//   maxHp:         100 (no gear) → ~500 (top-tier gear)  via meleeEHP
//   meleeDamage:   10  (no gear) → ~60  (top-tier)       via critSpamDPS
//   projectileDamage: same scale as meleeDamage
//   magicDamage:   10  (no gear) → ~60  (top-tier)       via magicDamage stat
//   regenPercent:  0   (no gear) → ~0.15 (top-tier)      via regenPerSec
//   cooldownRate:  1.0 (no gear) → ~1.4  (top-tier)      via speedPercent

import { calcStats } from '../../utils/odm/statCalc'
import { getPlayerSlots } from '../../utils/equipUtils'

const BASELINE = {
  maxHp: 100,
  meleeDamage: 10,
  projectileDamage: 10,
  magicDamage: 10,
  regenPercent: 0,
  cooldownRate: 1.0,
}

// EHP → maxHp: log-curve so early gear upgrades matter a lot.
// At ~100 EHP (base): 100 HP. At ~5000 EHP: ~500 HP.
function ehpToHp(meleeEHP) {
  const ehp = parseFloat(meleeEHP) || 100
  if (ehp <= 100) return 100
  return Math.round(Math.min(100 + Math.log10(ehp / 100) * 200, 600))
}

// critSpamDPS → meleeDamage: linear scale, capped at 80.
// Typical values: 0 (no gear) → several hundred (top gear).
// We treat 200 DPS as roughly equal to 50 melee damage.
function dpsToDamage(critSpamDPS) {
  const dps = parseFloat(critSpamDPS) || 0
  if (dps <= 0) return 10
  return Math.round(Math.min(10 + dps * 0.2, 80))
}

// regenPerSec → regenPercent of maxHp per encounter.
// Multiply by an assumed 30-second encounter and normalize to maxHp.
function regenToPercent(regenPerSec, maxHp) {
  const regen = parseFloat(regenPerSec) || 0
  if (regen <= 0) return 0
  const totalRegen = regen * 30
  return Math.min(totalRegen / maxHp, 0.5)
}

// speedPercent → cooldownRate multiplier.
// 100% base speed = 1.0 rate. Each 20% above 100% = +0.1 rate.
function speedToRate(speedPercent) {
  const sp = parseFloat(speedPercent) || 100
  return Math.max(1.0, 1.0 + (sp - 100) / 200)
}

// Detect mainhand weapon type from equipped slots to set the basic attack chain.
// Returns 'sword' | 'axe' | 'scythe' | 'ranged' | 'wand' | 'sword' (default).
function detectWeaponType(slots, equipment) {
  const mainhandSlot = slots.find(s => s.type === 'mainhand')
  if (!mainhandSlot?.itemId) return 'sword'
  const instance = equipment?.find(e => e.id === mainhandSlot.itemId)
  if (!instance) return 'sword'
  const itemType = instance.itemType ?? instance.type ?? ''
  if (['Bow', 'Crossbow', 'Trident', 'Snowball'].includes(itemType)) return 'ranged'
  if (itemType === 'Wand') return 'wand'
  if (itemType === 'Axe') return 'axe'
  if (itemType === 'Scythe') return 'scythe'
  return 'sword'
}

// Main export. Pass playerData directly.
// Returns a plain runStats object that never changes during the run.
export function buildRunStats(playerData) {
  const slots = getPlayerSlots(playerData)
  const equipment = playerData?.equipment ?? []

  const stats = calcStats(slots, equipment)

  if (!stats) return { ...BASELINE, weaponType: 'sword' }

  const maxHp = ehpToHp(stats.meleeEHP)
  const meleeDamage = dpsToDamage(stats.critSpamDPS)

  // Ranged and magic damage use the same scale but their own stat keys.
  const projectileDamage = dpsToDamage(
    parseFloat(stats.throwRate) > 0
      ? (parseFloat(stats.projectileDamagePercent) / 100) * parseFloat(stats.critSpamDPS)
      : stats.critSpamDPS
  )
  const rawMagic = parseFloat(stats.classMagicDamagePercent) || 0
  const magicDamage = rawMagic > 0 ? Math.round(Math.min(10 + rawMagic * 0.3, 80)) : 10

  const regenPercent = regenToPercent(stats.regenPerSec, maxHp)
  const cooldownRate = speedToRate(stats.speedPercent)
  const weaponType = detectWeaponType(slots, equipment)

  return {
    maxHp,
    meleeDamage,
    projectileDamage,
    magicDamage,
    regenPercent,
    cooldownRate,
    weaponType,
  }
}
