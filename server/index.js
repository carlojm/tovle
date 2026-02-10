require('dotenv').config()
const express = require('express')
// const cors = require('cors')
const app = express()
const tovs = require('./data/tovs.json')
// app.use(cors())
app.use(express.json())
// app.use(express.static('dist'))



app.get('/', (request, response) => {
  response.send('<h1>Hello World!</h1>')
})

app.get('/tovs', (request, response) => {
  response.json(tovs)
})

app.get('/tovs/random', (request, response) => {
  const random = tovs[Math.floor(Math.random() * tovs.length)]
  response.json(random)
})

app.get('/tovs/daily', (request, response) => {
  const daily = tovs[0]
  response.json(daily)
})

const PORT = process.env.PORT
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})