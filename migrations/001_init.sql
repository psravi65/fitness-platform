PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'client')),
  client_id TEXT,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS intakes (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  answers_json TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
  source_intake_id TEXT,
  generated_json TEXT NOT NULL,
  edited_json TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (source_intake_id) REFERENCES intakes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS daily_logs (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  log_date TEXT NOT NULL,
  meals_json TEXT NOT NULL DEFAULT '{}',
  workout_json TEXT NOT NULL DEFAULT '{}',
  macros_json TEXT NOT NULL DEFAULT '{}',
  hydration REAL NOT NULL DEFAULT 0,
  steps INTEGER NOT NULL DEFAULT 0,
  cardio TEXT,
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, log_date),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  checkin_date TEXT NOT NULL,
  weight REAL,
  body_fat REAL,
  waist REAL,
  hips REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, checkin_date),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weekly_reviews (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  week_key TEXT NOT NULL,
  review_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, week_key),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exports (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  export_type TEXT NOT NULL,
  target TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_users_client_id ON users(client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_intakes_client_id ON intakes(client_id);
CREATE INDEX IF NOT EXISTS idx_plans_client_id ON plans(client_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_client_date ON daily_logs(client_id, log_date);
CREATE INDEX IF NOT EXISTS idx_checkins_client_date ON checkins(client_id, checkin_date);
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_client_week ON weekly_reviews(client_id, week_key);

