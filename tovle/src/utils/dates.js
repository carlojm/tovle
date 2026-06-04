const LAUNCH = { y: 2026, m: 4, d: 1 }
const LAUNCH_STR = '2026-04-01'

export const getEasternDateStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

// const toDayNumber = ({ y, m, d }) => y * 365 + m * 31 + d

export const getPuzzleNumber = (dateStr = getEasternDateStr()) => {
  const toNoon = (dateStr) => new Date(`${dateStr}T12:00:00`)
  const msPerDay = 1000 * 60 * 60 * 24
  const diff = toNoon(dateStr) - toNoon(LAUNCH_STR)
  return Math.round(diff / msPerDay) + 1
}

export const getDisplayDate = (dateStr = getEasternDateStr()) =>
  new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { timeZone: 'America/New_York' })


export const getMsUntilMidnightEastern = () => {
  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const [y, m, d] = todayStr.split('-').map(Number)

  // build tomorrow's date string
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1))
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  // midnight eastern timestamp
  const midnightEastern = new Date(`${tomorrowStr}T00:00:00`)
  const nowEastern = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  return midnightEastern - nowEastern
}

export const formatDuration = (ms) => {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}