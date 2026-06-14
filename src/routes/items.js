import { Router } from 'express'
import { getDb } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { getPagination, paginatedResponse } from '../utils/pagination.js'

const router = Router()
router.use(authMiddleware)

function rowToItem(r) {
  return {
    id: r.id, name: r.name, sku: r.sku, category: r.category,
    quantity: r.quantity, minStock: r.min_stock, price: r.price,
    brand: r.brand, location: r.location, condition: r.condition,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

router.get('/', async (req, res) => {
  const db = getDb()
  const { search, category, condition, warehouseId } = req.query
  const { page, limit, offset } = getPagination(req)

  const conditions = []
  const params = []
  let p = 1

  if (search) {
    const q = `%${search.toString().toLowerCase()}%`
    conditions.push(` AND (LOWER(name) LIKE $${p} OR LOWER(sku) LIKE $${p + 1} OR LOWER(brand) LIKE $${p + 2})`)
    params.push(q, q, q)
    p += 3
  }
  if (category) {
    conditions.push(` AND category=$${p}`)
    params.push(category.toString())
    p++
  }
  if (condition) {
    conditions.push(` AND condition=$${p}`)
    params.push(condition.toString())
    p++
  }

  const where = conditions.join('')

  const countResult = await db.query(`SELECT COUNT(*)::int AS count FROM items WHERE 1=1${where}`, params)
  const total = countResult.rows[0].count

  const result = await db.query(
    `SELECT * FROM items WHERE 1=1${where} ORDER BY updated_at DESC LIMIT $${p} OFFSET $${p + 1}`,
    [...params, limit, offset]
  )
  let items = result.rows.map(rowToItem)

  if (warehouseId) {
    const filtered = []
    for (const item of items) {
      const iw = await db.query(
        'SELECT COALESCE(SUM(quantity),0)::int AS qty FROM item_warehouses WHERE item_id=$1 AND warehouse_id=$2',
        [item.id, warehouseId]
      )
      const whQty = iw.rows[0].qty
      item.warehouseStock = { [warehouseId.toString()]: whQty }
      if (whQty > 0) filtered.push(item)
    }
    items = filtered
  } else {
    for (const item of items) {
      const iw = await db.query(
        'SELECT warehouse_id, quantity FROM item_warehouses WHERE item_id=$1',
        [item.id]
      )
      item.warehouseStock = iw.rows.reduce((acc, r) => {
        acc[r.warehouse_id] = r.quantity
        return acc
      }, {})
    }
  }

  res.json(paginatedResponse(items, total, page, limit))
})

router.get('/:id', async (req, res) => {
  const db = getDb()
  const result = await db.query('SELECT * FROM items WHERE id=$1', [req.params.id])
  if (!result.rows.length) return res.status(404).json({ error: 'Not found' })
  const item = rowToItem(result.rows[0])
  const iw = await db.query(
    'SELECT warehouse_id, quantity FROM item_warehouses WHERE item_id=$1',
    [item.id]
  )
  item.warehouseStock = iw.rows.reduce((acc, r) => {
    acc[r.warehouse_id] = r.quantity
    return acc
  }, {})
  res.json(item)
})

router.post('/', async (req, res) => {
  const { id, name, sku, category, quantity, minStock, price, brand, location, condition, createdAt, warehouseId } = req.body
  if (!warehouseId) return res.status(400).json({ error: 'warehouseId is required' })
  const db = getDb()
  const whResult = await db.query('SELECT id FROM warehouses WHERE id=$1', [warehouseId])
  if (!whResult.rows.length) return res.status(400).json({ error: 'Warehouse not found' })
  const now = new Date().toISOString()
  await db.query(
    'INSERT INTO items (id, name, sku, category, quantity, min_stock, price, brand, location, condition, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
    [id, name, sku, category, quantity || 0, minStock || 1, price || 0, brand || '', location || '', condition || 'New', createdAt || now.slice(0, 10), now]
  )
  const iwId = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
  await db.query(
    'INSERT INTO item_warehouses (id, item_id, warehouse_id, quantity) VALUES ($1,$2,$3,$4)',
    [iwId, id, warehouseId, quantity || 0]
  )
  res.status(201).json({
    id, name, sku, category, quantity: quantity || 0, minStock: minStock || 1, price: price || 0,
    brand, location, condition, createdAt: createdAt || now.slice(0, 10), updatedAt: now,
  })
})

router.put('/:id', async (req, res) => {
  const { name, sku, category, quantity, minStock, price, brand, location, condition } = req.body
  const now = new Date().toISOString()
  const db = getDb()
  await db.query(
    'UPDATE items SET name=$1, sku=$2, category=$3, quantity=$4, min_stock=$5, price=$6, brand=$7, location=$8, condition=$9, updated_at=$10 WHERE id=$11',
    [name, sku, category, quantity, minStock, price, brand || '', location || '', condition || 'New', now, req.params.id]
  )
  res.json({ message: 'Updated', updatedAt: now })
})

router.delete('/:id', async (req, res) => {
  const db = getDb()
  await db.query('DELETE FROM stock_history WHERE item_id=$1', [req.params.id])
  await db.query('DELETE FROM item_warehouses WHERE item_id=$1', [req.params.id])
  await db.query('DELETE FROM items WHERE id=$1', [req.params.id])
  res.json({ message: 'Deleted' })
})

router.patch('/:id/stock', async (req, res) => {
  const { change, note, warehouseId } = req.body
  if (typeof change !== 'number' || change === 0) return res.status(400).json({ error: 'change must be a non-zero integer' })
  const db = getDb()
  const result = await db.query('SELECT quantity FROM items WHERE id=$1', [req.params.id])
  if (!result.rows.length) return res.status(404).json({ error: 'Not found' })
  const currentQty = result.rows[0].quantity
  const newQty = Math.max(0, currentQty + change)
  const now = new Date().toISOString()
  await db.query('UPDATE items SET quantity=$1, updated_at=$2 WHERE id=$3', [newQty, now, req.params.id])
  const historyId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  await db.query(
    'INSERT INTO stock_history (id, item_id, change, previous_qty, new_qty, note, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [historyId, req.params.id, change, currentQty, newQty, note || '', now]
  )
  if (warehouseId) {
    const iw = await db.query(
      'SELECT id, quantity FROM item_warehouses WHERE item_id=$1 AND warehouse_id=$2',
      [req.params.id, warehouseId]
    )
    if (iw.rows.length) {
      const whNew = Math.max(0, iw.rows[0].quantity + change)
      await db.query(
        'UPDATE item_warehouses SET quantity=$1 WHERE item_id=$2 AND warehouse_id=$3',
        [whNew, req.params.id, warehouseId]
      )
    } else {
      const iwId = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
      await db.query(
        'INSERT INTO item_warehouses (id, item_id, warehouse_id, quantity) VALUES ($1,$2,$3,$4)',
        [iwId, req.params.id, warehouseId, Math.max(0, change)]
      )
    }
  }
  res.json({ message: 'Stock updated', previousQty: currentQty, newQty, change, updatedAt: now })
})

router.post('/:id/duplicate', async (req, res) => {
  const db = getDb()
  const result = await db.query('SELECT * FROM items WHERE id=$1', [req.params.id])
  if (!result.rows.length) return res.status(404).json({ error: 'Not found' })
  const orig = rowToItem(result.rows[0])
  const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  await db.query(
    'INSERT INTO items (id, name, sku, category, quantity, min_stock, price, brand, location, condition, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
    [newId, orig.name + ' (copy)', orig.sku + '-C', orig.category, 0, orig.minStock, orig.price, orig.brand, orig.location, orig.condition, today, now]
  )
  const newItem = {
    ...orig, id: newId, name: orig.name + ' (copy)', sku: orig.sku + '-C',
    quantity: 0, createdAt: today, updatedAt: now,
  }
  res.status(201).json(newItem)
})

router.get('/:id/history', async (req, res) => {
  const db = getDb()
  const { from, to, page: pageQ, limit: limitQ } = req.query
  const page = Math.max(1, parseInt(pageQ) || 1)
  const lmt = Math.min(Math.max(1, parseInt(limitQ) || 50), 500)
  const offset = (page - 1) * lmt

  const conditions = ['item_id=$1']
  const params = [req.params.id]
  let p = 2
  if (from) {
    conditions.push(`created_at >= $${p}`)
    params.push(from.toString())
    p++
  }
  if (to) {
    conditions.push(`created_at <= $${p}`)
    params.push(to.toString())
    p++
  }

  const where = conditions.join(' AND ')

  const countResult = await db.query(`SELECT COUNT(*)::int AS count FROM stock_history WHERE ${where}`, params)
  const total = countResult.rows[0].count

  const result = await db.query(
    `SELECT * FROM stock_history WHERE ${where} ORDER BY created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
    [...params, lmt, offset]
  )
  const history = result.rows.map(r => ({
    id: r.id, itemId: r.item_id, change: r.change,
    previousQty: r.previous_qty, newQty: r.new_qty, note: r.note, createdAt: r.created_at,
  }))
  res.json({ data: history, total, page, limit: lmt, totalPages: Math.ceil(total / lmt) })
})

router.get('/:id/warehouses', async (req, res) => {
  const db = getDb()
  const result = await db.query(`
    SELECT iw.warehouse_id, w.name, iw.quantity
    FROM item_warehouses iw
    JOIN warehouses w ON w.id = iw.warehouse_id
    WHERE iw.item_id=$1
  `, [req.params.id])
  const stock = result.rows.map(r => ({ warehouseId: r.warehouse_id, warehouseName: r.name, quantity: r.quantity }))
  res.json(stock)
})

router.post('/:id/transfer', async (req, res) => {
  const { fromWarehouseId, toWarehouseId, quantity } = req.body
  if (!fromWarehouseId || !toWarehouseId || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'fromWarehouseId, toWarehouseId, and quantity required' })
  }
  const db = getDb()
  const from = await db.query(
    'SELECT id, quantity FROM item_warehouses WHERE item_id=$1 AND warehouse_id=$2',
    [req.params.id, fromWarehouseId]
  )
  if (!from.rows.length || from.rows[0].quantity < quantity) {
    return res.status(400).json({ error: 'Insufficient stock in source warehouse' })
  }
  await db.query(
    'UPDATE item_warehouses SET quantity=quantity-$1 WHERE item_id=$2 AND warehouse_id=$3',
    [quantity, req.params.id, fromWarehouseId]
  )
  const to = await db.query(
    'SELECT id FROM item_warehouses WHERE item_id=$1 AND warehouse_id=$2',
    [req.params.id, toWarehouseId]
  )
  if (to.rows.length) {
    await db.query(
      'UPDATE item_warehouses SET quantity=quantity+$1 WHERE item_id=$2 AND warehouse_id=$3',
      [quantity, req.params.id, toWarehouseId]
    )
  } else {
    const iwId = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
    await db.query(
      'INSERT INTO item_warehouses (id, item_id, warehouse_id, quantity) VALUES ($1,$2,$3,$4)',
      [iwId, req.params.id, toWarehouseId, quantity]
    )
  }
  const now = new Date().toISOString()
  await db.query('UPDATE items SET updated_at=$1 WHERE id=$2', [now, req.params.id])
  const aid = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
  await db.query(
    'INSERT INTO activity_log (id, user_id, user_name, action, entity_type, entity_id, details, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [aid, req.user.id, req.user.name, 'Stock Transfer', 'items', req.params.id, `Transferred ${quantity} units from ${fromWarehouseId} to ${toWarehouseId}`, now]
  )
  res.json({ message: 'Stock transferred' })
})

export default router
