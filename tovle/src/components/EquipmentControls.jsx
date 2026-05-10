import './EquipmentControls.css'
import islesItems from '../data/islesItems.json'

const TIER_ORDER = {
  'Tier 1': 0, 'Tier 2': 1, 'Tier 3': 2, 'Tier 4': 3, 'Tier 5': 4,
  'Uncommon': 5, 'Unique': 6, 'Rare': 7, 'Artifact': 8, 'Epic': 9,
}

export { TIER_ORDER }

const SORT_AXES = ['date', 'tier', 'float']

export default function EquipmentControls({
  instances,
  sortAxis, setSortAxis,
  sortDir, setSortDir,
  filterStarred, setFilterStarred,
  filterType, setFilterType,
  filterTier, setFilterTier,
}) {
  // derive available types and tiers from actual equipment
  // const types = [...new Set(instances.map(i => i.type).filter(Boolean))].sort()
  const types = [...new Set(
    instances
        .map(i => islesItems[i.itemKey]?.type)
        .filter(Boolean)
    )].sort()
  const tiers = [...new Set(instances.map(i => i.tier).filter(Boolean))]
    .sort((a, b) => (TIER_ORDER[a] ?? 99) - (TIER_ORDER[b] ?? 99))

  const handleSortAxis = (axis) => {
    if (sortAxis === axis) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortAxis(axis)
      setSortDir('asc')
    }
  }

  return (
    <div className="eq-controls">
      <div className="eq-controls-row">
        {SORT_AXES.map(axis => (
          <button
            key={axis}
            className={`eq-control-btn ${sortAxis === axis ? 'eq-control-btn--active' : ''}`}
            onClick={() => handleSortAxis(axis)}
          >
            {axis === 'date' ? 'Date' : axis === 'tier' ? 'Tier' : 'Float'}
            {sortAxis === axis ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
          </button>
        ))}
      </div>

      <div className="eq-controls-row">
        <button
          className={`eq-control-btn ${filterStarred ? 'eq-control-btn--active' : ''}`}
          onClick={() => setFilterStarred(f => !f)}
        >
          ★ Starred
        </button>

        <select
          className="eq-control-select"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          className="eq-control-select"
          value={filterTier}
          onChange={e => setFilterTier(e.target.value)}
        >
          <option value="">All Tiers</option>
          {tiers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
    </div>
  )
}