import { usePlayer } from '../context/PlayerContext'
import './Stats.css'
import { TOWN_CONFIG } from '../data/townConfig'
import { getTownLevel } from '../utils/townUtils'
import { useEffect } from 'react'
import { ITEM_MAP } from '../data/itemMap'

const DISTRIBUTION_BUCKETS = ['1', '2', '3', '4', '5', '6+']

// A stat row that hides itself when its value is zero, unless alwaysShow
// is set — for core loop stats (streak, days played) that should still
// read as "0" rather than vanish, versus optional-system stats (travel,
// depthsle) that shouldn't clutter the page for a player who hasn't
// touched that feature yet.
function StatRow({ label, value, icon, alwaysShow = false }) {
  if (!alwaysShow && (value === 0 || value === '0')) return null
  return (
    <div className="stats-list-row">
      <span>{label}</span>
      <span style={icon ? { display: 'flex', alignItems: 'center', gap: 4 } : undefined}>
        {icon && <img src={icon} style={{ width: 14, height: 14, imageRendering: 'pixelated' }} />}
        {value}
      </span>
    </div>
  )
}

const Stats = () => {
  const { playerData, refreshPlayer } = usePlayer()
  const stats = playerData?.stats

  useEffect(() => {
    refreshPlayer()
  }, [])

  if (!stats || (stats.totalCachesSolved === 0)) {
    return (
      <div className="stats-box">
        <h1>Stats</h1>
        <p className="stats-empty">Complete your first day of caches to see your stats!</p>
      </div>
    )
  }

  const rawDistribution = stats.guessDistribution ?? {}
  const distribution = {
    '1': rawDistribution['1'] ?? 0,
    '2': rawDistribution['2'] ?? 0,
    '3': rawDistribution['3'] ?? 0,
    '4': rawDistribution['4'] ?? 0,
    '5': rawDistribution['5'] ?? 0,
    '6+': Object.entries(rawDistribution)
      .filter(([key]) => parseInt(key) >= 6)
      .reduce((sum, [, val]) => sum + val, 0),
  }
  const totalSolved = stats.totalCachesSolved ?? 0
  const maxCount = Math.max(...DISTRIBUTION_BUCKETS.map(b => distribution[b] ?? 0), 1)

  const towns = playerData?.travel?.towns ?? {}
  const axolotls = playerData?.axolotls ?? []
  const totalAxolotlLevels = axolotls.reduce((sum, a) => sum + a.level, 0)
  const tradesByTown = stats?.tradesByTown ?? {}
  const depthsle = playerData?.depthsle ?? {}

  // Travel stats built as data, not JSX, so we can detect "every stat here
  // is zero" and hide the whole section rather than showing an empty header.
  const travelStats = [
    { label: 'Trades Made', value: stats.totalTradesExecuted ?? 0 },
    { label: 'Construction Runs', value: stats.totalForumRuns ?? 0 },
    { label: 'Best Tower Height', value: stats.bestTowerHeight ?? 0 },
    { label: 'Tower Blocks Placed', value: stats.totalTowerBlocks ?? 0 },
    { label: 'Total Crystals Earned', value: stats.totalCrystalsEarned ?? 0, icon: ITEM_MAP.prismarine_crystals.img },
    { label: 'Total Shards Earned', value: stats.totalShardsEarned ?? 0, icon: ITEM_MAP.prismarine_shard.img },
    { label: 'Total Perfect Placements', value: stats.totalPerfects ?? 0 },
    { label: 'Total Anchors', value: stats.totalAnchors ?? 0 },
    { label: 'Total Bubbles Popped', value: stats.totalCrits ?? 0 },
  ]
  const hasTravelStats = travelStats.some(s => s.value !== 0)

  const shipmentStats = [
    { label: 'Shipments Opened', value: stats.totalShipmentsOpened ?? 0 },
    { label: 'Shipment Equipment Collected', value: stats.totalShipmentEquipmentCollected ?? 0 },
    { label: 'Shipment Equipment Left Behind', value: stats.totalShipmentEquipmentLeftBehind ?? 0 },
    { label: 'Shipment Tiles Placed', value: stats.totalTilesPlaced ?? 0 },
    { label: 'Extra Tiles Bought', value: stats.totalExtraTilesBought ?? 0 },
    { label: 'Den Pieces Spent on Extra Tiles', value: stats.totalDenSpentOnExtraTiles ?? 0, icon: ITEM_MAP.den_pieces.img },
    { label: 'Shipment Cuts Used', value: stats.totalCutsUsed ?? 0 },
  ]
  const hasShipmentStats = shipmentStats.some(s => s.value !== 0)

  const depthsleStats = [
    { label: 'Total Runs', value: depthsle.totalRuns ?? 0 },
    { label: 'Best Rooms Cleared', value: depthsle.bestRooms ?? 0 },
    { label: 'Best Treasure Score', value: depthsle.bestScore ?? 0 },
  ]
  const hasDepthsleStats = depthsleStats.some(s => s.value !== 0)

  return (
    <div className="stats-box">
      <h1>Your Stats</h1>

      <div className="stats-list selectable">
        <div className="stats-list-row">
          <span>Up-to-date stats may require a page refresh.</span>
        </div>
        <StatRow label="Current Daily Streak" value={stats.currentStreak ?? 0} alwaysShow />
        <StatRow label="Best Daily Streak" value={stats.bestStreak ?? 0} alwaysShow />
        <StatRow label="Days Played" value={stats.totalDaysPlayed ?? 0} alwaysShow />
        <StatRow label="Caches Solved" value={stats.totalCachesSolved ?? 0} alwaysShow />
        <StatRow label="Average Guesses" value={stats.averageGuesses ?? 0} alwaysShow />
        <StatRow label="Caches Opened" value={stats.totalCachesOpened ?? 0} alwaysShow />
        <StatRow label="Items Looted" value={stats.totalItemsCollected ?? 0} />
        <StatRow label="Total Axolotl Levels" value={totalAxolotlLevels} />
      </div>

      <h2>Guess Distribution</h2>
      <div className="stats-distribution">
        {DISTRIBUTION_BUCKETS.map(bucket => {
          const count = distribution[bucket] ?? 0
          const percent = totalSolved === 0 ? 0 : Math.round((count / totalSolved) * 100)
          const barWidth = totalSolved === 0 ? 0 : (count / maxCount) * 100
          return (
            <div key={bucket} className="stats-bar-row">
              <span className="stats-bar-label">{bucket}</span>
              <div className="stats-bar-track">
                <div className="stats-bar-fill" style={{ width: `${barWidth}%` }} />
              </div>
              <span className="stats-bar-percent">{percent}%</span>
            </div>
          )
        })}
      </div>

      {hasTravelStats && (
        <>
          <h2>Travel Stats</h2>
          <div className="stats-list selectable">
            {travelStats.map(s => <StatRow key={s.label} {...s} />)}
          </div>
        </>
      )}

      {hasShipmentStats && (
        <>
          <h2>Shipment Stats</h2>
          <div className="stats-list selectable">
            {shipmentStats.map(s => <StatRow key={s.label} {...s} />)}
          </div>
        </>
      )}

      {Object.entries(TOWN_CONFIG).some(([townId]) => (towns[townId]?.reputation ?? 0) !== 0) && (
      <>
        <h2>Towns</h2>
        <div className="stats-list selectable">
          {Object.entries(TOWN_CONFIG)
            .filter(([townId]) => (towns[townId]?.reputation ?? 0) !== 0)
            .map(([townId, config]) => {
              const rep = towns[townId]?.reputation ?? 0
              const level = getTownLevel(rep)
              const trades = tradesByTown[townId] ?? 0
              return (
                <div key={townId} className="stats-list-row stats-list-row--towns">
                  <span>{config.name}</span>
                  <span>Lv. {level}</span>
                  <span>{rep} rep</span>
                  <span>{trades} trades</span>
                </div>
              )
            })}
        </div>
      </>
    )}

      {hasDepthsleStats && (
        <>
          <h2>Depthsle</h2>
          <div className="stats-list selectable">
            {depthsleStats.map(s => <StatRow key={s.label} {...s} />)}
          </div>
          
        </>
      )}

    </div>
  )
}

export default Stats