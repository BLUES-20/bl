const { Pool } = require('pg');
require('dotenv').config({path: './.env'});

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'school_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  });

  try {
    console.log('Running passport column migration...');
    await pool.query("ALTER TABLE students ADD COLUMN IF NOT EXISTS passport VARCHAR(50);");
    const check = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'passport';");
    console.log('✅ Migration complete. Passport column exists:', check.rows.length > 0);
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    await pool.end();
  }
}

runMigration();
