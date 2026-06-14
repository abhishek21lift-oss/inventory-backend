import { Router } from 'express'
import { getDb } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

router.get('/', async (req, res) => {
  const db = getDb()
  const { rows } = await db.query('SELECT * FROM suppliers ORDER BY name')
  const suppliers = rows.map(r => ({
    id: r.id, name: r.name, contactPerson: r.contact_person, email: r.email, phone: r.phone,
    address: r.address, isActive: r.is_active, createdAt: r.created_at,
  }))
  res.json(suppliers)
})

router.post('/', async (req, res) => {
  const { name, contactPerson, email, phone, address } = req.body
  if (!name) return res.status(400).json({ error: 'Name required' })
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  const db = getDb()
  await db.query('INSERT INTO suppliers (id, name, contact_person, email, phone, address, is_active, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [id, name, contactPerson || '', email || '', phone || '', address || '', true, now])
  res.status(201).json({ id, name, contactPerson: contactPerson || '', email: email || '', phone: phone || '', address: address || '', isActive: true, createdAt: now })
})

router.put('/:id', async (req, res) => {
  const { name, contactPerson, email, phone, address, isActive } = req.body
  const db = getDb()
  await db.query('UPDATE suppliers SET name = $1, contact_person = $2, email = $3, phone = $4, address = $5, is_active = $6 WHERE id = $7',
    [name, contactPerson || '', email || '', phone || '', address || '', isActive, req.params.id])
  res.json({ message: 'Updated' })
})

router.delete('/:id', async (req, res) => {
  const db = getDb()
  await db.query('DELETE FROM suppliers WHERE id = $1', [req.params.id])
  res.json({ message: 'Deleted' })
})

export default router
