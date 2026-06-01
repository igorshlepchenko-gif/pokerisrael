const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

// יוצר את הטבלאות בהפעלה הראשונה אם הן לא קיימות (idempotent)
async function ensureSchema() {
  try {
    const exists = await pool.query("SELECT to_regclass('public.users') AS t");
    if (exists.rows[0].t) {
      return; // הטבלאות כבר קיימות — לא עושים כלום
    }

    console.log('🔧 מסד נתונים ריק — יוצר טבלאות...');
    const fullPath = path.join(__dirname, 'schema_full.sql');
    const schemaPath = fs.existsSync(fullPath) ? fullPath : path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    console.log('✅ טבלאות נוצרו בהצלחה');

    // יצירת משתמש אדמין ראשוני
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@pokerisrael.org';
    const existingAdmin = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (existingAdmin.rows.length === 0) {
      const hash = await bcrypt.hash('Aa123456!', 12);
      await pool.query(
        `INSERT INTO users (name, email, password, phone, role, is_active, email_verified)
         VALUES ($1, $2, $3, $4, 'admin', true, true)`,
        ['מנהל המערכת', adminEmail, hash, '0500000000']
      );
      console.log(`✅ משתמש אדמין נוצר: ${adminEmail} / Aa123456!`);
    }
  } catch (err) {
    console.error('❌ שגיאה ביצירת הסכמה:', err.message);
  }
}

module.exports = ensureSchema;
