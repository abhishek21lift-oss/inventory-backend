import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { getDb } from '../db.js'
import { generateToken, authMiddleware } from '../middleware/auth.js'

const router = Router()

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  const db = getDb()
  const { rows } = await db.query('SELECT * FROM users WHERE email=$1', [email])
  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' })
  const user = rows[0]
  if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' })
  const token = generateToken({ id: user.id, email: user.email, role: user.role, name: user.name })
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar } })
})

router.post('/register', async (req, res) => {
  const { email, password, name, role } = req.body
  if (!email || !password || !name) return res.status(400).json({ error: 'Email, password, name required' })
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })
  const db = getDb()
  const { rows: existing } = await db.query('SELECT id FROM users WHERE email=$1', [email])
  if (existing.length) return res.status(409).json({ error: 'Email already exists' })
  const hash = bcrypt.hashSync(password, 10)
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  await db.query('INSERT INTO users (id, email, password, name, role, avatar, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [id, email, hash, name, role || 'staff', '', now])
  const token = generateToken({ id, email, role: role || 'staff', name })
  res.status(201).json({ token, user: { id, email, name, role: role || 'staff', avatar: '' } })
})

router.get('/me', authMiddleware, async (req, res) => {
  const db = getDb()
  const { rows } = await db.query('SELECT * FROM users WHERE id=$1', [req.user.id])
  if (!rows.length) return res.status(404).json({ error: 'User not found' })
  const u = rows[0]
  res.json({ id: u.id, email: u.email, name: u.name, role: u.role, avatar: u.avatar })
})

router.get('/users', authMiddleware, async (req, res) => {
  const db = getDb()
  const { rows } = await db.query('SELECT id, email, name, role, avatar, created_at FROM users ORDER BY name')
  res.json(rows.map(r => ({ id: r.id, email: r.email, name: r.name, role: r.role, avatar: r.avatar, createdAt: r.created_at })))
})

router.put('/users/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const { name, role, email } = req.body
  const db = getDb()
  const { rows: existing } = await db.query('SELECT id FROM users WHERE id=$1', [req.params.id])
  if (!existing.length) return res.status(404).json({ error: 'User not found' })
  if (name) await db.query('UPDATE users SET name=$1 WHERE id=$2', [name, req.params.id])
  if (role) await db.query('UPDATE users SET role=$1 WHERE id=$2', [role, req.params.id])
  if (email) await db.query('UPDATE users SET email=$1 WHERE id=$2', [email, req.params.id])
  res.json({ message: 'User updated' })
})

router.delete('/users/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  if (req.user.id === req.params.id) return res.status(400).json({ error: 'Cannot delete yourself' })
  const db = getDb()
  const { rows: existing } = await db.query('SELECT id FROM users WHERE id=$1', [req.params.id])
  if (!existing.length) return res.status(404).json({ error: 'User not found' })
  await db.query('DELETE FROM users WHERE id=$1', [req.params.id])
  res.json({ message: 'User deleted' })
})

export default router
