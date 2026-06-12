import { Router } from 'express'
import { getDb, flush } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

function formatPO(row, items) {
  return {
    id: row[0], poNumber: row[1], supplierId: row[2], warehouseId: row[3],
    status: row[4], totalAmount: row[5], notes: row[6], createdBy: row[7],
    createdAt: row[8], receivedAt: row[9], items: items || [],
  }
}

router.get('/', (req, res) => {
  const db = getDb()
  const rows = db.exec('SELECT * FROM purchase_orders ORDER BY created_at DESC')
  const pos = rows.length ? rows[0].values.map(r => {
    const itemRows = db.exec('SELECT * FROM purchase_order_items WHERE po_id=?', [r[0]])
    const items = itemRows.length ? itemRows[0].values.map(i => ({
      id: i[0], poId: i[1], itemId: i[2], quantity: i[3], unitCost: i[4], receivedQuantity: i[5],
    })) : []
    return formatPO(r, items)
  }) : []
  res.json(pos)
})

router.get('/:id', (req, res) => {
  const db = getDb()
  const rows = db.exec('SELECT * FROM purchase_orders WHERE id=?', [req.params.id])
  if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'Not found' })
  const itemRows = db.exec('SELECT * FROM purchase_order_items WHERE po_id=?', [req.params.id])
  const items = itemRows.length ? itemRows[0].values.map(i => ({
    id: i[0], poId: i[1], itemId: i[2], quantity: i[3], unitCost: i[4], receivedQuantity: i[5],
  })) : []
  res.json(formatPO(rows[0].values[0], items))
})

router.post('/', (req, res) => {
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
  db.run('INSERT INTO purchase_orders VALUES (?,?,?,?,?,?,?,?,?,?)', [id, poNum, supplierId, warehouseId, 'pending', total, notes || '', req.user.id, now, null])
  poiItems.forEach(item => {
    const poiId = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
    db.run('INSERT INTO purchase_order_items VALUES (?,?,?,?,?,?)', [poiId, id, item.itemId, item.quantity, item.unitCost, 0])
  })
  flush()
  res.status(201).json({ id, poNumber: poNum, status: 'pending', totalAmount: total, createdAt: now })
})

router.patch('/:id/receive', (req, res) => {
  const db = getDb()
  const rows = db.exec('SELECT * FROM purchase_orders WHERE id=?', [req.params.id])
  if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'Not found' })
  const po = rows[0].values[0]
  const itemRows = db.exec('SELECT * FROM purchase_order_items WHERE po_id=?', [req.params.id])
  if (itemRows.length) {
    itemRows[0].values.forEach(item => {
      const qty = item[3]
      const itemId = item[2]
      const whId = po[3]
      // Update item master quantity
      db.run('UPDATE items SET quantity=quantity+?, updated_at=? WHERE id=?', [qty, new Date().toISOString(), itemId])
      // Update warehouse stock
      const iwRows = db.exec('SELECT id,quantity FROM item_warehouses WHERE item_id=? AND warehouse_id=?', [itemId, whId])
      if (iwRows.length && iwRows[0].values.length) {
        db.run('UPDATE item_warehouses SET quantity=quantity+? WHERE item_id=? AND warehouse_id=?', [qty, itemId, whId])
      } else {
        const iwId = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
        db.run('INSERT INTO item_warehouses VALUES (?,?,?,?)', [iwId, itemId, whId, qty])
      }
      // Update received quantity
      db.run('UPDATE purchase_order_items SET received_quantity=received_quantity+? WHERE id=?', [qty, item[0]])
      // Stock history
      const sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
      db.run('INSERT INTO stock_history VALUES (?,?,?,?,?,?,?)', [sid, itemId, qty, 0, qty, `PO received: ${po[1]}`, new Date().toISOString()])
    })
  }
  const now = new Date().toISOString()
  db.run('UPDATE purchase_orders SET status=?, received_at=? WHERE id=?', ['received', now, req.params.id])
  // Activity
  const aid = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
  db.run('INSERT INTO activity_log VALUES (?,?,?,?,?,?,?,?)', [aid, req.user.id, req.user.name, 'PO Received', 'purchase_order', req.params.id, `PO ${po[1]} received`, now])
  flush()
  res.json({ message: 'PO fully received' })
})

router.patch('/:id/cancel', (req, res) => {
  const db = getDb()
  db.run("UPDATE purchase_orders SET status='cancelled' WHERE id=?", [req.params.id])
  flush()
  res.json({ message: 'Cancelled' })
})

export default router
