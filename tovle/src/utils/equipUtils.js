// more helpers and consts written out cleanly by claude thanks claude 

// Which item types each slot accepts.
// 'mainhand' is universal and accepts everything a weapon slot could hold.
export const SLOT_ACCEPTS = {
  helmet:     ['Helmet'],
  chestplate: ['Chestplate'],
  leggings:   ['Leggings'],
  boots:      ['Boots'],
  offhand:    ['Offhand', 'Offhand Sword', 'Offhand Shield'],
  mainhand:   ['Axe', 'Mainhand Sword', 'Scythe', 'Wand', 'Crossbow', 'Bow',
               'Trident', 'Snowball', 'Pickaxe', 'Shovel', 'Mainhand Shield', 'Mainhand'],
  // bonus slot types (unlockable)
  blade:      ['Axe', 'Mainhand Sword', 'Scythe'],
  magic:      ['Wand'],
  ranged:     ['Bow', 'Crossbow', 'Snowball', 'Trident'],
  tool:       ['Pickaxe', 'Shovel', 'Mainhand Shield', 'Mainhand'],
}

export const SLOT_LABEL = {
  helmet:     'Helmet',
  chestplate: 'Chestplate',
  leggings:   'Leggings',
  boots:      'Boots',
  offhand:    'Offhand',
  mainhand:   'Mainhand',
  blade:      'Blade',
  magic:      'Magic',
  ranged:     'Ranged',
  tool:       'Tool',
}

export const getSlotLabel = (type) => SLOT_LABEL[type] ?? type

// The canonical 6 main slots, in display order.
// Used as a fallback when playerData.equip is not yet populated.
export const DEFAULT_SLOTS = [
  { slotId: 'slot_001', type: 'helmet',     itemId: null, infusions: [] },
  { slotId: 'slot_002', type: 'chestplate', itemId: null, infusions: [] },
  { slotId: 'slot_003', type: 'leggings',   itemId: null, infusions: [] },
  { slotId: 'slot_004', type: 'boots',       itemId: null, infusions: [] },
  { slotId: 'slot_005', type: 'mainhand',   itemId: null, infusions: [] },
  { slotId: 'slot_006', type: 'offhand',    itemId: null, infusions: [] },
]

// Returns true if an equipment instance can go into a given slot.
// item: equipment instance (has itemKey → look up type from islesItems externally)
// slotType: string key from SLOT_ACCEPTS
// itemType: the item's type string from islesItems[item.itemKey].type
export const canEquipToSlot = (itemType, slotType) => {
  const accepted = SLOT_ACCEPTS[slotType]
  if (!accepted) return false
  return accepted.includes(itemType)
}

// Returns the slots (from playerData.equip.slots) that can accept a given item type.
export const getValidSlotsForItem = (itemType, slots) => {
  return slots.filter(slot => canEquipToSlot(itemType, slot.type))
}

// Given a slot and the full equipment array, returns the live instance or null.
export const getItemInSlot = (slot, equipment) => {
  if (!slot.itemId) return null
  return equipment.find(e => e.id === slot.itemId) ?? null
}

// Returns the player's full slot array, falling back to DEFAULT_SLOTS for missing data.
// First 6 are always the main slots; anything beyond index 5 is a bonus slot.
export const getPlayerSlots = (playerData) => {
  const slots = playerData?.equip?.slots
  if (!slots || slots.length === 0) return DEFAULT_SLOTS
  return slots
}

export const getMainSlots = (playerData) => getPlayerSlots(playerData).slice(0, 6)
export const getBonusSlots = (playerData) => getPlayerSlots(playerData).slice(6)