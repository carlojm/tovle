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

const DEPTHSLE_LAUNCH_STR = '2026-08-28' // update to actual launch date TODO:
export const getDepthslePuzzleNumber = (dateStr = getEasternDateStr()) => {
  const toNoon = (dateStr) => new Date(`${dateStr}T12:00:00`)
  const msPerDay = 1000 * 60 * 60 * 24
  const diff = toNoon(dateStr) - toNoon(DEPTHSLE_LAUNCH_STR)
  return Math.max(1, Math.round(diff / msPerDay) + 1)
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

export const getSecondsUntilNextTradeWindow = () => {
  const nowET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  const d = new Date(nowET)
  const secondsIntoWindow = ((d.getHours() % 4) * 3600) + (d.getMinutes() * 60) + d.getSeconds()
  return (4 * 3600) - secondsIntoWindow
}


//same as backend getCurrentWindowIndex
//copied here instead of sharing for now because im crazy
export const getCurrentWindowIndex = () => {
  const nowET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  const d = new Date(nowET)

  //slice the day into 4 hour windows, trades reset every 4 hours
  const hoursSinceMidnight = d.getHours()
  const windowOfDay = Math.floor(hoursSinceMidnight / 4) // 0–5

  //combine the window and the date
  const dateStr = d.toLocaleDateString('en-CA') // "YYYY-MM-DD"
  const [y, m, day] = dateStr.split('-').map(Number)
  const dayIndex = y * 365 + m * 31 + day
  
  return dayIndex * 6 + windowOfDay // 6 windows per day
}