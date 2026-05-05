export const FORUM_TIERS = [
  {
    tier: 0,
    label: 'Tier 0',
    description: 'This used to be a nexus of \
    research and trade, and now it\'s abandoned. Seems like an adventurer recently \
    cleared out any monsters that might have lived here. \
    You could probably fix it up and \
    use it as a new headquarters.',
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
      { type: 'skill_tree_node', nodeId: 'forum_tier_1', target: 1, label: 'Unlock Forum Tier 1 in the skill tree' },
    ],
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
    description: 'Your trading empire spans the eastern reaches. Mistport sends a courier.',
    required: [
      { type: 'town_level', townId: 'frostgate', target: 3, label: 'Reach Frostgate level 3' },
    ],
    optional: [
      { type: 'trades_executed_total', target: 50, label: 'Execute 50 total trades' },
      { type: 'shipments_opened', target: 10, label: 'Open 10 shipments' },
      { type: 'town_level', townId: 'alnera', target: 5, label: 'Reach Alnera level 5' },
      { type: 'tower_height', target: 25, label: 'Reach tower height 25' },
    ],
    minOptional: 2,
  },
  {
    tier: 4,
    label: 'Tier 4',
    description: 'The forum\'s influence reaches the southern ports.',
    required: [
      { type: 'town_level', townId: 'mistport', target: 3, label: 'Reach Mistport level 3' },
    ],
    optional: [
      { type: 'trades_executed_total', target: 150, label: 'Execute 150 total trades' },
      { type: 'town_level', townId: 'alnera', target: 8, label: 'Reach Alnera level 8' },
      { type: 'town_level', townId: 'frostgate', target: 5, label: 'Reach Frostgate level 5' },
      { type: 'shipments_opened', target: 30, label: 'Open 30 shipments' },
      { type: 'tower_height', target: 40, label: 'Reach tower height 40' },
    ],
    minOptional: 2,
  },
  {
    tier: 5,
    label: 'Tier 5',
    description: 'The forge city of Steelmeld opens its gates.',
    required: [
      { type: 'town_level', townId: 'steelmeld', target: 3, label: 'Reach Steelmeld level 3' },
    ],
    optional: [
      { type: 'trades_executed_total', target: 300, label: 'Execute 300 total trades' },
      { type: 'town_level', townId: 'mistport', target: 5, label: 'Reach Mistport level 5' },
      { type: 'town_level', townId: 'frostgate', target: 8, label: 'Reach Frostgate level 8' },
      { type: 'shipments_opened', target: 75, label: 'Open 75 shipments' },
      { type: 'total_forum_runs', target: 50, label: 'Complete 50 forum runs' },
    ],
    minOptional: 3,
  },
]

export const TOWN_UNLOCKS = [
  {
    townId: 'alnera',
    label: 'Alnera',
    required: [
      { type: 'skill_tree_node', nodeId: 'alnera_unlock', target: 1, label: 'Unlock the Alnera trade route in the skill tree' },
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