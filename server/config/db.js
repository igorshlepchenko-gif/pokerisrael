const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'poker_live_israel',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

pool.on('connect', () => {
  console.log('✅ התחברות למסד הנתונים הצליחה');
});

pool.on('error', (err) => {
  console.error('❌ שגיאת מסד נתונים:', err);
});

module.exports = pool;
