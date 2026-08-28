export const FORUM_TIERS = [
  {
    tier: 0,
    label: 'Tier 0',
    description: `This used to be a nexus of research and trade, and now it's abandoned.
    Seems like an adventurer recently cleared out any monsters that might have lived here.
    You could probably fix it up and use it as a new headquarters.`,
    required: [],
    optional: [],
    minOptional: 0,
  },
  {
    tier: 1,
    label: 'Tier 1',
    description: 'Reconstruction efforts are underway! A representative from Alnera visits to establish trade.',
    // tier 1 is unlocked via the skill tree
    required: [
      { type: 'skill_tree_node', nodeId: 'forum_tier_1', target: 1, label: 'Unlock Forum Tier 1 in the upgrade tree' },
    ],
    optional: [],
    minOptional: 0,
  },
  {
    tier: 2,
    label: 'Tier 2',
    description: 'Your reputation with Alnera grows. A Frostgate ambassador arrives to set up a trade route as well.',
    required: [
      {
        type: 'collection_tier',
        tier: 'Tier 1',
        target: 25,
        label: 'Discover 25 unique Tier 1 items',
      },
      { type: 'best_equip_stat_any', stats: ['armor', 'agility'], target: 12, label: 'Reach stat: 12 Armor or Agility' },
    ],
    optional: [
      { type: 'caches_opened', target: 50, label: 'Open 50 caches' },
      { type: 'trades_executed_town', townId: 'alnera', target: 4, label: 'Make 4 trades with Alnera' },
      { type: 'axolotl_level_total', target: 10, label: 'Reach axolotl combined level 10' },
      { type: 'tower_height', target: 25, label: 'Reach tower height 25' },
    ],
    minOptional: 2,
  },
  {
    tier: 3,
    label: 'Tier 3',
    description: `This place is starting to look nice again. You worry you might meet some pirates soon.`,
    required: [
      { type: 'town_level', townId: 'frostgate', target: 3, label: 'Reach Frostgate level 3' },
      { type: 'collection_tier', tier: 'Tier 2', target: 20, label: 'Discover 20 unique Tier 2 items' },
    ],
    optional: [
      { type: 'items_traded_total', target: 120, label: 'Trade away 120 items total' },
      { type: 'shipment_equipment_collected', target: 30, label: 'Find 30 gear pieces in shipments' },
      { type: 'town_level', townId: 'alnera', target: 5, label: 'Reach Alnera level 5' },
      { type: 'depthsle_best_rooms', target: 10, label: 'Clear 10 rooms in a Depths run' },
    ],
    minOptional: 2,
  },
  {
    tier: 4,
    label: 'Tier 4',
    description: `A researcher from Steelmeld visits to collect records they left behind. They are surprised to find their lab turned into an axolotl habitat.`,
    required: [
      { type: 'town_level', townId: 'mistport', target: 3, label: 'Reach Mistport level 3' },
      { type: 'depthsle_total_rooms_cleared', target: 70, label: 'Clear a total of 70 Depths rooms.' },
    ],
    optional: [
      { type: 'items_received_total', target: 90, label: 'Receive 90 items total from trades' },
      { type: 'town_level', townId: 'alnera', target: 8, label: 'Reach Alnera level 8' },
      { type: 'shipment_equipment_collected', target: 55, label: 'Find 55 gear pieces in shipments' },
      { type: 'depthsle_total_treasure_score', target: 1000, label: 'Amass 1000 lifetime treasure score' },
    ],
    minOptional: 2,
  },
  {
    tier: 5,
    label: 'Tier 5',
    description: `Your trading empire continues to expand. Your armory grows.`,
    required: [
      { type: 'town_level', townId: 'steelmeld', target: 3, label: 'Reach Steelmeld level 3' },
      { type: 'collection_tier', tier: 'Tier 4', target: 30, label: 'Discover 30 unique Tier 4 items' },
    ],
    optional: [
      { type: 'items_traded_total', target: 350, label: 'Trade away 350 items total' },
      { type: 'town_level', townId: 'frostgate', target: 8, label: 'Reach Frostgate level 8' },
      { type: 'total_forum_runs', target: 100, label: 'Complete 100 forum runs' },
      { type: 'depthsle_best_rooms', target: 15, label: 'Clear 15 rooms in a Depths run' },
    ],
    minOptional: 2,
  },
  {
    tier: 6,
    label: 'Tier 6',
    description: `As you continue to grow, you start finding more uncommon equipment.`,
    required: [
      { type: 'town_level', townId: 'steelmeld', target: 6, label: 'Reach Steelmeld level 6' },
      { type: 'collection_tier', tier: 'Tier 5', target: 50, label: 'Discover 50 unique Tier 5 items' },
    ],
    optional: [
      { type: 'items_received_total', target: 260, label: 'Receive 260 items total from trades' },
      { type: 'town_level', townId: 'mistport', target: 8, label: 'Reach Mistport level 8' },
      { type: 'town_level', townId: 'steelmeld', target: 5, label: 'Reach Steelmeld level 5' },
      { type: 'shipment_equipment_collected', target: 150, label: 'Find 150 gear pieces in shipments' },
      { type: 'total_forum_runs', target: 85, label: 'Complete 85 forum runs' },
      { type: 'depthsle_best_score', target: 400, label: 'Reach a Depthsle treasure score of 400 in one run' },
    ],
    minOptional: 3,
  },
  {
    tier: 7,
    label: 'Tier 7',
    description: `You're just about finished rebuilding this place, and unique items have started to show up in shipments.`,
    required: [
      { type: 'town_level', townId: 'steelmeld', target: 10, label: 'Reach Steelmeld level 10' },
    ],
    optional: [
      { type: 'items_traded_total', target: 700, label: 'Trade away 700 items total' },
      { type: 'shipment_equipment_collected', target: 220, label: 'Find 220 gear pieces in shipments' },
      { type: 'crystals_earned_total', target: 100000, label: 'Earn a total of 100,000 prismarine crystals.' },
      { type: 'depthsle_total_rooms_cleared', target: 200, label: 'Clear a total of 200 Depths rooms.' },
    ],
    minOptional: 2,
  },
]

export const TOWN_UNLOCKS = [
  {
    townId: 'alnera',
    label: 'Alnera',
    required: [
      { type: 'skill_tree_node', nodeId: 'alnera_unlock', target: 1, label: 'Unlock the Alnera trade route in the upgrade tree' },
    ],
    optional: [],
    minOptional: 0,
  },
  {
    townId: 'frostgate',
    label: 'Frostgate',
    required: [
      { type: 'town_level', townId: 'alnera', target: 3, label: 'Reach Alnera level 3' },
    ],
    optional: [
      { type: 'shipment_equipment_collected', target: 8, label: 'Find 8 gear pieces in shipments' },
      { type: 'caches_opened', target: 50, label: 'Open 50 caches' },
    ],
    minOptional: 1,
  },
  {
    townId: 'mistport',
    label: 'Mistport',
    required: [
      { type: 'town_level', townId: 'frostgate', target: 3, label: 'Reach Frostgate level 3' },
    ],
    optional: [
      { type: 'items_traded_total', target: 70, label: 'Trade away 70 items total' },
      { type: 'town_level', townId: 'alnera', target: 6, label: 'Reach Alnera level 6' },
      { type: 'shipment_equipment_collected', target: 15, label: 'Find 15 gear pieces in shipments' },
    ],
    minOptional: 1,
  },
  {
    townId: 'steelmeld',
    label: 'Steelmeld',
    required: [
      { type: 'town_level', townId: 'mistport', target: 3, label: 'Reach Mistport level 3' },
    ],
    optional: [
      { type: 'items_traded_total', target: 200, label: 'Trade away 200 items total' },
      { type: 'town_level', townId: 'frostgate', target: 6, label: 'Reach Frostgate level 6' },
      { type: 'shipment_equipment_collected', target: 50, label: 'Find 50 gear pieces in shipments' },
      { type: 'depthsle_best_rooms', target: 10, label: 'Clear 10 rooms in a single Depthsle run' },
    ],
    minOptional: 1,
  },
]