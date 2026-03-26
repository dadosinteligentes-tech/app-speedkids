-- Track checkout attempts that didn't convert to paying customers
CREATE TABLE IF NOT EXISTS abandoned_checkouts (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	slug TEXT NOT NULL,
	business_name TEXT NOT NULL,
	owner_name TEXT NOT NULL,
	owner_email TEXT NOT NULL,
	plan TEXT NOT NULL DEFAULT 'starter',
	converted INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_abandoned_checkouts_converted ON abandoned_checkouts(converted);
CREATE INDEX idx_abandoned_checkouts_email ON abandoned_checkouts(owner_email);
