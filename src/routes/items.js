import { Router } from 'express'
import { getDb, flush } from '../db.js'

const router = Router()

function rowToItem(r) {
  return {
    id: r[0], name: r[1], sku: r[2], category: r[3],
    quantity: r[4], minStock: r[5], price: r[6], createdAt: r[7],
  }
}

router.get('/', (req, res) => {
  const db = getDb()
  const rows = db.exec('SELECT * FROM items ORDER BY created_at DESC')
  const items = rows.length ? rows[0].values.map(rowToItem) : []
  res.json(items)
})

router.post('/', (req, res) => {
  const { id, name, sku, category, quantity, minStock, price, createdAt } = req.body
  const db = getDb()
  db.run('INSERT INTO items VALUES (?,?,?,?,?,?,?,?)', [id, name, sku, category, quantity, minStock, price, createdAt])
  flush()
  res.status(201).json({ id, name, sku, category, quantity, minStock, price, createdAt })
})

router.put('/:id', (req, res) => {
  const { name, sku, category, quantity, minStock, price } = req.body
  const db = getDb()
  const result = db.run(
    'UPDATE items SET name=?, sku=?, category=?, quantity=?, min_stock=?, price=? WHERE id=?',
    [name, sku, category, quantity, minStock, price, req.params.id]
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
