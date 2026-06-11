import express from 'express'
import cors from 'cors'
import { initDb } from './db.js'
import itemsRouter from './routes/items.js'
import categoriesRouter from './routes/categories.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/items', itemsRouter)
app.use('/api/categories', categoriesRouter)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Inventory API running on port ${PORT}`)
  })
})
