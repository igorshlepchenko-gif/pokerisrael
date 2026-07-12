const { Pool } = require('pg');

// הגדרות טיימאאוט משותפות — סוגר חיבורים לא פעילים ומונע המתנה אינסופית
// כשה-pool מלא או כשהחיבור נתקע (ranked idle connections stayed open indefinitely before this)
const POOL_TIMEOUTS = {
  idleTimeoutMillis: 30_000,               // מחזיר חיבור פנוי ל-OS אחרי 30 שניות חוסר פעילות
  connectionTimeoutMillis: 10_000,         // נכשל מהר במקום לתלות לנצח כשה-pool מלא
  keepAlive: true,                         // TCP keepalive — מזהה חיבור שנפל בשקט ברשת
  statement_timeout: 30_000,               // הורג שאילתה תקועה אחרי 30 שניות
  idle_in_transaction_session_timeout: 30_000, // הורג טרנזקציה שננטשה אחרי 30 שניות
};

// בפרודקשן (Railway/Render) משתמשים ב-DATABASE_URL; בפיתוח — משתני סביבה נפרדים
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // נדרש בספקי ענן
      ...POOL_TIMEOUTS,
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'poker_live_israel',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ...POOL_TIMEOUTS,
    });

let logged = false;
pool.on('connect', () => {
  if (!logged) { console.log('✅ התחברות למסד הנתונים הצליחה'); logged = true; }
});

pool.on('error', (err) => {
  console.error('❌ שגיאת מסד נתונים:', err);
});

module.exports = pool;
