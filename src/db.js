import pg from 'pg'
import bcrypt from 'bcryptjs'

const DATABASE_URL = process.env.DATABASE_URL
let pool

export async function initDb() {
  if (!DATABASE_URL) {
    throw new Error(
      'DATABASE_URL environment variable is required. ' +
      'Set it to your PostgreSQL connection string. ' +
      'Example: postgresql://user:pass@host:6543/postgres'
    )
  }

  pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
  })

  const client = await pool.connect()
  try {
    await client.query('SELECT 1')
    console.log('Connected to PostgreSQL')
  } finally {
    client.release()
  }

  const { rows } = await pool.query("SELECT COUNT(*)::int as c FROM users")
  if (rows[0].c === 0) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@inventory.com'
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
    const adminName = process.env.ADMIN_NAME || 'Admin User'
    const hash = bcrypt.hashSync(adminPassword, 10)
    await pool.query(
      'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4)',
      [adminEmail, hash, adminName, 'admin']
    )
    console.log('Admin user seeded')
  }

  return pool
}

export function getDb() {
  if (!pool) throw new Error('DB not initialized. Call initDb() first.')
  return pool
}
