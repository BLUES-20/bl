// config/db.js
const { Pool } = require('pg');

// Use DATABASE_URL for production (Render), fallback to local config
const pool = process.env.DATABASE_URL 
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'Hammad@1007',
      database: process.env.DB_NAME || 'school_management',
      port: process.env.DB_PORT || 5432,
    });

pool.connect()
  .then(client => {
    console.log('✅ PostgreSQL Connected');
    client.release();
  })
  .catch(err => {
    console.error('❌ PostgreSQL connection failed:', err);
  });

module.exports = pool;
