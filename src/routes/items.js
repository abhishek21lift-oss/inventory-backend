import { Router } from 'express'
import { getDb, flush } from '../db.js'

const router = Router()

function rowToItem(r) {
  return {
    id: r[0], name: r[1], sku: r[2], category: r[3],
    quantity: r[4], minStock: r[5], price: r[6],
    brand: r[7], location: r[8], condition: r[9], createdAt: r[10], updatedAt: r[11],
  }
}

router.get('/', (req, res) => {
  const db = getDb()
  const { search, category, condition } = req.query
  let sql = 'SELECT * FROM items WHERE 1=1'
  const params = []
  if (search) {
    sql += ' AND (LOWER(name) LIKE ? OR LOWER(sku) LIKE ? OR LOWER(brand) LIKE ?)'
    const q = `%${search.toString().toLowerCase()}%`
    params.push(q, q, q)
  }
  if (category) {
    sql += ' AND category=?'
    params.push(category.toString())
  }
  if (condition) {
    sql += ' AND condition=?'
    params.push(condition.toString())
  }
  sql += ' ORDER BY updated_at DESC'
  const rows = db.exec(sql, params)
  const items = rows.length ? rows[0].values.map(rowToItem) : []
  res.json(items)
})

router.get('/:id', (req, res) => {
  const db = getDb()
  const rows = db.exec('SELECT * FROM items WHERE id=?', [req.params.id])
  if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'Not found' })
  res.json(rowToItem(rows[0].values[0]))
})

router.post('/', (req, res) => {
  const { id, name, sku, category, quantity, minStock, price, brand, location, condition, createdAt } = req.body
  const now = new Date().toISOString()
  const db = getDb()
  db.run('INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, name, sku, category, quantity, minStock, price, brand || '', location || '', condition || 'New', createdAt, now])
  flush()
  res.status(201).json({ id, name, sku, category, quantity, minStock, price, brand, location, condition, createdAt, updatedAt: now })
})

router.put('/:id', (req, res) => {
  const { name, sku, category, quantity, minStock, price, brand, location, condition } = req.body
  const now = new Date().toISOString()
  const db = getDb()
  const result = db.run(
    'UPDATE items SET name=?, sku=?, category=?, quantity=?, min_stock=?, price=?, brand=?, location=?, condition=?, updated_at=? WHERE id=?',
    [name, sku, category, quantity, minStock, price, brand || '', location || '', condition || 'New', now, req.params.id]
  )
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' })
  flush()
  res.json({ message: 'Updated', updatedAt: now })
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  db.run('DELETE FROM stock_history WHERE item_id=?', [req.params.id])
  const result = db.run('DELETE FROM items WHERE id=?', [req.params.id])
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' })
  flush()
  res.json({ message: 'Deleted' })
})

router.patch('/:id/stock', (req, res) => {
  const { change, note } = req.body
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

export default router
