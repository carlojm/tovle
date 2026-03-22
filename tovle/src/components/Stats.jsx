import { usePlayer } from '../context/PlayerContext'
import './Stats.css'

const DISTRIBUTION_BUCKETS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10+']

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

  const distribution = stats.guessDistribution ?? {}
  const totalSolved = stats.totalCachesSolved ?? 0
  const maxCount = Math.max(...DISTRIBUTION_BUCKETS.map(b => distribution[b] ?? 0), 1)

  return (
    <div className="stats-box">
      <h1>Your Stats</h1>
      
      {/* top stat tiles */}
      <div className="stats-list">
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
    </div>
  )
}

export default Stats