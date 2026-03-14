-- Migration 0012: Create children table, unique phone index, and child_id on rental_sessions

CREATE TABLE IF NOT EXISTS children (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	customer_id INTEGER NOT NULL REFERENCES customers(id),
	name TEXT NOT NULL,
	age INTEGER NOT NULL,
	birth_date TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_children_customer ON children(customer_id);

CREATE UNIQUE INDEX idx_customers_phone_unique ON customers(phone) WHERE phone IS NOT NULL;

ALTER TABLE rental_sessions ADD COLUMN child_id INTEGER REFERENCES children(id);
