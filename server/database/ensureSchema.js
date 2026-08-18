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
      // קואורדינטות למועדון — בסיס לפיצ'ר "מצא טורניר קרוב אליי".
      // NUMERIC(9,6): עד 3 ספרות שלמות (מספיק ל-180±) ו-6 עשרוניות ≈ דיוק 0.1 מטר.
      `ALTER TABLE venues ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6)`,
      `ALTER TABLE venues ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6)`,
      // מיקום ברמת הטורניר — גובר על מיקום המועדון, בדיוק כמו address/city
      // שכבר קיימים כאן. נחוץ למארגנים ארציים (למשל Runner Runner) שמפעילים
      // טורנירים בכמה ערים תחת אותו מועדון רשום.
      `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6)`,
      `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6)`,
      // ── טבלת מיקומים: כתובת -> קואורדינטות ────────────────────────────────
      // נועדה לפתור את המקרה של מארגן ארצי (Runner Runner) שמפעיל טורנירים
      // בכמה ערים: הסוכן האוטומטי יוצר טורניר חדש עם כתובת בלבד, וללא הטבלה
      // הזו הוא היה נופל למיקום המועדון — כלומר לעיר הלא נכונה.
      //
      // normalize_address מנטרל שוני חסר-משמעות בין כתובות (פיסוק, רווחים,
      // "קומה 2", "בניין X") כדי שכתובת שנכתבה מעט אחרת עדיין תזוהה.
      `CREATE OR REPLACE FUNCTION normalize_address(txt text) RETURNS text AS $$
         SELECT NULLIF(
           regexp_replace(
             regexp_replace(lower(coalesce(txt, '')),
               '(קומה|קומת|בניין|בנין|מגדל|כניסה|דירה|מתחם)[^,]*', ' ', 'g'),
             '[^0-9a-zא-ת]+', '', 'g'
           ), '')
       $$ LANGUAGE sql IMMUTABLE`,
      `CREATE TABLE IF NOT EXISTS locations (
        id         SERIAL PRIMARY KEY,
        address    TEXT NOT NULL,
        city       VARCHAR(100),
        latitude   NUMERIC(9,6) NOT NULL,
        longitude  NUMERIC(9,6) NOT NULL,
        source     VARCHAR(30) DEFAULT 'geocoded',
        notes      TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS locations_address_uniq ON locations(address)`,
      // locations_seed — הכתובות הידועות היום. ON CONFLICT DO NOTHING שומר על
      // אידמפוטנטיות ולא דורס עריכה ידנית שנעשתה אחר כך במסד.
      `INSERT INTO locations (address, city, latitude, longitude) VALUES
        ('הלפיד 7 פתח תקווה', 'פתח תקווה', 32.0915004, 34.8541857),
        ('תוצרת הארץ 3', 'פתח תקווה', 32.0900013, 34.8601803),
        ('השר שפירא 16', 'ראשון לציון', 31.9915986, 34.7541049),
        ('השר חיים שפירא 16', 'ראשון לציון', 31.9915986, 34.7541049),
        ('בניין יוקה פארק, הכשרת היישוב 32 , ראשון לציון (קומה 4)', 'ראשון לציון', 31.9900961, 34.7676385),
        ('בר כוכבא 23 בני ברק, מגדל VTower, קומה 2', 'בני ברק', 32.0940715, 34.823239),
        ('מקלף 3, קומה 2', 'חיפה', 32.7836362, 35.0365687),
        ('מקלף 3', 'חיפה', 32.7836362, 35.0365687),
        ('שטנר 3, קומה 3', 'ירושלים', 31.7867314, 35.1893593),
        ('המדע 8 רחובות בניין רוטמן קומה 2', 'רחובות', 31.9151816, 34.8150645),
        ('הסדנא 13, קומה 1', 'רעננה', 32.1941328, 34.8784947),
        ('הסדנא 13 רעננה', 'רעננה', 32.1941328, 34.8784947),
        ('יהודה הנחתום 7, באר שבע', 'באר שבע', 31.2551128, 34.814862),
        ('יהודה הנחתום 7', 'באר שבע', 31.2551128, 34.814862),
        ('יוחנן הסנדלר 12', 'כפר סבא', 32.1758273, 34.9262972),
        ('יגאל אלון 126', 'תל אביב', 32.0743922, 34.7955905),
        ('עמק האלה 250', 'מודיעין', 31.9180088, 34.9976744)
       ON CONFLICT (address) DO NOTHING`,

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
      // מעקב התחברות אחרונה — לזיהוי חשבונות שנרשמו ולא חזרו להתחבר
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP`,
      // registration_logs היה קיים בפרודקשן רק דרך schema.sql (רץ פעם אחת על מסד ריק) —
      // לא הופיע כאן, כך שסביבה/מסד חדש לא היו יוצרים אותו אוטומטית. מוסיפים גם כאן
      // בתור רשת ביטחון idempotent (no-op על המסד הקיים).
      `CREATE TABLE IF NOT EXISTS registration_logs (
        id                SERIAL PRIMARY KEY,
        tournament_id     INTEGER,
        tournament_name   VARCHAR(200) NOT NULL,
        venue_id          INTEGER,
        venue_name        VARCHAR(200) NOT NULL,
        tournament_date   TIMESTAMP WITH TIME ZONE,
        user_id           INTEGER,
        registrant_name   VARCHAR(200) NOT NULL,
        registrant_phone  VARCHAR(30),
        created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_reg_logs_tournament ON registration_logs(tournament_id)`,
      `CREATE INDEX IF NOT EXISTS idx_reg_logs_venue      ON registration_logs(venue_id)`,
      `CREATE INDEX IF NOT EXISTS idx_reg_logs_created    ON registration_logs(created_at DESC)`,
      // יומן פניות למאמנים/קורסים (טאב לימודי פוקר) — אותה תבנית בדיוק כמו registration_logs
      `CREATE TABLE IF NOT EXISTS inquiry_logs (
        id               SERIAL PRIMARY KEY,
        lesson_id        VARCHAR(100),
        lesson_name      VARCHAR(200) NOT NULL,
        user_id          INTEGER,
        inquirer_name    VARCHAR(200) NOT NULL,
        inquirer_phone   VARCHAR(30),
        created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_inquiry_logs_lesson  ON inquiry_logs(lesson_id)`,
      `CREATE INDEX IF NOT EXISTS idx_inquiry_logs_created ON inquiry_logs(created_at DESC)`,
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
