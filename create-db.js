const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({path: path.join(__dirname, '.env')});

async function createSchoolDB() {
  try {
    // Connect to postgres default DB
    const adminPool = new Pool({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: process.env.DB_PASSWORD, // hammad1007
      database: 'postgres',
      ssl: false
    });

    console.log('🔨 Creating school_db if missing...');
    await adminPool.query('CREATE DATABASE school_db;');
    console.log('✅ school_db created');
    
    await adminPool.end();
  } catch (err) {
    if (err.code === '42P04') {
      console.log('ℹ️ school_db already exists');
    } else {
      console.error('❌ Create DB error:', err.message);
    }
  }
}

createSchoolDB().then(() => process.exit(0));
