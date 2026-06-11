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
    created_at TEXT NOT NULL)`)

  const catRows = db.exec('SELECT COUNT(*) as c FROM categories')
  if (!catRows.length || catRows[0].values[0][0] === 0) {
    db.run("INSERT INTO categories VALUES ('1','Electronics')")
    db.run("INSERT INTO categories VALUES ('2','Furniture')")
    db.run("INSERT INTO categories VALUES ('3','Stationery')")
  }

  const itemRows = db.exec('SELECT COUNT(*) as c FROM items')
  if (!itemRows.length || itemRows[0].values[0][0] === 0) {
    const seed = db.prepare('INSERT INTO items VALUES (?,?,?,?,?,?,?,?)')
    seed.run(['1','Wireless Mouse','WM-001','Electronics',42,10,29.99,'2026-01-15'])
    seed.run(['2','Mechanical Keyboard','MK-002','Electronics',18,5,89.99,'2026-01-20'])
    seed.run(['3','Office Chair','OC-003','Furniture',7,3,299.99,'2026-02-01'])
    seed.run(['4','Standing Desk','SD-004','Furniture',3,2,499.99,'2026-02-10'])
    seed.run(['5','USB-C Hub','UH-005','Electronics',55,15,34.99,'2026-03-01'])
    seed.run(['6','Notebook (Pack of 5)','NB-006','Stationery',120,20,12.99,'2026-03-05'])
    seed.run(['7','Monitor 27" 4K','MN-007','Electronics',4,3,449.99,'2026-03-10'])
    seed.free()
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
  fs.writeFileSync(dbPath, Buffer.from(db.export()))
}
