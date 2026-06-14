import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '..', 'data.db')

let db

export async function initDb() {
  const SQL = await initSqlJs()

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  db.run('PRAGMA foreign_keys = ON')

  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE)`)

  db.run(`CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, sku TEXT NOT NULL,
    category TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 5, price REAL NOT NULL DEFAULT 0,
    brand TEXT DEFAULT '', location TEXT DEFAULT '',
    condition TEXT DEFAULT 'New', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`)

  db.run(`CREATE TABLE IF NOT EXISTS stock_history (
    id TEXT PRIMARY KEY, item_id TEXT NOT NULL,
    change INTEGER NOT NULL, previous_qty INTEGER NOT NULL,
    new_qty INTEGER NOT NULL, note TEXT DEFAULT '',
    created_at TEXT NOT NULL)`)

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, name TEXT NOT NULL,
    role TEXT DEFAULT 'staff', avatar TEXT DEFAULT '',
    created_at TEXT NOT NULL)`)

  db.run(`CREATE TABLE IF NOT EXISTS warehouses (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    location TEXT DEFAULT '', is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL)`)

  db.run(`CREATE TABLE IF NOT EXISTS item_warehouses (
    id TEXT PRIMARY KEY, item_id TEXT NOT NULL,
    warehouse_id TEXT NOT NULL, quantity INTEGER DEFAULT 0)`)

  db.run(`CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    contact_person TEXT DEFAULT '', email TEXT DEFAULT '',
    phone TEXT DEFAULT '', address TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1, created_at TEXT NOT NULL)`)

  db.run(`CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY, po_number TEXT NOT NULL,
    supplier_id TEXT, warehouse_id TEXT,
    status TEXT DEFAULT 'pending',
    total_amount REAL DEFAULT 0, notes TEXT DEFAULT '',
    created_by TEXT, created_at TEXT NOT NULL,
    received_at TEXT)`)

  db.run(`CREATE TABLE IF NOT EXISTS purchase_order_items (
    id TEXT PRIMARY KEY, po_id TEXT NOT NULL,
    item_id TEXT NOT NULL, quantity INTEGER NOT NULL,
    unit_cost REAL DEFAULT 0, received_quantity INTEGER DEFAULT 0)`)

  db.run(`CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY, invoice_number TEXT NOT NULL,
    customer_name TEXT DEFAULT '', customer_email TEXT DEFAULT '',
    customer_phone TEXT DEFAULT '', warehouse_id TEXT,
    status TEXT DEFAULT 'draft',
    subtotal REAL DEFAULT 0, tax REAL DEFAULT 0,
    total REAL DEFAULT 0, notes TEXT DEFAULT '',
    created_by TEXT, created_at TEXT NOT NULL)`)

  db.run(`CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL,
    item_id TEXT NOT NULL, quantity INTEGER NOT NULL,
    unit_price REAL DEFAULT 0, subtotal REAL DEFAULT 0)`)

  db.run(`CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY, user_id TEXT DEFAULT '',
    user_name TEXT DEFAULT '', action TEXT NOT NULL,
    entity_type TEXT DEFAULT '', entity_id TEXT DEFAULT '',
    details TEXT DEFAULT '', created_at TEXT NOT NULL)`)

  const userRows = db.exec('SELECT COUNT(*) as c FROM users')
  if (!userRows.length || userRows[0].values[0][0] === 0) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@inventory.com'
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
    const adminName = process.env.ADMIN_NAME || 'Admin User'
    const bcrypt = await import('bcryptjs')
    const hash = bcrypt.hashSync(adminPassword, 10)
    db.run('INSERT INTO users VALUES (?,?,?,?,?,?,?)', [
      Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      adminEmail, hash, adminName, 'admin', '', new Date().toISOString()
    ])
  }

  flush()
  return db
}

export function getDb() {
  if (!db) throw new Error('DB not initialized. Call initDb() first.')
  return db
}

export function flush() {
  if (!db) return
  try {
    fs.writeFileSync(dbPath, Buffer.from(db.export()))
  } catch (err) {
    console.error('Failed to persist database:', err)
  }
}
