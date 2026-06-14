import { Router } from 'express'
import { getDb } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

function fmtInv(row, items) {
  return {
    id: row.id, invoiceNumber: row.invoice_number, customerName: row.customer_name,
    customerEmail: row.customer_email, customerPhone: row.customer_phone, warehouseId: row.warehouse_id,
    status: row.status, subtotal: row.subtotal, tax: row.tax, total: row.total,
    notes: row.notes, createdBy: row.created_by, createdAt: row.created_at, items: items || [],
  }
}

router.get('/', async (req, res) => {
  const db = getDb()
  const { rows } = await db.query('SELECT * FROM invoices ORDER BY created_at DESC')
  const invoices = await Promise.all(rows.map(async (r) => {
    const { rows: iRows } = await db.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [r.id])
    const items = iRows.map(i => ({
      id: i.id, invoiceId: i.invoice_id, itemId: i.item_id, quantity: i.quantity, unitPrice: i.unit_price, subtotal: i.subtotal,
    }))
    return fmtInv(r, items)
  }))
  res.json(invoices)
})

router.get('/:id', async (req, res) => {
  const db = getDb()
  const { rows } = await db.query('SELECT * FROM invoices WHERE id = $1', [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  const { rows: iRows } = await db.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [req.params.id])
  const items = iRows.map(i => ({
    id: i.id, invoiceId: i.invoice_id, itemId: i.item_id, quantity: i.quantity, unitPrice: i.unit_price, subtotal: i.subtotal,
  }))
  res.json(fmtInv(rows[0], items))
})

router.post('/', async (req, res) => {
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
  await db.query('INSERT INTO invoices (id, invoice_number, customer_name, customer_email, customer_phone, warehouse_id, status, subtotal, tax, total, notes, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
    [id, invNum, customerName, customerEmail || '', customerPhone || '', warehouseId, 'draft', subtotal, taxVal, total, notes || '', req.user.id, now])
  for (const item of invItems) {
    const iiId = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
    await db.query('INSERT INTO invoice_items (id, invoice_id, item_id, quantity, unit_price, subtotal) VALUES ($1, $2, $3, $4, $5, $6)',
      [iiId, id, item.itemId, item.quantity, item.unitPrice, item.subtotal])
  }
  res.status(201).json({ id, invoiceNumber: invNum, status: 'draft', subtotal, tax: taxVal, total, createdAt: now })
})

router.put('/:id', async (req, res) => {
  const { customerName, customerEmail, customerPhone, warehouseId, items, notes, tax } = req.body
  const db = getDb()
  const { rows } = await db.query('SELECT * FROM invoices WHERE id = $1', [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft invoices can be edited' })
  if (customerName) await db.query('UPDATE invoices SET customer_name = $1 WHERE id = $2', [customerName, req.params.id])
  if (customerEmail !== undefined) await db.query('UPDATE invoices SET customer_email = $1 WHERE id = $2', [customerEmail, req.params.id])
  if (customerPhone !== undefined) await db.query('UPDATE invoices SET customer_phone = $1 WHERE id = $2', [customerPhone, req.params.id])
  if (warehouseId) await db.query('UPDATE invoices SET warehouse_id = $1 WHERE id = $2', [warehouseId, req.params.id])
  if (notes !== undefined) await db.query('UPDATE invoices SET notes = $1 WHERE id = $2', [notes, req.params.id])
  if (tax !== undefined) await db.query('UPDATE invoices SET tax = $1 WHERE id = $2', [tax, req.params.id])
  if (items && items.length) {
    await db.query('DELETE FROM invoice_items WHERE invoice_id = $1', [req.params.id])
    let subtotal = 0
    for (const item of items) {
      const sub = item.quantity * item.unitPrice
      subtotal += sub
      const iiId = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
      await db.query('INSERT INTO invoice_items (id, invoice_id, item_id, quantity, unit_price, subtotal) VALUES ($1, $2, $3, $4, $5, $6)',
        [iiId, req.params.id, item.itemId, item.quantity, item.unitPrice, sub])
    }
    const taxVal = tax || 0
    const total = subtotal + taxVal
    await db.query('UPDATE invoices SET subtotal = $1, total = $2 WHERE id = $3', [subtotal, total, req.params.id])
  }
  res.json({ message: 'Invoice updated' })
})

router.patch('/:id/confirm', async (req, res) => {
  const db = getDb()
  const { rows } = await db.query('SELECT * FROM invoices WHERE id = $1', [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  const inv = rows[0]
  const { rows: iRows } = await db.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [req.params.id])
  for (const item of iRows) {
    const qty = item.quantity
    const itemId = item.item_id
    const whId = inv.warehouse_id
    await db.query('UPDATE items SET quantity = quantity - $1, updated_at = $2 WHERE id = $3', [qty, new Date().toISOString(), itemId])
    await db.query('UPDATE item_warehouses SET quantity = quantity - $1 WHERE item_id = $2 AND warehouse_id = $3', [qty, itemId, whId])
    const sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
    await db.query('INSERT INTO stock_history (id, item_id, change, previous_qty, new_qty, note, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [sid, itemId, -qty, 0, qty, `Sale: ${inv.invoice_number}`, new Date().toISOString()])
  }
  const now = new Date().toISOString()
  await db.query('UPDATE invoices SET status = $1 WHERE id = $2', ['paid', req.params.id])
  const aid = Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
  await db.query('INSERT INTO activity_log (id, user_id, user_name, action, entity_type, entity_id, details, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [aid, req.user.id, req.user.name, 'Invoice Paid', 'invoice', req.params.id, `Invoice ${inv.invoice_number} confirmed & paid`, now])
  res.json({ message: 'Invoice confirmed & stock deducted' })
})

router.patch('/:id/cancel', async (req, res) => {
  const db = getDb()
  await db.query('UPDATE invoices SET status = $1 WHERE id = $2', ['cancelled', req.params.id])
  res.json({ message: 'Cancelled' })
})

export default router
