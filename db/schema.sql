-- Harsh Developers — D1 schema
-- Users, sessions, properties, applications, loans, EMI schedules, settings.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('gala', 'plot', 'flat')),
  address TEXT NOT NULL,
  area_sqft REAL NOT NULL,
  price_per_sqft REAL NOT NULL,
  total_price REAL NOT NULL,
  price_overridden INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'on-hold', 'sold')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS property_images (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_images_property ON property_images(property_id);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT,
  UNIQUE(user_id, property_id)
);
CREATE INDEX IF NOT EXISTS idx_apps_user ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_apps_status ON applications(status);

CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  manual_name TEXT,
  manual_phone TEXT,
  property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
  application_id TEXT REFERENCES applications(id) ON DELETE SET NULL,
  amount REAL NOT NULL,
  tenure_months INTEGER NOT NULL,
  interest_pct REAL,
  interest_type TEXT NOT NULL DEFAULT 'reducing' CHECK (interest_type IN ('reducing', 'flat')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  emi REAL,
  rejection_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);

CREATE TABLE IF NOT EXISTS emi_schedule (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  n INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  emi REAL NOT NULL,
  principal REAL NOT NULL,
  interest REAL NOT NULL,
  balance REAL NOT NULL,
  UNIQUE(loan_id, n)
);
CREATE INDEX IF NOT EXISTS idx_emi_loan ON emi_schedule(loan_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
