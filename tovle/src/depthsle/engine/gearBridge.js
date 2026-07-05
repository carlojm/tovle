// Converts player gear stats into Depthsle run stats, locked at run start.
// Stats are passed through directly from calcStats() with no normalization.
// Ability definitions express their damage as % of these raw values.

import { calcStats } from '../../utils/odm/statCalc'
import { getPlayerSlots } from '../../utils/equipUtils'
import islesItems from '../../data/islesItems.json'

const BASELINE = {
  maxHp: 20,
  meleeDamage: 2,
  projectileDamage: 0,
  magicDamage: 0,
  regenPerSec: 0,
  cooldownRate: 1.0,
  weaponType: 'sword',
}

function detectWeaponType(slots, equipment) {
  const mainhandSlot = slots.find(s => s.type === 'mainhand')
  if (!mainhandSlot?.itemId) return 'sword'
  const instance = equipment?.find(e => e.id === mainhandSlot.itemId)
  if (!instance) return 'sword'
  const itemType = islesItems[instance.itemKey]?.type ?? ''
  if (['Bow', 'Crossbow', 'Trident', 'Snowball'].includes(itemType)) return 'ranged'
  if (['Wand', 'Mainhand'].includes(itemType)) return 'magic' //mainhand = potion bag cuz idk
  if (itemType === 'Axe') return 'axe'
  if (itemType === 'Scythe') return 'scythe'
  return 'sword'
}

export function buildRunStats(playerData) {
  const slots = getPlayerSlots(playerData)
  const equipment = playerData?.equipment ?? []
  const stats = calcStats(slots, equipment)
  if (!stats) return BASELINE

  const weaponType = detectWeaponType(slots, equipment)

  return {
    maxHp:             Math.round(parseFloat(stats.meleeEHP)),
    meleeDamage:       parseFloat(stats.critSpamDPS),
    projectileDamage:  parseFloat(stats.projSpamDPS),
    magicDamage:       parseFloat(stats.magicDPS),
    regenPerSec:       parseFloat(stats.regenPerSec),
    cooldownRate:      parseFloat(stats.spellCooldownPercent) / 100,
    speedPercent:      parseFloat(stats.speedPercent),  // add this
    weaponType,
  }
}