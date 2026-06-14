import { Router } from 'express'
import { getDb } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

router.get('/', async (req, res) => {
  const db = getDb()

  const { rows: itemRows } = await db.query('SELECT COUNT(*) AS count FROM items')
  const totalItems = parseInt(itemRows[0].count)

  const { rows: valRows } = await db.query('SELECT SUM(quantity * price) AS sum FROM items')
  const totalValue = parseFloat(valRows[0].sum) || 0

  const { rows: lowRows } = await db.query("SELECT COUNT(*) AS count FROM items WHERE quantity > 0 AND quantity <= min_stock")
  const lowStock = parseInt(lowRows[0].count)

  const { rows: outRows } = await db.query("SELECT COUNT(*) AS count FROM items WHERE quantity = 0")
  const outStock = parseInt(outRows[0].count)

  const { rows: poRows } = await db.query("SELECT COUNT(*) AS count FROM purchase_orders WHERE status = 'pending'")
  const pendingPOs = parseInt(poRows[0].count)

  const { rows: invRows } = await db.query("SELECT COUNT(*) AS count FROM invoices WHERE status = 'paid'")
  const paidInvoices = parseInt(invRows[0].count)

  const { rows: whRows } = await db.query("SELECT COUNT(*) AS count FROM warehouses WHERE is_active = true")
  const activeWarehouses = parseInt(whRows[0].count)

  const { rows: supRows } = await db.query("SELECT COUNT(*) AS count FROM suppliers WHERE is_active = true")
  const activeSuppliers = parseInt(supRows[0].count)

  const { rows: lsRows } = await db.query("SELECT name, quantity, min_stock, sku FROM items WHERE quantity > 0 AND quantity <= min_stock ORDER BY quantity ASC LIMIT 10")
  const lowStockItems = lsRows.map(r => ({ name: r.name, quantity: r.quantity, minStock: r.min_stock, sku: r.sku }))

  const { rows: catRows } = await db.query("SELECT category, SUM(quantity) AS total FROM items GROUP BY category ORDER BY total DESC")
  const stockByCategory = catRows.map(r => ({ category: r.category, total: parseFloat(r.total) || 0 }))

  const { rows: actRows } = await db.query("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 10")
  const recentActivity = actRows.map(r => ({
    id: r.id, userName: r.user_name, action: r.action, entityType: r.entity_type, details: r.details, createdAt: r.created_at,
  }))

  res.json({
    totalItems, totalValue, lowStock, outStock,
    pendingPOs, paidInvoices, activeWarehouses, activeSuppliers,
    lowStockItems, stockByCategory, recentActivity,
  })
})

export default router
