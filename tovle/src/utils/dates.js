const LAUNCH = { y: 2026, m: 4, d: 1 }

export const getEasternDateStr = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

const toDayNumber = ({ y, m, d }) => y * 365 + m * 31 + d

export const getPuzzleNumber = (dateStr = getEasternDateStr()) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return toDayNumber({ y, m, d }) - toDayNumber(LAUNCH) + 1
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

export const formatCountdown = (seconds) => {
  if (!seconds) return '--:--:--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}