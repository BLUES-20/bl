const db = require('../config/db');

async function main() {
    const args = new Set(process.argv.slice(2));
    if (!args.has('--yes')) {
        console.error('Refusing to reset DB without confirmation.');
        console.error('Run: npm run db:reset -- --yes');
        process.exit(2);
    }

    console.log('⚠️  Resetting database (dropping tables/types)...');

    const statements = [
        'DROP TABLE IF EXISTS documents CASCADE;',
        'DROP TABLE IF EXISTS announcements CASCADE;',
        'DROP TABLE IF EXISTS contact_messages CASCADE;',
        'DROP TABLE IF EXISTS results CASCADE;',
        'DROP TABLE IF EXISTS sessions CASCADE;',
        'DROP TABLE IF EXISTS staff CASCADE;',
        'DROP TABLE IF EXISTS students CASCADE;',
        'DROP TABLE IF EXISTS users CASCADE;',
        'DROP TYPE IF EXISTS gender_type CASCADE;',
        'DROP TYPE IF EXISTS user_role CASCADE;'
    ];

    try {
        for (const sql of statements) {
            await db.query(sql);
        }
        console.log('✅ Database reset complete.');
        console.log('Next: npm run db:init (or start the server).');
    } finally {
        await db.end().catch(() => {});
    }
}

main().catch((err) => {
    console.error('❌ Database reset failed:', err && err.message ? err.message : err);
    process.exit(1);
});

