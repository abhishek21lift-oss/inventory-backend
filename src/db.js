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

  // --- Existing tables ---
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

  // --- New tables ---
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

  // --- Seed data ---
  const catRows = db.exec('SELECT COUNT(*) as c FROM categories')
  if (!catRows.length || catRows[0].values[0][0] === 0) {
    db.run("INSERT INTO categories VALUES ('1','Cardio')")
    db.run("INSERT INTO categories VALUES ('2','Strength')")
    db.run("INSERT INTO categories VALUES ('3','Free Weights')")
    db.run("INSERT INTO categories VALUES ('4','Machines')")
    db.run("INSERT INTO categories VALUES ('5','Accessories')")
    db.run("INSERT INTO categories VALUES ('6','Supplements')")
    db.run("INSERT INTO categories VALUES ('7','Apparel')")
  }

  const userRows = db.exec('SELECT COUNT(*) as c FROM users')
  if (!userRows.length || userRows[0].values[0][0] === 0) {
    const bcrypt = await import('bcryptjs')
    const hash = bcrypt.hashSync('admin123', 10)
    db.run("INSERT INTO users VALUES ('admin','admin@inventory.com',?, 'Admin User','admin','','2026-01-01')", [hash])
  }

  const whRows = db.exec('SELECT COUNT(*) as c FROM warehouses')
  if (!whRows.length || whRows[0].values[0][0] === 0) {
    db.run("INSERT INTO warehouses VALUES ('wh1','Main Warehouse','Downtown',1,'2026-01-01')")
    db.run("INSERT INTO warehouses VALUES ('wh2','Secondary Storage','East Side',1,'2026-01-01')")
  }

  const itemRows = db.exec('SELECT COUNT(*) as c FROM items')
  if (!itemRows.length || itemRows[0].values[0][0] === 0) {
    const seed = db.prepare('INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    const now = new Date().toISOString()
    seed.run(['1','Treadmill','TR-001','Cardio',2,1,2499.99,'Life Fitness','Cardio Zone','Good','2026-01-15',now])
    seed.run(['2','Dumbbell Set 5-50lbs','DB-001','Free Weights',8,3,899.99,'Bowflex','Free Weight Rack','New','2026-01-20',now])
    seed.run(['3','Olympic Barbell','BB-001','Free Weights',6,2,299.99,'Rogue','Platform A','New','2026-02-01',now])
    seed.run(['4','Squat Rack','SR-001','Strength',3,1,599.99,'Rogue','Strength Area','Good','2026-02-10',now])
    seed.run(['5','Leg Press Machine','LP-001','Machines',2,1,3499.99,'Hammer Strength','Machine Row','Good','2026-03-01',now])
    seed.run(['6','Yoga Mat','YM-001','Accessories',25,10,24.99,'Manduka','Studio','New','2026-03-05',now])
    seed.run(['7','Resistance Bands Set','RB-001','Accessories',15,5,39.99,'TheraBand','Studio','New','2026-03-10',now])
    seed.run(['8','Pre-Workout 5lb','PW-001','Supplements',12,5,49.99,'Optimum Nutrition','Supplement Bar','New','2026-04-01',now])
    seed.run(['9','Gym Towel Pack','GT-001','Apparel',30,10,19.99,'Nike','Front Desk','New','2026-04-05',now])
    seed.run(['10','Protein Powder 2lb','PP-001','Supplements',20,8,59.99,'Dymatize','Supplement Bar','New','2026-04-10',now])
    seed.free()

    // Link items to main warehouse
    db.run("INSERT INTO item_warehouses VALUES ('iw1','1','wh1',2)")
    db.run("INSERT INTO item_warehouses VALUES ('iw2','2','wh1',8)")
    db.run("INSERT INTO item_warehouses VALUES ('iw3','3','wh1',6)")
    db.run("INSERT INTO item_warehouses VALUES ('iw4','4','wh1',3)")
    db.run("INSERT INTO item_warehouses VALUES ('iw5','5','wh1',2)")
    db.run("INSERT INTO item_warehouses VALUES ('iw6','6','wh1',25)")
    db.run("INSERT INTO item_warehouses VALUES ('iw7','7','wh1',15)")
    db.run("INSERT INTO item_warehouses VALUES ('iw8','8','wh1',12)")
    db.run("INSERT INTO item_warehouses VALUES ('iw9','9','wh1',30)")
    db.run("INSERT INTO item_warehouses VALUES ('iw10','10','wh1',20)")
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
  try { fs.writeFileSync(dbPath, Buffer.from(db.export())) } catch {}
}
