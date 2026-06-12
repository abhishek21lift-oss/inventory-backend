import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { getDb, flush } from '../db.js'
import { generateToken, authMiddleware } from '../middleware/auth.js'

const router = Router()

router.post('/login', (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  const db = getDb()
  const rows = db.exec('SELECT * FROM users WHERE email=?', [email])
  if (!rows.length || !rows[0].values.length) return res.status(401).json({ error: 'Invalid credentials' })
  const user = rows[0].values[0]
  if (!bcrypt.compareSync(password, user[2])) return res.status(401).json({ error: 'Invalid credentials' })
  const token = generateToken({ id: user[0], email: user[1], role: user[4], name: user[3] })
  res.json({ token, user: { id: user[0], email: user[1], name: user[4], role: user[3], avatar: user[5] } })
})

router.post('/register', (req, res) => {
  const { email, password, name, role } = req.body
  if (!email || !password || !name) return res.status(400).json({ error: 'Email, password, name required' })
  const db = getDb()
  const existing = db.exec('SELECT id FROM users WHERE email=?', [email])
  if (existing.length && existing[0].values.length) return res.status(409).json({ error: 'Email already exists' })
  const hash = bcrypt.hashSync(password, 10)
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  db.run('INSERT INTO users VALUES (?,?,?,?,?,?,?)', [id, email, hash, name, role || 'staff', '', now])
  flush()
  const token = generateToken({ id, email, role: role || 'staff', name })
  res.status(201).json({ token, user: { id, email, name, role: role || 'staff', avatar: '' } })
})

router.get('/me', authMiddleware, (req, res) => {
  const db = getDb()
  const rows = db.exec('SELECT * FROM users WHERE id=?', [req.user.id])
  if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'User not found' })
  const u = rows[0].values[0]
  res.json({ id: u[0], email: u[1], name: u[4], role: u[3], avatar: u[5] })
})

router.get('/users', authMiddleware, (req, res) => {
  const db = getDb()
  const rows = db.exec('SELECT id,email,name,role,avatar,created_at FROM users ORDER BY name')
  const users = rows.length ? rows[0].values.map(r => ({ id: r[0], email: r[1], name: r[2], role: r[3], avatar: r[4], createdAt: r[5] })) : []
  res.json(users)
})

export default router
