import { Router } from 'express'
import { getDb } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

function formatPO(row, items) {
  return {
    id: row.id, poNumber: row.po_number, supplierId: row.supplier_id, warehouseId: row.warehouse_id,
    status: row.status, totalAmount: row.total_amount, notes: row.notes, createdBy: row.created_by,
    createdAt: row.created_at, receivedAt: row.received_at, items: items || [],
  }
}

router.get('/', async (req, res) => {
  const db = getDb()
  const { rows } = await db.query('SELECT * FROM purchase_orders ORDER BY created_at DESC')
  const pos = await Promise.all(rows.map(async (r) => {
    const { rows: itemRows } = await db.query('SELECT * FROM purchase_order_items WHERE po_id = $1', [r.id])
    const items = itemRows.map(i => ({
      id: i.id, poId: i.po_id, itemId: i.item_id, quantity: i.quantity, unitCost: i.unit_cost, receivedQuantity: i.received_quantity,
    }))
    return formatPO(r, items)
  }))
  res.json(pos)
})

router.get('/:id', async (req, res) => {
  const db = getDb()
  const { rows } = await db.query('SELECT * FROM purchase_orders WHERE id = $1', [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  const { rows: itemRows } = await db.query('SELECT * FROM purchase_order_items WHERE po_id = $1', [req.params.id])
  const items = itemRows.map(i => ({
    id: i.id, poId: i.po_id, itemId: i.item_id, quantity: i.quantity, unitCost: i.unit_cost, receivedQuantity: i.received_quantity,
  }))
  res.json(formatPO(rows[0], items))
})

router.post('/', async (req, res) => {
  const { supplierId, warehouseId, items, notes } = req.body
  if (!supplierId || !warehouseId || !items || !items.length) return res.status(400).json({ error: 'Supplier, warehouse, and items required' })
  const db = getDb()
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  const poNum = 'PO-' + now.slice(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 1000)
  let total = 0
  const poiItems = items.map(item => {
    const sub = item.quantity * item.unitCost
    total += sub
    return { ...item, subtotal: sub }
  })
  await db.query('INSERT INTO purchase_orders (id, po_number, supplier_id, warehouse_id, status, total_amount, notes, created_by, created_at, received_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [id, poNum, supplierId, warehouseId, 'pending', total, notes || '', req.user.id, now, null])
  for (const item of poiItems) {
    const poiId = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
    await db.query('INSERT INTO purchase_order_items (id, po_id, item_id, quantity, unit_cost, received_quantity) VALUES ($1, $2, $3, $4, $5, $6)',
      [poiId, id, item.itemId, item.quantity, item.unitCost, 0])
  }
  res.status(201).json({ id, poNumber: poNum, status: 'pending', totalAmount: total, createdAt: now })
})

router.put('/:id', async (req, res) => {
  const { supplierId, warehouseId, items, notes } = req.body
  const db = getDb()
  const { rows } = await db.query('SELECT * FROM purchase_orders WHERE id = $1', [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  if (rows[0].status !== 'pending') return res.status(400).json({ error: 'Only pending POs can be edited' })
  if (supplierId) await db.query('UPDATE purchase_orders SET supplier_id = $1 WHERE id = $2', [supplierId, req.params.id])
  if (warehouseId) await db.query('UPDATE purchase_orders SET warehouse_id = $1 WHERE id = $2', [warehouseId, req.params.id])
  if (notes !== undefined) await db.query('UPDATE purchase_orders SET notes = $1 WHERE id = $2', [notes, req.params.id])
  if (items && items.length) {
    await db.query('DELETE FROM purchase_order_items WHERE po_id = $1', [req.params.id])
    let total = 0
    for (const item of items) {
      const sub = item.quantity * item.unitCost
      total += sub
      const poiId = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
      await db.query('INSERT INTO purchase_order_items (id, po_id, item_id, quantity, unit_cost, received_quantity) VALUES ($1, $2, $3, $4, $5, $6)',
        [poiId, req.params.id, item.itemId, item.quantity, item.unitCost, 0])
    }
    await db.query('UPDATE purchase_orders SET total_amount = $1 WHERE id = $2', [total, req.params.id])
  }
  res.json({ message: 'PO updated' })
})

router.patch('/:id/receive', async (req, res) => {
  const db = getDb()
  const { rows } = await db.query('SELECT * FROM purchase_orders WHERE id = $1', [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  const po = rows[0]
  const { rows: itemRows } = await db.query('SELECT * FROM purchase_order_items WHERE po_id = $1', [req.params.id])
  for (const item of itemRows) {
    const qty = item.quantity
    const itemId = item.item_id
    const whId = po.warehouse_id
    await db.query('UPDATE items SET quantity = quantity + $1, updated_at = $2 WHERE id = $3', [qty, new Date().toISOString(), itemId])
    const { rows: iwRows } = await db.query('SELECT id, quantity FROM item_warehouses WHERE item_id = $1 AND warehouse_id = $2', [itemId, whId])
    if (iwRows.length) {
      await db.query('UPDATE item_warehouses SET quantity = quantity + $1 WHERE item_id = $2 AND warehouse_id = $3', [qty, itemId, whId])
    } else {
      const iwId = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
      await db.query('INSERT INTO item_warehouses (id, item_id, warehouse_id, quantity) VALUES ($1, $2, $3, $4)', [iwId, itemId, whId, qty])
    }
    await db.query('UPDATE purchase_order_items SET received_quantity = received_quantity + $1 WHERE id = $2', [qty, item.id])
    const sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
    await db.query('INSERT INTO stock_history (id, item_id, change, previous_qty, new_qty, note, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [sid, itemId, qty, 0, qty, `PO received: ${po.po_number}`, new Date().toISOString()])
  }
  const now = new Date().toISOString()
  await db.query('UPDATE purchase_orders SET status = $1, received_at = $2 WHERE id = $3', ['received', now, req.params.id])
  const aid = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
  await db.query('INSERT INTO activity_log (id, user_id, user_name, action, entity_type, entity_id, details, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [aid, req.user.id, req.user.name, 'PO Received', 'purchase_order', req.params.id, `PO ${po.po_number} received`, now])
  res.json({ message: 'PO fully received' })
})

router.patch('/:id/cancel', async (req, res) => {
  const db = getDb()
  await db.query("UPDATE purchase_orders SET status = 'cancelled' WHERE id = $1", [req.params.id])
  res.json({ message: 'Cancelled' })
})

export default router
