import { Router } from 'express'
import { getDb, flush } from '../db.js'

const router = Router()

router.get('/', (req, res) => {
  const db = getDb()
  const rows = db.exec('SELECT * FROM categories ORDER BY name')
  const cats = rows.length ? rows[0].values.map(r => {
    const countRows = db.exec('SELECT COUNT(*) FROM items WHERE category=?', [r[1]])
    const count = countRows.length ? countRows[0].values[0][0] : 0
    return { id: r[0], name: r[1], items_count: count }
  }) : []
  res.json(cats)
})

router.post('/', (req, res) => {
  const { id, name } = req.body
  const db = getDb()
  try {
    db.run('INSERT INTO categories VALUES (?,?)', [id, name])
    flush()
    res.status(201).json({ id, name })
  } catch (err) {
    res.status(409).json({ error: 'Category already exists' })
  }
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  const cat = db.exec('SELECT name FROM categories WHERE id=?', [req.params.id])
  if (!cat.length || !cat[0].values.length) return res.status(404).json({ error: 'Not found' })
  const catName = cat[0].values[0][0]
  db.run('UPDATE items SET category=? WHERE category=?', ['Uncategorized', catName])
  db.run('DELETE FROM categories WHERE id=?', [req.params.id])
  flush()
  res.json({ message: 'Deleted' })
})

export default router
