// config/supabase.js - Supabase Database Configuration
// Prefer using `config/db.js` unless you specifically need Supabase-only env vars.
const { Pool } = require('pg');

function parseBool(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
    return null;
}

function getSslConfig() {
    const explicit = parseBool(process.env.DB_SSL);
    if (explicit === false) return false;
    return { rejectUnauthorized: false };
}

const supabaseConfig = {
    host: process.env.SUPABASE_HOST || 'db.wkezgixefbywotgutoao.supabase.co',
    port: Number.parseInt(process.env.SUPABASE_PORT || '5432', 10),
    database: process.env.SUPABASE_DB || 'postgres',
    user: process.env.SUPABASE_USER || 'postgres',
    password: process.env.SUPABASE_PASSWORD || '',
    ssl: getSslConfig()
};

const pool = (typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.trim())
    ? new Pool({ connectionString: process.env.DATABASE_URL.trim(), ssl: getSslConfig() })
    : new Pool(supabaseConfig);

if (parseBool(process.env.DB_SKIP_CONNECT_TEST) !== true) {
    pool.connect()
        .then((client) => {
            console.log('✅ Supabase PostgreSQL connected');
            client.release();
        })
        .catch((err) => {
            console.error('❌ Supabase PostgreSQL connection failed:', err && err.message ? err.message : err);
        });
}

module.exports = pool;
