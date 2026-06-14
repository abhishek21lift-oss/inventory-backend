import { Router } from 'express'
import { getDb } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

router.get('/', async (req, res) => {
  const db = getDb()
  const { rows } = await db.query('SELECT * FROM warehouses ORDER BY name')
  const warehouses = rows.map(r => ({
    id: r.id, name: r.name, location: r.location, isActive: r.is_active, createdAt: r.created_at,
  }))
  res.json(warehouses)
})

router.post('/', async (req, res) => {
  const { name, location } = req.body
  if (!name) return res.status(400).json({ error: 'Name required' })
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  const db = getDb()
  await db.query('INSERT INTO warehouses (id, name, location, is_active, created_at) VALUES ($1, $2, $3, $4, $5)',
    [id, name, location || '', true, now])
  res.status(201).json({ id, name, location: location || '', isActive: true, createdAt: now })
})

router.put('/:id', async (req, res) => {
  const { name, location, isActive } = req.body
  const db = getDb()
  await db.query('UPDATE warehouses SET name = $1, location = $2, is_active = $3 WHERE id = $4',
    [name, location || '', isActive, req.params.id])
  res.json({ message: 'Updated' })
})

router.delete('/:id', async (req, res) => {
  const db = getDb()
  await db.query('DELETE FROM item_warehouses WHERE warehouse_id = $1', [req.params.id])
  await db.query('DELETE FROM warehouses WHERE id = $1', [req.params.id])
  res.json({ message: 'Deleted' })
})

export default router
