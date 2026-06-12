import { Router } from 'express'
import { getDb, flush } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

function rowToItem(r) {
  return {
    id: r[0], name: r[1], sku: r[2], category: r[3],
    quantity: r[4], minStock: r[5], price: r[6],
    brand: r[7], location: r[8], condition: r[9], createdAt: r[10], updatedAt: r[11],
  }
}

router.get('/', (req, res) => {
  const db = getDb()
  const { search, category, condition, warehouseId } = req.query
  let sql = 'SELECT * FROM items WHERE 1=1'
  const params = []
  if (search) {
    sql += ' AND (LOWER(name) LIKE ? OR LOWER(sku) LIKE ? OR LOWER(brand) LIKE ?)'
    const q = `%${search.toString().toLowerCase()}%`
    params.push(q, q, q)
  }
  if (category) { sql += ' AND category=?'; params.push(category.toString()) }
  if (condition) { sql += ' AND condition=?'; params.push(condition.toString()) }
  sql += ' ORDER BY updated_at DESC'
  const rows = db.exec(sql, params)
  let items = rows.length ? rows[0].values.map(rowToItem) : []

  // If filtering by warehouse, only include items with stock in that warehouse
  if (warehouseId) {
    items = items.filter(item => {
      const iw = db.exec('SELECT SUM(quantity) FROM item_warehouses WHERE item_id=? AND warehouse_id=?', [item.id, warehouseId])
      const whQty = iw.length && iw[0].values[0][0] ? iw[0].values[0][0] : 0
      item.warehouseStock = whQty
      return true
    })
  } else {
    // Include warehouse stock info for every item
    items = items.map(item => {
      const iw = db.exec('SELECT warehouse_id, quantity FROM item_warehouses WHERE item_id=?', [item.id])
      const warehouseStock = iw.length ? iw[0].values.reduce((acc, r) => {
        acc[r[0]] = r[1]
        return acc
      }, {}) : {}
      item.warehouseStock = warehouseStock
      return item
    })
  }

  res.json(items)
})

router.get('/:id', (req, res) => {
  const db = getDb()
  const rows = db.exec('SELECT * FROM items WHERE id=?', [req.params.id])
  if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'Not found' })
  const item = rowToItem(rows[0].values[0])
  const iw = db.exec('SELECT warehouse_id, quantity FROM item_warehouses WHERE item_id=?', [item.id])
  item.warehouseStock = iw.length ? iw[0].values.reduce((acc, r) => { acc[r[0]] = r[1]; return acc }, {}) : {}
  res.json(item)
})

router.post('/', (req, res) => {
  const { id, name, sku, category, quantity, minStock, price, brand, location, condition, createdAt } = req.body
  const now = new Date().toISOString()
  const db = getDb()
  db.run('INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, name, sku, category, quantity || 0, minStock || 1, price || 0, brand || '', location || '', condition || 'New', createdAt || now.slice(0, 10), now])
  // Link to default warehouse
  const whId = req.body.warehouseId || 'wh1'
  const iwId = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
  db.run('INSERT INTO item_warehouses VALUES (?,?,?,?)', [iwId, id, whId, quantity || 0])
  flush()
  res.status(201).json({ id, name, sku, category, quantity: quantity || 0, minStock: minStock || 1, price: price || 0, brand, location, condition, createdAt: createdAt || now.slice(0, 10), updatedAt: now })
})

router.put('/:id', (req, res) => {
  const { name, sku, category, quantity, minStock, price, brand, location, condition } = req.body
  const now = new Date().toISOString()
  const db = getDb()
  db.run(
    'UPDATE items SET name=?, sku=?, category=?, quantity=?, min_stock=?, price=?, brand=?, location=?, condition=?, updated_at=? WHERE id=?',
    [name, sku, category, quantity, minStock, price, brand || '', location || '', condition || 'New', now, req.params.id]
  )
  flush()
  res.json({ message: 'Updated', updatedAt: now })
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  db.run('DELETE FROM stock_history WHERE item_id=?', [req.params.id])
  db.run('DELETE FROM item_warehouses WHERE item_id=?', [req.params.id])
  db.run('DELETE FROM items WHERE id=?', [req.params.id])
  flush()
  res.json({ message: 'Deleted' })
})

router.patch('/:id/stock', (req, res) => {
  const { change, note, warehouseId } = req.body
  if (typeof change !== 'number' || change === 0) return res.status(400).json({ error: 'change must be a non-zero integer' })
  const db = getDb()
  const rows = db.exec('SELECT quantity FROM items WHERE id=?', [req.params.id])
  if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'Not found' })
  const currentQty = rows[0].values[0][0]
  const newQty = Math.max(0, currentQty + change)
  const now = new Date().toISOString()
  db.run('UPDATE items SET quantity=?, updated_at=? WHERE id=?', [newQty, now, req.params.id])
  const historyId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  db.run('INSERT INTO stock_history VALUES (?,?,?,?,?,?,?)',
    [historyId, req.params.id, change, currentQty, newQty, note || '', now])
  // Update warehouse stock if specified
  if (warehouseId) {
    const iw = db.exec('SELECT id,quantity FROM item_warehouses WHERE item_id=? AND warehouse_id=?', [req.params.id, warehouseId])
    if (iw.length && iw[0].values.length) {
      const whNew = Math.max(0, iw[0].values[0][1] + change)
      db.run('UPDATE item_warehouses SET quantity=? WHERE item_id=? AND warehouse_id=?', [whNew, req.params.id, warehouseId])
    } else {
      const iwId = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
      db.run('INSERT INTO item_warehouses VALUES (?,?,?,?)', [iwId, req.params.id, warehouseId, Math.max(0, change)])
    }
  }
  flush()
  res.json({ message: 'Stock updated', previousQty: currentQty, newQty, change, updatedAt: now })
})

router.post('/:id/duplicate', (req, res) => {
  const db = getDb()
  const rows = db.exec('SELECT * FROM items WHERE id=?', [req.params.id])
  if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'Not found' })
  const orig = rowToItem(rows[0].values[0])
  const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  db.run('INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [newId, orig.name + ' (copy)', orig.sku + '-C', orig.category, 0, orig.minStock, orig.price,
     orig.brand, orig.location, orig.condition, today, now])
  flush()
  const newItem = { ...orig, id: newId, name: orig.name + ' (copy)', sku: orig.sku + '-C', quantity: 0, createdAt: today, updatedAt: now }
  res.status(201).json(newItem)
})

router.get('/:id/history', (req, res) => {
  const db = getDb()
  const rows = db.exec('SELECT * FROM stock_history WHERE item_id=? ORDER BY created_at DESC LIMIT 50', [req.params.id])
  const history = rows.length ? rows[0].values.map(r => ({
    id: r[0], itemId: r[1], change: r[2], previousQty: r[3], newQty: r[4], note: r[5], createdAt: r[6],
  })) : []
  res.json(history)
})

router.get('/:id/warehouses', (req, res) => {
  const db = getDb()
  const rows = db.exec(`
    SELECT iw.warehouse_id, w.name, iw.quantity
    FROM item_warehouses iw
    JOIN warehouses w ON w.id = iw.warehouse_id
    WHERE iw.item_id=?
  `, [req.params.id])
  const stock = rows.length ? rows[0].values.map(r => ({ warehouseId: r[0], warehouseName: r[1], quantity: r[2] })) : []
  res.json(stock)
})

router.post('/:id/transfer', (req, res) => {
  const { fromWarehouseId, toWarehouseId, quantity } = req.body
  if (!fromWarehouseId || !toWarehouseId || !quantity || quantity <= 0) return res.status(400).json({ error: 'fromWarehouseId, toWarehouseId, and quantity required' })
  const db = getDb()
  const from = db.exec('SELECT id,quantity FROM item_warehouses WHERE item_id=? AND warehouse_id=?', [req.params.id, fromWarehouseId])
  if (!from.length || !from[0].values.length || from[0].values[0][1] < quantity) return res.status(400).json({ error: 'Insufficient stock in source warehouse' })
  db.run('UPDATE item_warehouses SET quantity=quantity-? WHERE item_id=? AND warehouse_id=?', [quantity, req.params.id, fromWarehouseId])
  const to = db.exec('SELECT id FROM item_warehouses WHERE item_id=? AND warehouse_id=?', [req.params.id, toWarehouseId])
  if (to.length && to[0].values.length) {
    db.run('UPDATE item_warehouses SET quantity=quantity+? WHERE item_id=? AND warehouse_id=?', [quantity, req.params.id, toWarehouseId])
  } else {
    const iwId = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
    db.run('INSERT INTO item_warehouses VALUES (?,?,?,?)', [iwId, req.params.id, toWarehouseId, quantity])
  }
  const now = new Date().toISOString()
  db.run('UPDATE items SET updated_at=? WHERE id=?', [now, req.params.id])
  const aid = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
  db.run('INSERT INTO activity_log VALUES (?,?,?,?,?,?,?,?)', [aid, req.user.id, req.user.name, 'Stock Transfer', 'items', req.params.id, `Transferred ${quantity} units from ${fromWarehouseId} to ${toWarehouseId}`, now])
  flush()
  res.json({ message: 'Stock transferred' })
})

export default router
