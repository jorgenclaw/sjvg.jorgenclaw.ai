CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submitted_at TEXT NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  sjvg_interest INTEGER,
  jorgenclaw_interest INTEGER,
  services TEXT,
  service_models TEXT,
  user_type TEXT,
  other_services TEXT,
  follow_up TEXT
);
