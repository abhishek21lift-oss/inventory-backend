import { Router } from 'express'
import { getDb } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

router.get('/', async (req, res) => {
  const db = getDb()
  const limit = Math.min(parseInt(req.query.limit) || 100, 500)
  const { rows } = await db.query('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT $1', [limit])
  const logs = rows.map(r => ({
    id: r.id, userId: r.user_id, userName: r.user_name, action: r.action,
    entityType: r.entity_type, entityId: r.entity_id, details: r.details, createdAt: r.created_at,
  }))
  res.json(logs)
})

export default router
