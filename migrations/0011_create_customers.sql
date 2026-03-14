-- Migration 0011: Create customers table and add customer_id to rental_sessions
CREATE TABLE IF NOT EXISTS customers (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	phone TEXT,
	email TEXT,
	notes TEXT,
	total_rentals INTEGER NOT NULL DEFAULT 0,
	total_spent_cents INTEGER NOT NULL DEFAULT 0,
	loyalty_points INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_phone ON customers(phone);

ALTER TABLE rental_sessions ADD COLUMN customer_id INTEGER REFERENCES customers(id);
