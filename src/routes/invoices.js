import { Router } from 'express'
import { getDb, flush } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

function fmtInv(row, items) {
  return {
    id: row[0], invoiceNumber: row[1], customerName: row[2],
    customerEmail: row[3], customerPhone: row[4], warehouseId: row[5],
    status: row[6], subtotal: row[7], tax: row[8], total: row[9],
    notes: row[10], createdBy: row[11], createdAt: row[12], items: items || [],
  }
}

router.get('/', (req, res) => {
  const db = getDb()
  const rows = db.exec('SELECT * FROM invoices ORDER BY created_at DESC')
  const invoices = rows.length ? rows[0].values.map(r => {
    const iRows = db.exec('SELECT * FROM invoice_items WHERE invoice_id=?', [r[0]])
    const items = iRows.length ? iRows[0].values.map(i => ({
      id: i[0], invoiceId: i[1], itemId: i[2], quantity: i[3], unitPrice: i[4], subtotal: i[5],
    })) : []
    return fmtInv(r, items)
  }) : []
  res.json(invoices)
})

router.get('/:id', (req, res) => {
  const db = getDb()
  const rows = db.exec('SELECT * FROM invoices WHERE id=?', [req.params.id])
  if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'Not found' })
  const iRows = db.exec('SELECT * FROM invoice_items WHERE invoice_id=?', [req.params.id])
  const items = iRows.length ? iRows[0].values.map(i => ({
    id: i[0], invoiceId: i[1], itemId: i[2], quantity: i[3], unitPrice: i[4], subtotal: i[5],
  })) : []
  res.json(fmtInv(rows[0].values[0], items))
})

router.post('/', (req, res) => {
  const { customerName, customerEmail, customerPhone, warehouseId, items, notes, tax } = req.body
  if (!customerName || !warehouseId || !items || !items.length) return res.status(400).json({ error: 'Customer, warehouse, and items required' })
  const db = getDb()
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  const invNum = 'INV-' + now.slice(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 1000)
  let subtotal = 0
  const invItems = items.map(item => {
    const sub = item.quantity * item.unitPrice
    subtotal += sub
    return { ...item, subtotal: sub }
  })
  const taxVal = tax || 0
  const total = subtotal + taxVal
  db.run('INSERT INTO invoices VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, invNum, customerName, customerEmail || '', customerPhone || '', warehouseId, 'draft', subtotal, taxVal, total, notes || '', req.user.id, now])
  invItems.forEach(item => {
    const iiId = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
    db.run('INSERT INTO invoice_items VALUES (?,?,?,?,?,?)', [iiId, id, item.itemId, item.quantity, item.unitPrice, item.subtotal])
  })
  flush()
  res.status(201).json({ id, invoiceNumber: invNum, status: 'draft', subtotal, tax: taxVal, total, createdAt: now })
})

router.patch('/:id/confirm', (req, res) => {
  const db = getDb()
  const rows = db.exec('SELECT * FROM invoices WHERE id=?', [req.params.id])
  if (!rows.length || !rows[0].values.length) return res.status(404).json({ error: 'Not found' })
  const inv = rows[0].values[0]
  const iRows = db.exec('SELECT * FROM invoice_items WHERE invoice_id=?', [req.params.id])
  if (iRows.length) {
    iRows[0].values.forEach(item => {
      const qty = item[3]
      const itemId = item[2]
      const whId = inv[5]
      // Deduct from item master
      db.run('UPDATE items SET quantity=quantity-?, updated_at=? WHERE id=?', [qty, new Date().toISOString(), itemId])
      // Deduct from warehouse stock
      db.run('UPDATE item_warehouses SET quantity=quantity-? WHERE item_id=? AND warehouse_id=?', [qty, itemId, whId])
      // Stock history
      const sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
      db.run('INSERT INTO stock_history VALUES (?,?,?,?,?,?,?)', [sid, itemId, -qty, 0, qty, `Sale: ${inv[1]}`, new Date().toISOString()])
    })
  }
  const now = new Date().toISOString()
  db.run("UPDATE invoices SET status=? WHERE id=?", ['paid', req.params.id])
  const aid = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
  db.run('INSERT INTO activity_log VALUES (?,?,?,?,?,?,?,?)', [aid, req.user.id, req.user.name, 'Invoice Paid', 'invoice', req.params.id, `Invoice ${inv[1]} confirmed & paid`, now])
  flush()
  res.json({ message: 'Invoice confirmed & stock deducted' })
})

router.patch('/:id/cancel', (req, res) => {
  const db = getDb()
  db.run("UPDATE invoices SET status=? WHERE id=?", ['cancelled', req.params.id])
  flush()
  res.json({ message: 'Cancelled' })
})

export default router
