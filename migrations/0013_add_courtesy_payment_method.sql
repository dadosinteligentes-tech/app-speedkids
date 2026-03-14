-- Migration number: 0013   Add 'courtesy' to payment_method CHECK constraint
-- SQLite requires table recreation to alter CHECK constraints

PRAGMA foreign_keys=OFF;

CREATE TABLE rental_sessions_new (
    id TEXT PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(id),
    package_id INTEGER NOT NULL REFERENCES packages(id),
    pos_id INTEGER,
    attendant_id INTEGER,
    cash_register_id INTEGER,
    customer_id INTEGER REFERENCES customers(id),
    child_id INTEGER REFERENCES children(id),

    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'paused', 'completed', 'cancelled')),
    start_time TEXT NOT NULL,
    pause_time TEXT,
    total_paused_ms INTEGER NOT NULL DEFAULT 0,
    end_time TEXT,
    duration_minutes INTEGER NOT NULL,

    amount_cents INTEGER NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('cash', 'credit', 'debit', 'pix', 'courtesy')),
    paid INTEGER NOT NULL DEFAULT 0,

    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO rental_sessions_new
    (id, asset_id, package_id, pos_id, attendant_id, cash_register_id,
     customer_id, child_id, status, start_time, pause_time, total_paused_ms,
     end_time, duration_minutes, amount_cents, payment_method, paid, notes,
     created_at, updated_at)
SELECT id, asset_id, package_id, pos_id, attendant_id, cash_register_id,
       customer_id, child_id, status, start_time, pause_time, total_paused_ms,
       end_time, duration_minutes, amount_cents, payment_method, paid, notes,
       created_at, updated_at
FROM rental_sessions;

DROP TABLE rental_sessions;

ALTER TABLE rental_sessions_new RENAME TO rental_sessions;

CREATE INDEX idx_rental_sessions_asset ON rental_sessions(asset_id);
CREATE INDEX idx_rental_sessions_status ON rental_sessions(status);
CREATE INDEX idx_rental_sessions_start ON rental_sessions(start_time);

PRAGMA foreign_keys=ON;
