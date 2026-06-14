import pg from 'pg'

const DATABASE_URL = 'postgresql://postgres.osnlullpwkahxjsjdrgz:5IqIvBByxzYgUe9X@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function verify() {
  const client = await pool.connect()
  try {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `)
    console.log('Tables created:')
    res.rows.forEach(r => console.log(`  - ${r.table_name}`))

    const idxRes = await client.query(`
      SELECT indexname FROM pg_indexes 
      WHERE schemaname = 'public' 
      ORDER BY indexname
    `)
    console.log('\nIndexes created:')
    idxRes.rows.forEach(r => console.log(`  - ${r.indexname}`))

    console.log('\nSchema verification complete.')
  } finally {
    client.release()
    await pool.end()
  }
}

verify()
