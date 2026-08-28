//this file is straight claude
//i dont care enough to translate all the combatreducer stuff into localstorage
//thank you claude

// Depthsle run persistence: localStorage for mid-run saves, cleared once
// the run is written to Firestore on completion.
//
// Two problems JSON.stringify can't solve on its own:
//  1. gridState.frozenTiles is a Set — JSON.stringify turns it into "{}" (silently
//     losing all the frozen cells), so we convert it to/from a plain Array by hand.
//  2. Ability objects (in `hand`, `abilities`, `rewardChoices`, `upgradeChoices`)
//     carry function properties (execute, registerPassive, applyAtAcquisition).
//     JSON.stringify just drops function-valued keys — no error, no warning — so
//     after a round trip those cards would silently stop doing anything. We fix
//     this by only ever trusting the *data* fields we save (id, tree, rarity,
//     instanceId, cooldownRemaining, ...) and re-attaching the live, function-bearing
//     definition from ABILITY_TREES when we load.

import { ABILITY_TREES } from '../data/abilities.js'

const RUN_STORAGE_KEY = 'depthsle_run_v1'

// Re-attach the live ability definition (with its functions) to a saved
// card/ability reference. Basic attack cards have no `.tree` and are plain
// data already, so they pass through untouched.
function rehydrateAbilityRef(ref) {
  if (!ref || ref.isBasicAttack) return ref
  const tree = ABILITY_TREES[ref.tree]
  const def = tree?.abilities.find(a => a.id === (ref.cardId ?? ref.id))
  return def ? { ...def, ...ref } : ref
}

function serializeRunState(state) {
  return {
    ...state,
    gridState: {
      ...state.gridState,
      frozenTiles: Array.from(state.gridState.frozenTiles),
    },
  }
}

function deserializeRunState(saved) {
  return {
    ...saved,
    gridState: {
      ...saved.gridState,
      frozenTiles: new Set(saved.gridState.frozenTiles ?? []),
    },
    abilities: (saved.abilities ?? []).map(rehydrateAbilityRef),
    hand: (saved.hand ?? []).map(rehydrateAbilityRef),
    rewardChoices: saved.rewardChoices ? saved.rewardChoices.map(rehydrateAbilityRef) : saved.rewardChoices,
    upgradeChoices: saved.upgradeChoices ? saved.upgradeChoices.map(rehydrateAbilityRef) : saved.upgradeChoices,
  }
}

export function saveRunToStorage(state) {
  try {
    localStorage.setItem(RUN_STORAGE_KEY, JSON.stringify(serializeRunState(state)))
  } catch (err) {
    console.error('Failed to save Depthsle run to localStorage', err)
  }
}

// Returns the resumed state, or null if there's nothing valid to resume
// (no saved run, corrupted data, or the saved run is from a previous day).
export function loadRunFromStorage(gameDate) {
  try {
    const raw = localStorage.getItem(RUN_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)

    // Daily transition: a run from a previous day is abandoned, not resumed.
    if (parsed.dateString !== gameDate) {
      localStorage.removeItem(RUN_STORAGE_KEY)
      return null
    }

    // Safety net — a completed run should already have been cleared after
    // its Firestore save, but never resume into a dead state either way.
    if (parsed.phase === 'GAME_OVER') {
      localStorage.removeItem(RUN_STORAGE_KEY)
      return null
    }

    return deserializeRunState(parsed)
  } catch (err) {
    console.error('Failed to load Depthsle run from localStorage', err)
    localStorage.removeItem(RUN_STORAGE_KEY)
    return null
  }
}

export function clearRunFromStorage() {
  localStorage.removeItem(RUN_STORAGE_KEY)
}