import { Router } from 'express'
import { getDb, flush } from '../db.js'

const router = Router()

function rowToItem(r) {
  return {
    id: r[0], name: r[1], sku: r[2], category: r[3],
    quantity: r[4], minStock: r[5], price: r[6],
    brand: r[7], location: r[8], condition: r[9], createdAt: r[10],
  }
}

router.get('/', (req, res) => {
  const db = getDb()
  const rows = db.exec('SELECT * FROM items ORDER BY created_at DESC')
  const items = rows.length ? rows[0].values.map(rowToItem) : []
  res.json(items)
})

router.post('/', (req, res) => {
  const { id, name, sku, category, quantity, minStock, price, brand, location, condition, createdAt } = req.body
  const db = getDb()
  db.run('INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [id, name, sku, category, quantity, minStock, price, brand || '', location || '', condition || 'New', createdAt])
  flush()
  res.status(201).json({ id, name, sku, category, quantity, minStock, price, brand, location, condition, createdAt })
})

router.put('/:id', (req, res) => {
  const { name, sku, category, quantity, minStock, price, brand, location, condition } = req.body
  const db = getDb()
  const result = db.run(
    'UPDATE items SET name=?, sku=?, category=?, quantity=?, min_stock=?, price=?, brand=?, location=?, condition=? WHERE id=?',
    [name, sku, category, quantity, minStock, price, brand || '', location || '', condition || 'New', req.params.id]
  )
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' })
  flush()
  res.json({ message: 'Updated' })
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  const result = db.run('DELETE FROM items WHERE id=?', [req.params.id])
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' })
  flush()
  res.json({ message: 'Deleted' })
})

export default router
