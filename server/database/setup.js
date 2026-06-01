require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// פרודקשן: DATABASE_URL; פיתוח: משתנים נפרדים
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'poker_live_israel',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    });

async function setup() {
  try {
    // schema_full.sql = הסכמה המלאה כולל כל העמודות שנוספו. נופל ל-schema.sql אם לא קיים.
    const fullPath = path.join(__dirname, 'schema_full.sql');
    const schemaPath = fs.existsSync(fullPath) ? fullPath : path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    console.log(`✅ טבלאות נוצרו בהצלחה (${path.basename(schemaPath)})`);

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@pokerliveisrael.co.il';
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);

    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash('Aa123456!', 12);
      await pool.query(
        'INSERT INTO users (name, email, password, phone, role) VALUES ($1, $2, $3, $4, $5)',
        ['מנהל המערכת', adminEmail, hash, '0500000000', 'admin']
      );
      console.log(`✅ משתמש אדמין נוצר: ${adminEmail} / Aa123456!`);
    } else {
      console.log('ℹ️  משתמש אדמין כבר קיים');
    }

    await pool.end();
    console.log('🂡 הגדרת מסד הנתונים הושלמה בהצלחה!');
  } catch (err) {
    console.error('❌ שגיאה בהגדרת מסד הנתונים:', err.message);
    process.exit(1);
  }
}

setup();
