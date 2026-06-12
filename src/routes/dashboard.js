import { Router } from 'express'
import { getDb } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  const db = getDb()

  const itemRows = db.exec('SELECT COUNT(*) as c FROM items')
  const totalItems = itemRows.length ? itemRows[0].values[0][0] : 0

  const valRows = db.exec('SELECT SUM(quantity * price) FROM items')
  const totalValue = valRows.length && valRows[0].values[0][0] ? valRows[0].values[0][0] : 0

  const lowRows = db.exec("SELECT COUNT(*) FROM items WHERE quantity > 0 AND quantity <= min_stock")
  const lowStock = lowRows.length ? lowRows[0].values[0][0] : 0

  const outRows = db.exec("SELECT COUNT(*) FROM items WHERE quantity = 0")
  const outStock = outRows.length ? outRows[0].values[0][0] : 0

  const poRows = db.exec("SELECT COUNT(*) FROM purchase_orders WHERE status='pending'")
  const pendingPOs = poRows.length ? poRows[0].values[0][0] : 0

  const invRows = db.exec("SELECT COUNT(*) FROM invoices WHERE status='paid'")
  const paidInvoices = invRows.length ? invRows[0].values[0][0] : 0

  const whRows = db.exec("SELECT COUNT(*) FROM warehouses WHERE is_active=1")
  const activeWarehouses = whRows.length ? whRows[0].values[0][0] : 0

  const supRows = db.exec("SELECT COUNT(*) FROM suppliers WHERE is_active=1")
  const activeSuppliers = supRows.length ? supRows[0].values[0][0] : 0

  // Top low stock items
  const lsRows = db.exec("SELECT name, quantity, min_stock, sku FROM items WHERE quantity > 0 AND quantity <= min_stock ORDER BY quantity ASC LIMIT 10")
  const lowStockItems = lsRows.length ? lsRows[0].values.map(r => ({ name: r[0], quantity: r[1], minStock: r[2], sku: r[3] })) : []

  // Stock by category
  const catRows = db.exec("SELECT category, SUM(quantity) as total FROM items GROUP BY category ORDER BY total DESC")
  const stockByCategory = catRows.length ? catRows[0].values.map(r => ({ category: r[0], total: r[1] })) : []

  // Recent activity
  const actRows = db.exec("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 10")
  const recentActivity = actRows.length ? actRows[0].values.map(r => ({
    id: r[0], userName: r[2], action: r[3], entityType: r[4], details: r[6], createdAt: r[7],
  })) : []

  res.json({
    totalItems, totalValue, lowStock, outStock,
    pendingPOs, paidInvoices, activeWarehouses, activeSuppliers,
    lowStockItems, stockByCategory, recentActivity,
  })
})

export default router
