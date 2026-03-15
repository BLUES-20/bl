const path = require('path');
require('dotenv').config({path: path.join(__dirname, '.env')});
const db = require('./config/db');

async function diagnoseDB() {
  try {
    console.log('🔍 === Database Diagnosis ===');
    
    // Test connection
    const client = await db.connect();
    console.log('✅ Connected to:', db.__meta?.source || 'unknown');

    // List all tables
    const tablesRes = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('\\n📋 Tables:');
    tablesRes.rows.forEach(row => console.log(`  - ${row.table_name}`));

    // Key table row counts
    const keyTables = ['users', 'students', 'staff', 'results', 'contact_messages', 'announcements', 'documents', 'sessions'];
    for (const table of keyTables) {
      try {
        const count = await db.query(`SELECT COUNT(*) as cnt FROM ${table}`);
        console.log(`📊 ${table}: ${count.rows[0].cnt} rows`);
      } catch (e) {
        console.log(`📊 ${table}: ❌ missing`);
      }
    }

    // Check enums/types
    const typesRes = await db.query("SELECT t.typname FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname IN ('user_role', 'gender_type') GROUP BY t.typname");
    console.log('\\n🔤 Enums:');
    typesRes.rows.forEach(row => console.log(`  - ${row.typname}`));

    // Admin user
    const adminRes = await db.query("SELECT id, username, role FROM users WHERE username='admin' OR role='admin' LIMIT 1");
    console.log('\\n👨‍💼 Admin:', adminRes.rows.length > 0 ? adminRes.rows[0] : '❌ none');

    client.release();
    console.log('\\n🎉 Diagnosis complete!');
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.code) console.error('Code:', err.code);
  } finally {
    await db.end();
  }
}

diagnoseDB();
