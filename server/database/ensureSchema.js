const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

// יוצר את הטבלאות בהפעלה הראשונה אם הן לא קיימות (idempotent)
async function ensureSchema() {
  try {
    const exists = await pool.query("SELECT to_regclass('public.users') AS t");
    if (!exists.rows[0].t) {
      console.log('🔧 מסד נתונים ריק — יוצר טבלאות...');
      const fullPath = path.join(__dirname, 'schema_full.sql');
      const schemaPath = fs.existsSync(fullPath) ? fullPath : path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schema);
      console.log('✅ טבלאות נוצרו בהצלחה');
    }

    // ── מיגרציות אוטומטיות — עמודות חדשות (idempotent, רץ בכל הפעלה) ──
    const MIGRATIONS = [
      `ALTER TABLE venues ADD COLUMN IF NOT EXISTS website VARCHAR(300)`,
    ];
    for (const sql of MIGRATIONS) {
      try { await pool.query(sql); } catch (e) { console.error('migration failed:', e.message); }
    }

    // ודא שמשתמש אדמין קיים (תמיד — לא רק ביצירה ראשונה)
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@pokerisrael.org';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Aa123456!';
    const existingAdmin = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (existingAdmin.rows.length === 0) {
      const hash = await bcrypt.hash(adminPassword, 12);
      await pool.query(
        `INSERT INTO users (name, email, password, phone, role, is_active, email_verified)
         VALUES ($1, $2, $3, $4, 'admin', true, true)`,
        ['מנהל המערכת', adminEmail, hash, '0500000000']
      );
      console.log(`✅ משתמש אדמין נוצר: ${adminEmail}`);
    } else if (process.env.ADMIN_PASSWORD) {
      // אם הוגדר ADMIN_PASSWORD — מעדכן את סיסמת האדמין הקיים (וגם משחרר נעילה)
      const hash = await bcrypt.hash(adminPassword, 12);
      await pool.query(
        `UPDATE users SET password = $1, is_locked = false, failed_login_attempts = 0, role = 'admin', is_active = true
         WHERE email = $2`,
        [hash, adminEmail]
      );
      console.log(`🔑 סיסמת האדמין עודכנה: ${adminEmail}`);
    }
  } catch (err) {
    console.error('❌ שגיאה ביצירת הסכמה:', err.message);
  }
}

module.exports = ensureSchema;
