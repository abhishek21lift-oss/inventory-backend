import { Router } from 'express'
import { getDb } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

router.get('/', async (req, res) => {
  const db = getDb()
  const { rows } = await db.query('SELECT * FROM categories ORDER BY name')
  const cats = await Promise.all(rows.map(async (r) => {
    const { rows: countRows } = await db.query('SELECT COUNT(*)::int AS count FROM items WHERE category = $1', [r.name])
    return { id: r.id, name: r.name, items_count: countRows[0].count }
  }))
  res.json(cats)
})

router.post('/', async (req, res) => {
  const { id, name } = req.body
  const db = getDb()
  try {
    await db.query('INSERT INTO categories (id, name) VALUES ($1, $2)', [id, name])
    res.status(201).json({ id, name })
  } catch (err) {
    res.status(409).json({ error: 'Category already exists' })
  }
})

router.put('/:id', async (req, res) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ error: 'Name required' })
  const db = getDb()
  const { rows } = await db.query('SELECT name FROM categories WHERE id = $1', [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  const oldName = rows[0].name
  await db.query('UPDATE categories SET name = $1 WHERE id = $2', [name, req.params.id])
  await db.query('UPDATE items SET category = $1 WHERE category = $2', [name, oldName])
  res.json({ id: req.params.id, name })
})

router.delete('/:id', async (req, res) => {
  const db = getDb()
  const { rows } = await db.query('SELECT name FROM categories WHERE id = $1', [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  const catName = rows[0].name
  await db.query('UPDATE items SET category = $1 WHERE category = $2', ['Uncategorized', catName])
  await db.query('DELETE FROM categories WHERE id = $1', [req.params.id])
  res.json({ message: 'Deleted' })
})

export default router
