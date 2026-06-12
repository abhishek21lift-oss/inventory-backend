import { Router } from 'express'
import { getDb, flush } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  const db = getDb()
  const rows = db.exec('SELECT * FROM warehouses ORDER BY name')
  const warehouses = rows.length ? rows[0].values.map(r => ({
    id: r[0], name: r[1], location: r[2], isActive: !!r[3], createdAt: r[4],
  })) : []
  res.json(warehouses)
})

router.post('/', (req, res) => {
  const { name, location } = req.body
  if (!name) return res.status(400).json({ error: 'Name required' })
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  const db = getDb()
  db.run('INSERT INTO warehouses VALUES (?,?,?,?,?)', [id, name, location || '', 1, now])
  flush()
  res.status(201).json({ id, name, location: location || '', isActive: true, createdAt: now })
})

router.put('/:id', (req, res) => {
  const { name, location, isActive } = req.body
  const db = getDb()
  db.run('UPDATE warehouses SET name=?, location=?, is_active=? WHERE id=?', [name, location || '', isActive ? 1 : 0, req.params.id])
  flush()
  res.json({ message: 'Updated' })
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  db.run('DELETE FROM item_warehouses WHERE warehouse_id=?', [req.params.id])
  db.run('DELETE FROM warehouses WHERE id=?', [req.params.id])
  flush()
  res.json({ message: 'Deleted' })
})

export default router
