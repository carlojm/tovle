import { getTownLevel } from './townUtils'
import { getCollectedForTier } from './collectionUtils'

import { FORUM_TIERS, TOWN_UNLOCKS } from '../data/forumConfig'

// ── Goal checker ─────────────────────────────────────────────────────────────
// Returns { current, target, met, label } for any goal type.
export const checkGoal = (goal, playerData) => {
  const { type, target, townId } = goal
  let current = 0

  switch (type) {
    case 'town_level': {
      const rep = playerData?.travel?.towns?.[townId]?.reputation ?? 0
      current = getTownLevel(rep)
      break
    }
    case 'caches_opened': {
      current = playerData?.stats?.totalCachesOpened ?? 0
      break
    }
    case 'trades_executed_total': {
      current = playerData?.stats?.totalTradesExecuted ?? 0
      break
    }
    case 'trades_executed_town': {
      current = playerData?.stats?.tradesByTown?.[townId] ?? 0
      break
    }
    case 'shipments_opened': {
      current = playerData?.stats?.totalShipmentsOpened ?? 0
      break
    }
    case 'axolotl_level_total': {
      const axolotls = playerData?.axolotls ?? []
      current = axolotls.reduce((sum, a) => sum + a.level, 0)
      break
    }
    case 'tower_height': {
      current = playerData?.stats?.bestTowerHeight ?? 0
      break
    }
    case 'skill_tree_node': {
      current = playerData?.travel?.forum?.upgrades?.[goal.nodeId] ? 1 : 0
      break
    }
    case 'collection_tier': {
      const collection = playerData?.stats?.equipmentCollection ?? {}
      current = getCollectedForTier(collection, goal.tier)
      break
    }
    case 'best_equip_stat': {
      current = playerData?.stats?.bestEquipStats?.[goal.stat] ?? 0
      break
    }
    default:
      current = 0
  }

  return {
    current,
    target,
    met: current >= target,
    label: goal.label,
    type,
  }
}

// ── Unlock checkers ───────────────────────────────────────────────────────────

export const isMilestoneUnlocked = (milestone, playerData) => {
  const requiredMet = milestone.required.every(goal =>
    checkGoal(goal, playerData).met
  )
  if (!requiredMet) return false

  const optionalMet = milestone.optional.filter(goal =>
    checkGoal(goal, playerData).met
  ).length

  return optionalMet >= milestone.minOptional
}

export const getForumTier = (playerData) => {
  return [...FORUM_TIERS]
    .reverse()
    .find(tier => isMilestoneUnlocked(tier, playerData))?.tier ?? 0
}

export const isTownUnlocked = (townId, playerData) => {
  const unlock = TOWN_UNLOCKS.find(t => t.townId === townId)
  if (!unlock) return false
  return isMilestoneUnlocked(unlock, playerData)
}