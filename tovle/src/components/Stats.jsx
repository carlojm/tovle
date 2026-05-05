import { usePlayer } from '../context/PlayerContext'
import './Stats.css'
import { TOWN_CONFIG } from '../data/townConfig'
import { getTownLevel } from '../utils/townUtils'

const DISTRIBUTION_BUCKETS = ['1', '2', '3', '4', '5', '6+']

const Stats = () => {
  const { playerData } = usePlayer()
  const stats = playerData?.stats

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

  //travel stats
  const towns = playerData?.travel?.towns ?? {}
  const axolotls = playerData?.axolotls ?? []
  const totalAxolotlLevels = axolotls.reduce((sum, a) => sum + a.level, 0)
  const tradesByTown = stats?.tradesByTown ?? {}

  return (
    <div className="stats-box">
      <h1>Your Stats</h1>
      
      {/* top stat tiles */}
      <div className="stats-list selectable">
        <div className="stats-list-row">
          <span>Day stats only update on day completion.</span>
        </div>
        <div className="stats-list-row">
          <span>Current Daily Streak</span>
          <span>{stats.currentStreak ?? 0}</span>
        </div>
        <div className="stats-list-row">
          <span>Best Daily Streak</span>
          <span>{stats.bestStreak ?? 0}</span>
        </div>
        <div className="stats-list-row">
          <span>Days Played</span>
          <span>{stats.totalDaysPlayed ?? 0}</span>
        </div>
        <div className="stats-list-row">
          <span>Caches Solved</span>
          <span>{stats.totalCachesSolved ?? 0}</span>
        </div>
        <div className="stats-list-row">
          <span>Average Guesses</span>
          <span>{stats.averageGuesses ?? 0}</span>
        </div>
        <div className="stats-list-row">
          <span>Caches Opened</span>
          <span>{stats.totalCachesOpened ?? 0}</span>
        </div>
        <div className="stats-list-row">
          <span>Items Looted</span>
          <span>{stats.totalItemsCollected ?? 0}</span>
        </div>
        <div className="stats-list-row">
          <span>Total Axolotl Levels</span>
          <span>{totalAxolotlLevels}</span>
        </div>
      </div>

      {/* guess distribution */}
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
                <div
                  className="stats-bar-fill"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className="stats-bar-percent">{percent}%</span>
            </div>
          )
        })}
      </div>

      {/* travel stats */}
      <h2>Travel Stats</h2>
      <div className="stats-list selectable">
        <div className="stats-list-row">
          <span>Total Trades Executed</span>
          <span>{stats.totalTradesExecuted ?? 0}</span>
        </div>
        <div className="stats-list-row">
          <span>Shipments Opened</span>
          <span>{stats.totalShipmentsOpened ?? 0}</span>
        </div>
        <div className="stats-list-row">
          <span>Best Tower Height</span>
          <span>{stats.bestTowerHeight ?? 0}</span>
        </div>
      </div>


      <h2>Towns</h2>
      <div className="stats-list selectable">
        {Object.entries(TOWN_CONFIG).map(([townId, config]) => {
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



    </div>
  )
}

export default Stats