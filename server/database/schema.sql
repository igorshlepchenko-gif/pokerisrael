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

-- מיגרציה: Re-Entry ו-Late Registration בטורנירים
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS re_entry VARCHAR(20) DEFAULT NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS late_reg_level INTEGER DEFAULT NULL;
