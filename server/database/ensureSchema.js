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
      `CREATE TABLE IF NOT EXISTS hand_histories (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        game_type VARCHAR(20) NOT NULL,
        tournament_stage VARCHAR(30),
        blind_sb INTEGER,
        blind_bb INTEGER,
        ante INTEGER DEFAULT 0,
        cash_stakes VARCHAR(20),
        players_count INTEGER NOT NULL DEFAULT 2,
        hero_position VARCHAR(10) NOT NULL,
        hero_stack INTEGER NOT NULL,
        hero_cards JSONB NOT NULL DEFAULT '[]',
        hand_data JSONB NOT NULL DEFAULT '{}',
        result VARCHAR(10) NOT NULL DEFAULT 'unknown',
        hero_profit INTEGER,
        narrative TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS hand_histories_user_id_idx ON hand_histories(user_id, created_at DESC)`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS hand_logger_access BOOLEAN DEFAULT false`,
      `CREATE TABLE IF NOT EXISTS tournament_imports (
        id            SERIAL PRIMARY KEY,
        source        VARCHAR(30)  NOT NULL DEFAULT 'manual',
        raw_text      TEXT         NOT NULL,
        parsed_data   JSONB        NOT NULL DEFAULT '{}',
        venue_id      INTEGER      REFERENCES venues(id) ON DELETE SET NULL,
        tournament_id INTEGER      REFERENCES tournaments(id) ON DELETE SET NULL,
        status        VARCHAR(20)  NOT NULL DEFAULT 'pending',
        created_by    INTEGER      REFERENCES users(id),
        created_at    TIMESTAMP    DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS tournament_imports_status_idx ON tournament_imports(status, created_at DESC)`,
      // Agent monitored sources
      `CREATE TABLE IF NOT EXISTS agent_sources (
        id           SERIAL PRIMARY KEY,
        platform     VARCHAR(20) NOT NULL,
        name         VARCHAR(200) NOT NULL,
        identifier   VARCHAR(300) NOT NULL,
        active       BOOLEAN DEFAULT true,
        last_checked TIMESTAMP,
        last_msg_id  BIGINT,
        created_by   INTEGER REFERENCES users(id),
        created_at   TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS agent_sources_platform_ident ON agent_sources(platform, identifier)`,
      // Web scraper deduplication
      `ALTER TABLE tournament_imports ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS tournament_imports_content_hash ON tournament_imports(content_hash) WHERE content_hash IS NOT NULL`,
      `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS external_registration_url VARCHAR(500)`,
      `CREATE TABLE IF NOT EXISTS event_brands (
        id         SERIAL PRIMARY KEY,
        venue_id   INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
        name       VARCHAR(200) NOT NULL,
        logo_url   VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_event_brands_venue ON event_brands(venue_id)`,
      // סנכרון פיד חיצוני — זיהוי טורנירים שמקורם בפיד
      `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS external_source VARCHAR(50)`,
      `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS external_id VARCHAR(100)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS tournaments_external_uniq ON tournaments(external_source, external_id) WHERE external_id IS NOT NULL`,
      `CREATE TABLE IF NOT EXISTS feed_sources (
        id           SERIAL PRIMARY KEY,
        venue_id     INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
        url          VARCHAR(500) NOT NULL,
        label        VARCHAR(200),
        source_key   VARCHAR(50) NOT NULL DEFAULT 'feed',
        auto_publish BOOLEAN DEFAULT true,
        active       BOOLEAN DEFAULT true,
        last_synced  TIMESTAMP,
        last_result  TEXT,
        created_by   INTEGER REFERENCES users(id),
        created_at   TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS feed_sources_venue_url ON feed_sources(venue_id, url)`,
      // רישום כפול — מארגן (organizer) נפרד מהמועדון המארח + הגנת עריכה ידנית
      `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS organizer_venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL`,
      `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS manually_edited BOOLEAN DEFAULT false`,
      `ALTER TABLE venues ADD COLUMN IF NOT EXISTS registration_url VARCHAR(500)`,
      `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS address TEXT`,
      `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS city VARCHAR(100)`,
      // מונה גרסת טוקן — מאפשר ביטול מיידי של כל הטוקנים הקיימים בלחיצת logout
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0`,
      // הפעלה/כיבוי טורניר בצד הבעלים — למשל השבתת סדרה שבועית זמנית בלי למחוק אותה
      `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`,
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
