import express from 'express'
import cors from 'cors'
import { initDb } from './db.js'
import itemsRouter from './routes/items.js'
import categoriesRouter from './routes/categories.js'
import authRouter from './routes/auth.js'
import warehousesRouter from './routes/warehouses.js'
import suppliersRouter from './routes/suppliers.js'
import purchaseOrdersRouter from './routes/purchase-orders.js'
import invoicesRouter from './routes/invoices.js'
import activitiesRouter from './routes/activities.js'
import dashboardRouter from './routes/dashboard.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRouter)
app.use('/api/items', itemsRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/warehouses', warehousesRouter)
app.use('/api/suppliers', suppliersRouter)
app.use('/api/purchase-orders', purchaseOrdersRouter)
app.use('/api/invoices', invoicesRouter)
app.use('/api/activities', activitiesRouter)
app.use('/api/dashboard', dashboardRouter)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Inventory API running on port ${PORT}`)
  })
})
