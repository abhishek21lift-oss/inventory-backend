import { Router } from 'express'
import { getDb, flush } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  const db = getDb()
  const rows = db.exec('SELECT * FROM suppliers ORDER BY name')
  const suppliers = rows.length ? rows[0].values.map(r => ({
    id: r[0], name: r[1], contactPerson: r[2], email: r[3], phone: r[4],
    address: r[5], isActive: !!r[6], createdAt: r[7],
  })) : []
  res.json(suppliers)
})

router.post('/', (req, res) => {
  const { name, contactPerson, email, phone, address } = req.body
  if (!name) return res.status(400).json({ error: 'Name required' })
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  const db = getDb()
  db.run('INSERT INTO suppliers VALUES (?,?,?,?,?,?,?,?)', [id, name, contactPerson || '', email || '', phone || '', address || '', 1, now])
  flush()
  res.status(201).json({ id, name, contactPerson: contactPerson || '', email: email || '', phone: phone || '', address: address || '', isActive: true, createdAt: now })
})

router.put('/:id', (req, res) => {
  const { name, contactPerson, email, phone, address, isActive } = req.body
  const db = getDb()
  db.run('UPDATE suppliers SET name=?, contact_person=?, email=?, phone=?, address=?, is_active=? WHERE id=?',
    [name, contactPerson || '', email || '', phone || '', address || '', isActive ? 1 : 0, req.params.id])
  flush()
  res.json({ message: 'Updated' })
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  db.run('DELETE FROM suppliers WHERE id=?', [req.params.id])
  flush()
  res.json({ message: 'Deleted' })
})

export default router
