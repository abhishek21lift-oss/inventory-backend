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
    condition TEXT DEFAULT 'New', created_at TEXT NOT NULL)`)

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

  const itemRows = db.exec('SELECT COUNT(*) as c FROM items')
  if (!itemRows.length || itemRows[0].values[0][0] === 0) {
    const seed = db.prepare('INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    seed.run(['1','Treadmill','TR-001','Cardio',2,1,2499.99,'Life Fitness','Cardio Zone','Good','2026-01-15'])
    seed.run(['2','Dumbbell Set 5-50lbs','DB-001','Free Weights',8,3,899.99,'Bowflex','Free Weight Rack','New','2026-01-20'])
    seed.run(['3','Olympic Barbell','BB-001','Free Weights',6,2,299.99,'Rogue','Platform A','New','2026-02-01'])
    seed.run(['4','Squat Rack','SR-001','Strength',3,1,599.99,'Rogue','Strength Area','Good','2026-02-10'])
    seed.run(['5','Leg Press Machine','LP-001','Machines',2,1,3499.99,'Hammer Strength','Machine Row','Good','2026-03-01'])
    seed.run(['6','Yoga Mat','YM-001','Accessories',25,10,24.99,'Manduka','Studio','New','2026-03-05'])
    seed.run(['7','Resistance Bands Set','RB-001','Accessories',15,5,39.99,'TheraBand','Studio','New','2026-03-10'])
    seed.run(['8','Pre-Workout 5lb','PW-001','Supplements',12,5,49.99,'Optimum Nutrition','Supplement Bar','New','2026-04-01'])
    seed.run(['9','Gym Towel Pack','GT-001','Apparel',30,10,19.99,'Nike','Front Desk','New','2026-04-05'])
    seed.run(['10','Protein Powder 2lb','PP-001','Supplements',20,8,59.99,'Dymatize','Supplement Bar','New','2026-04-10'])
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
