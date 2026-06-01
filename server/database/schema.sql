-- סכמת מסד הנתונים - פוקר לייב ישראל

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'player',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS venues (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  whatsapp_number VARCHAR(20) NOT NULL,
  description TEXT,
  logo_url TEXT,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournaments (
  id SERIAL PRIMARY KEY,
  venue_id INTEGER REFERENCES venues(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  start_time TIMESTAMP NOT NULL,
  estimated_end_time TIMESTAMP,
  stages JSONB DEFAULT '[]',
  starting_stack INTEGER,
  level_duration INTEGER,
  day_of_week INTEGER,
  is_recurring BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'pending',
  rejection_reason TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_start_time ON tournaments(start_time);
CREATE INDEX IF NOT EXISTS idx_venues_owner ON venues(owner_id);

-- מיגרציה: נעילת חשבון לאחר ניסיונות התחברות כושלים
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP;

-- מיגרציה: אימות מייל
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMP;

-- מיגרציה: Re-Entry ו-Late Registration בטורנירים
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS re_entry VARCHAR(20) DEFAULT NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS late_reg_level INTEGER DEFAULT NULL;

-- מיגרציה: boost fields
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT FALSE;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS boost_label VARCHAR(50) DEFAULT '';

-- מיגרציה: יומן שינויים
CREATE TABLE IF NOT EXISTS change_logs (
  id              SERIAL PRIMARY KEY,
  entity_type     VARCHAR(20)  NOT NULL,
  entity_id       INTEGER      NOT NULL,
  entity_name     VARCHAR(200),
  action          VARCHAR(30)  NOT NULL,
  changed_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  changed_by_name VARCHAR(200),
  old_data        JSONB,
  new_data        JSONB,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_change_logs_entity  ON change_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_change_logs_created ON change_logs(created_at DESC);

-- מיגרציה: לוג הרשמות לטורנירים
CREATE TABLE IF NOT EXISTS registration_logs (
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
);
CREATE INDEX IF NOT EXISTS idx_reg_logs_tournament ON registration_logs(tournament_id);
CREATE INDEX IF NOT EXISTS idx_reg_logs_venue      ON registration_logs(venue_id);
CREATE INDEX IF NOT EXISTS idx_reg_logs_created    ON registration_logs(created_at DESC);

-- מיגרציה: תבניות בליינדים שמורות למשתמש
CREATE TABLE IF NOT EXISTS blind_templates (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  stages     JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blind_templates_user ON blind_templates(user_id);
