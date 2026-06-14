import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.osnlullpwkahxjsjdrgz:5IqIvBByxzYgUe9X@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function migrate() {
  console.log('Connecting to PostgreSQL...')
  const client = await pool.connect()
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'supabase-schema.sql'), 'utf-8')
    console.log('Running migration...')
    await client.query(sql)
    console.log('Migration complete.')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
