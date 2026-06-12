import { Router } from 'express'
import { getDb } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  const db = getDb()
  const limit = Math.min(parseInt(req.query.limit) || 100, 500)
  const rows = db.exec('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?', [limit])
  const logs = rows.length ? rows[0].values.map(r => ({
    id: r[0], userId: r[1], userName: r[2], action: r[3],
    entityType: r[4], entityId: r[5], details: r[6], createdAt: r[7],
  })) : []
  res.json(logs)
})

export default router
