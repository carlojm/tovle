// scraped from ohthemisery thank you bikesuper

const Formats = {
  ENCHANT: 0,
  SINGLE_ENCHANT: 1,
  ATTRIBUTE: 2,
  CURSE: 3,
  SINGLE_CURSE: 4,
  BASE_STAT: 5,
}

const categories = {
  speed: [
    ...['adrenaline', 'soul_speed'].map(n => ({ name: n, format: Formats.ENCHANT })),
    ...['speed_flat', 'speed_percent'].map(n => ({ name: n, format: Formats.ATTRIBUTE })),
    ...['curse_of_crippling'].map(n => ({ name: n, format: Formats.CURSE })),
  ],
  melee: [
    ...['sweeping_edge', 'knockback', 'quake', 'smite', 'slayer', 'duelist', 'chaotic',
      'hex_eater', 'decay', 'bleeding', 'stamina', 'first_strike', 'technique', 'reverb', 'impact']
      .map(n => ({ name: n, format: Formats.ENCHANT })),
  ],
  misc: [
    ...['second_wind', 'inferno', 'regicide', 'aptitude', 'triage', 'trivium', 'looting',
      'ice_aspect', 'fire_aspect', 'thunder_aspect', 'wind_aspect', 'earth_aspect', 'fractal']
      .map(n => ({ name: n, format: Formats.ENCHANT })),
    ...['intuition', 'weightless', 'radiant', 'darksight', 'void_tether', 'resurrection', 'infinity']
      .map(n => ({ name: n, format: Formats.SINGLE_ENCHANT })),
  ],
  prot: [
    ...['projectile_protection', 'blast_protection', 'fire_protection', 'melee_protection',
      'magic_protection', 'feather_falling']
      .map(n => ({ name: n, format: Formats.ENCHANT })),
  ],
  attributes: [
    ...['knockback_resistance_flat', 'attack_damage_percent', 'attack_speed_flat',
      'attack_speed_percent', 'magic_damage_percent', 'projectile_damage_percent',
      'projectile_speed_percent', 'thorns_flat', 'thorns_percent', 'throw_rate_percent']
      .map(n => ({ name: n, format: Formats.ATTRIBUTE })),
  ],
  health: [
    ...['regeneration', 'life_drain', 'sustenance'].map(n => ({ name: n, format: Formats.ENCHANT })),
    ...['max_health_flat', 'max_health_percent'].map(n => ({ name: n, format: Formats.ATTRIBUTE })),
    ...['curse_of_anemia'].map(n => ({ name: n, format: Formats.CURSE })),
  ],
  tool: [
    ...['efficiency', 'eruption', 'sapper', 'multitool', 'fortune', 'lure', 'drilling']
      .map(n => ({ name: n, format: Formats.ENCHANT })),
    ...['silk_touch', 'jungles_nourishment', 'excavator', 'broomstick', 'throwing_knife']
      .map(n => ({ name: n, format: Formats.SINGLE_ENCHANT })),
  ],
  epic: [
    ...['arcane_thrust', 'worldly_protection'].map(n => ({ name: n, format: Formats.ENCHANT })),
    ...['ashes_of_eternity', 'rage_of_the_keter', 'liquid_courage', 'temporal_bender',
      'intoxicating_warmth', 'retaliation']
      .map(n => ({ name: n, format: Formats.SINGLE_ENCHANT })),
  ],
  ranged: [
    ...['quick_charge', 'point_blank', 'sniper', 'piercing', 'retrieval', 'punch', 'recoil',
      'explosive', 'multi-load', 'skyseeker', 'harpoon']
      .map(n => ({ name: n, format: Formats.ENCHANT })),
    ...['multishot', 'kinetic_loading'].map(n => ({ name: n, format: Formats.SINGLE_ENCHANT })),
  ],
  specialist: [
    ...['shielding', 'poise', 'inure', 'steadfast', 'ethereal', 'reflexes', 'evasion', 'tempo',
      'cloaked', 'guard']
      .map(n => ({ name: n, format: Formats.ENCHANT })),
    ...['adaptability'].map(n => ({ name: n, format: Formats.SINGLE_ENCHANT })),
  ],
  other_curse: [
    ...['ineptitude', 'curse_of_shrapnel', 'curse_of_vanishing', 'projectile_fragility',
      'melee_fragility', 'magic_fragility', 'blast_fragility', 'fire_fragility', 'starvation',
      'curse_of_the_veil']
      .map(n => ({ name: n, format: Formats.CURSE })),
    ...['two_handed', 'curse_of_corruption', 'curse_of_irreparability', 'curse_of_instability',
      'cumbersome', 'clucking', 'baaing', 'oinking', 'curse_of_ephemerality', 'oversized']
      .map(n => ({ name: n, format: Formats.SINGLE_CURSE })),
  ],
  water: [
    ...['depth_strider', 'abyssal', 'respiration', 'riptide'].map(n => ({ name: n, format: Formats.ENCHANT })),
    ...['gills', 'aqua_affinity'].map(n => ({ name: n, format: Formats.SINGLE_ENCHANT })),
  ],
  durability: [
    ...['unbreaking'].map(n => ({ name: n, format: Formats.ENCHANT })),
    ...['unbreakable', 'mending'].map(n => ({ name: n, format: Formats.SINGLE_ENCHANT })),
  ],
  defense: [
    ...['armor', 'agility', 'armor_percent', 'agility_percent']
      .map(n => ({ name: n, format: Formats.ATTRIBUTE })),
  ],
  base_stats: [
    ...['spell_power_base'].map(n => ({ name: n, format: Formats.ATTRIBUTE })),
    ...['attack_damage_base', 'attack_speed_base', 'projectile_damage_base', 'projectile_speed_base',
      'throw_rate_base', 'potion_damage_flat', 'potion_radius_flat']
      .map(n => ({ name: n, format: Formats.BASE_STAT })),
  ],
}

function toHumanReadable(stat, value) {
  let humanStr = stat.name
    .split('_')
    .filter(p => !['m', 'p', 'bow', 'tool'].includes(p))
    .map(p => p[0].toUpperCase() + p.slice(1))
    .join(' ')

  humanStr = humanStr
    .replace(' Of ', ' of ')
    .replace(' The ', ' the ')
    .replace('Jungles', "Jungle's")

  switch (stat.format) {
    case Formats.ENCHANT:
      return `${humanStr} ${value}`
    case Formats.SINGLE_ENCHANT:
      return humanStr
    case Formats.ATTRIBUTE:
      return `${value > 0 ? '+' : ''}${value}${humanStr.includes(' Percent') || humanStr === 'Spell Power Base' ? '%' : ''} ${humanStr.replace(' Percent', '').replace(' Base', '').replace(' Flat', '')}`
    case Formats.CURSE:
      return `${humanStr} ${value}`
    case Formats.SINGLE_CURSE:
      return humanStr
    case Formats.BASE_STAT:
      return `${value} ${humanStr.replace(' Base', '').replace(' Flat', '')}`
    default:
      return humanStr
  }
}

function getStatClass(stat, value) {
  switch (stat.format) {
    case Formats.ATTRIBUTE:
      if (value < 0) return 'monumenta-negative-stat'
      return (stat.name === 'armor' || stat.name === 'agility') ? 'monumenta-positive-defence' : 'monumenta-positive-stat'
    case Formats.CURSE:
    case Formats.SINGLE_CURSE:
      return 'monumenta-negative-stat'
    case Formats.BASE_STAT:
      return 'monumenta-base-stat'
    default:
      return ''
  }
}

export function formatStats(stats) {
  if (!stats) return []

  const result = []
  for (const category of Object.values(categories)) {
    for (const stat of category) {
      if (stats[stat.name] != null) {
        result.push({
          key: stat.name,
          text: toHumanReadable(stat, stats[stat.name]),
          className: getStatClass(stat, stats[stat.name]),
        })
      }
    }
  }
  return result
}