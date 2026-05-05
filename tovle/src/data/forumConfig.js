export const FORUM_TIERS = [
  {
    tier: 1,
    label: 'Tier 1',
    description: 'Reconstruction efforts are underway! A representative from Alnera visits to establish trade.',
    // tier 1 is unlocked via the skill tree, no goals needed
    required: [],
    optional: [],
    minOptional: 0,
  },
  {
    tier: 2,
    label: 'Tier 2',
    description: 'Your reputation with Alnera grows. A Frostgate ambassador arrives to set up a trade route.',
    required: [
      { type: 'town_level', townId: 'alnera', target: 2, label: 'Reach Alnera level 2' },
    ],
    optional: [
      { type: 'caches_opened', target: 50, label: 'Open 50 caches' },
      { type: 'trades_executed_town', townId: 'alnera', target: 4, label: 'Make 4 trades with Alnera' },
      { type: 'axolotl_level', target: 3, label: 'Reach axolotl level 3' },
      { type: 'tower_height', target: 10, label: 'Reach tower height 10' },
    ],
    minOptional: 2,
  },
  {
    tier: 3,
    label: 'Tier 3',
    description: 'placeholder',
    required: [
      { type: 'town_level', townId: 'frostgate', target: 3, label: 'Reach Frostgate level 3' },
    ],
    optional: [
      { type: 'trades_executed_total', target: 50, label: 'Execute 50 total trades' },
      { type: 'shipments_opened', target: 10, label: 'Open 10 shipments' },
      { type: 'town_level', townId: 'alnera', target: 5, label: 'Reach Alnera level 5' },
    ],
    minOptional: 2,
  },
  // tiers 4+ are placeholders for now
  {
    tier: 4,
    label: 'Tier 4',
    description: 'placeholder',
    required: [],
    optional: [],
    minOptional: 0,
  },
]

export const TOWN_UNLOCKS = [
  {
    townId: 'alnera',
    label: 'Alnera',
    required: [
      { type: 'skill_tree_node', nodeId: 'alnera_trades_1', target: 1, label: 'Unlock the Alnera trade route in the skill tree' },
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
      { type: 'trades_executed_town', townId: 'alnera', target: 20, label: 'Execute 20 Alnera trades' },
      { type: 'caches_opened', target: 75, label: 'Open 75 caches' },
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
      { type: 'trades_executed_total', target: 75, label: 'Execute 75 total trades' },
      { type: 'town_level', townId: 'alnera', target: 6, label: 'Reach Alnera level 6' },
      { type: 'shipments_opened', target: 20, label: 'Open 20 shipments' },
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
      { type: 'trades_executed_total', target: 150, label: 'Execute 150 total trades' },
      { type: 'town_level', townId: 'frostgate', target: 6, label: 'Reach Frostgate level 6' },
      { type: 'shipments_opened', target: 40, label: 'Open 40 shipments' },
    ],
    minOptional: 1,
  },
]