const { Pool } = require('pg');

// בפרודקשן (Railway/Render) משתמשים ב-DATABASE_URL; בפיתוח — משתני סביבה נפרדים
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // נדרש בספקי ענן
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'poker_live_israel',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    });

let logged = false;
pool.on('connect', () => {
  if (!logged) { console.log('✅ התחברות למסד הנתונים הצליחה'); logged = true; }
});

pool.on('error', (err) => {
  console.error('❌ שגיאת מסד נתונים:', err);
});

module.exports = pool;
