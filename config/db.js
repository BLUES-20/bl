// config/db.js - PostgreSQL connection (Render/Supabase/local)
const { Pool } = require('pg');

function parseBool(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
    return null;
}

function isLocalHost(host) {
    if (typeof host !== 'string') return false;
    const normalized = host.trim().toLowerCase();
    return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function getSslConfig({ host, connectionString }) {
    const explicit = parseBool(process.env.DB_SSL);
    if (explicit === false) return false;
    if (explicit === true) return { rejectUnauthorized: false };

    const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
    const inProduction = nodeEnv === 'production';

    const inferredHost = host || (typeof connectionString === 'string' ? connectionString : '');
    if (isLocalHost(inferredHost)) return false;

    // Most managed Postgres providers require TLS in production.
    return inProduction ? { rejectUnauthorized: false } : false;
}

function createPool() {
    const connectionString =
        typeof process.env.DATABASE_URL === 'string' ? process.env.DATABASE_URL.trim() : '';

    if (connectionString) {
        const pool = new Pool({
            connectionString,
            ssl: getSslConfig({ connectionString })
        });
        pool.__meta = { source: 'DATABASE_URL' };
        return pool;
    }

    const host = process.env.DB_HOST || 'localhost';
    const port = Number.parseInt(process.env.DB_PORT || '5432', 10);
    const database = process.env.DB_NAME || 'school_management';
    const user = process.env.DB_USER || 'postgres';
    const password = process.env.DB_PASSWORD || '';

    const effectivePort = Number.isFinite(port) ? port : 5432;
    const pool = new Pool({
        host,
        port: effectivePort,
        database,
        user,
        password,
        ssl: getSslConfig({ host })
    });

    pool.__meta = { source: 'DB_*', host, port: effectivePort, database, user };
    return pool;
}

const pool = createPool();

// Optional connection test on startup (disable with DB_SKIP_CONNECT_TEST=1)
if (parseBool(process.env.DB_SKIP_CONNECT_TEST) !== true) {
    pool.connect()
        .then((client) => {
            const hostLabel = pool.options && pool.options.host ? pool.options.host : 'database';
            console.log(`PostgreSQL connected (${hostLabel})`);
            client.release();
        })
        .catch((err) => {
            const meta = pool.__meta || {};
            const details =
                meta.source === 'DB_*'
                    ? ` (source=DB_* host=${meta.host} db=${meta.database} user=${meta.user})`
                    : meta.source
                        ? ` (source=${meta.source})`
                        : '';

            console.error(
                `PostgreSQL connection failed${details}:`,
                err && err.message ? err.message : err
            );

            if (meta.source === 'DB_*' && meta.host === 'localhost') {
                console.error(
                    "Hint: update DB_USER/DB_PASSWORD in .env to match your local Postgres login (pgAdmin is just the GUI)."
                );
            }
        });
}

module.exports = pool;

