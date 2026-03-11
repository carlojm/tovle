require('dotenv').config()
const express = require('express')
const cors = require('cors')
const app = express()

const schedule = require('./data/schedule.json')

app.use(cors())
app.use(express.json())
app.use(express.static('dist'))


const getEasternDateString = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  // en-CA locale gives YYYY-MM-DD format
}

const getDailyFallback = (dateString, availableIds) => {
  // turn the date string into a number
  const seed = dateString.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  // return availableIds[seed % availableIds.length]
  return seed % 14 + 1
}

const getRandom = () => {
  return Math.floor(Math.random() * 14) + 1;
}

const getScheduledId = (dateString) => {
  const entry = schedule.find(item => item.date === dateString)
  if (!entry) return null
  if (entry.id === 'random') return getRandom()
  if (entry.id === 'fallback') return null
  return entry.id
}

app.get('/api/daily', (request, response) => {
  const today = getEasternDateString() // ex. "2026-03-01"
  const availableIds = schedule.map(t => t.id)

  const id = getScheduledId(today) ?? getDailyFallback(today, availableIds)

  if (!id) {
    return response.status(404).json({error: `No cache found for id ${id}`})
  }
  response.json(id)
})


const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})