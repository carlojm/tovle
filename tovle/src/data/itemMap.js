import {
  Coins, Eye, Zap, Gem, Circle, CircleDot, Diamond,
  Shell, Dna, Hexagon, Skull, Square, SquareDashed,
  RectangleHorizontal, TreePine, Squircle
} from 'lucide-react'

export const ITEM_MAP = {
  den_piece_100:          { icon: Coins,               color: '#f4d03f' },
  eye_of_viridia:         { icon: Eye,                 color: '#2ecc71' },
  hyperexperience:        { icon: Zap,                 color: '#9b59b6' },
  hypercrystalline_shard: { icon: Gem,                 color: '#3498db' },
  iron_nugget:            { icon: Circle,              color: '#bdc3c7' },
  gold_nugget:            { icon: CircleDot,           color: '#f39c12' },
  pulsating_emerald:      { icon: Diamond,             color: '#27ae60' },
  gleaming_seashell:      { icon: Shell,               color: '#f0e6d3' },
  twisted_strand:         { icon: Dna,                 color: '#e74c3c' },
  celsian_fragment:       { icon: Hexagon,             color: '#1abc9c' },
  harbinger:              { icon: Skull,               color: '#e74c3c' },
  prismarine_block:       { icon: Square,              color: '#48c9b0' },
  prismarine_brick:       { icon: SquareDashed,        color: '#45b39d' },
  prismarine_wall:        { icon: RectangleHorizontal, color: '#3d9b8c' },
  warped_stem:            { icon: TreePine,            color: '#7d3c98' },
  warped_hyphae:          { icon: Squircle,            color: '#6c3483' },
}