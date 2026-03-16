-- Business configuration (singleton row)
CREATE TABLE IF NOT EXISTS business_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '',
  cnpj TEXT,
  address TEXT,
  phone TEXT,
  receipt_footer TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO business_config (id) VALUES (1);
