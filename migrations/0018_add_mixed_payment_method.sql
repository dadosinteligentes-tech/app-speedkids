-- Migration number: 0018   Add 'mixed' to payment_method CHECK constraint
-- SQLite requires table recreation to alter CHECK constraints
-- Must handle dependent tables chain: rental_sessions <- session_pauses, cash_transactions <- cash_register_denominations

PRAGMA foreign_keys=OFF;

-- 1. Backup all dependent tables
CREATE TABLE _bak_session_pauses AS SELECT * FROM session_pauses;
CREATE TABLE _bak_cash_register_denominations AS SELECT * FROM cash_register_denominations;
CREATE TABLE _bak_cash_transactions AS SELECT * FROM cash_transactions;

-- 2. Drop dependent tables (deepest first)
DROP TABLE cash_register_denominations;
DROP TABLE session_pauses;
DROP TABLE cash_transactions;

-- 3. Recreate rental_sessions with updated CHECK
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
    overtime_minutes INTEGER NOT NULL DEFAULT 0,
    overtime_cents INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT CHECK (payment_method IN ('cash', 'credit', 'debit', 'pix', 'courtesy', 'mixed')),
    paid INTEGER NOT NULL DEFAULT 0,

    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO rental_sessions_new
    (id, asset_id, package_id, pos_id, attendant_id, cash_register_id,
     customer_id, child_id, status, start_time, pause_time, total_paused_ms,
     end_time, duration_minutes, amount_cents, overtime_minutes, overtime_cents,
     payment_method, paid, notes, created_at, updated_at)
SELECT id, asset_id, package_id, pos_id, attendant_id, cash_register_id,
       customer_id, child_id, status, start_time, pause_time, total_paused_ms,
       end_time, duration_minutes, amount_cents, overtime_minutes, overtime_cents,
       payment_method, paid, notes, created_at, updated_at
FROM rental_sessions;

DROP TABLE rental_sessions;
ALTER TABLE rental_sessions_new RENAME TO rental_sessions;

CREATE INDEX idx_rental_sessions_asset ON rental_sessions(asset_id);
CREATE INDEX idx_rental_sessions_status ON rental_sessions(status);
CREATE INDEX idx_rental_sessions_start ON rental_sessions(start_time);

-- 4. Recreate dependent tables and restore data

-- session_pauses
CREATE TABLE session_pauses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES rental_sessions(id),
    paused_at TEXT NOT NULL,
    resumed_at TEXT,
    duration_ms INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO session_pauses SELECT * FROM _bak_session_pauses;
CREATE INDEX idx_session_pauses_session ON session_pauses(session_id);

-- cash_transactions
CREATE TABLE cash_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cash_register_id INTEGER NOT NULL REFERENCES cash_registers(id),
    rental_session_id TEXT REFERENCES rental_sessions(id),
    type TEXT NOT NULL CHECK (type IN ('rental_payment', 'adjustment', 'withdrawal', 'deposit')),
    amount_cents INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT,
    description TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO cash_transactions SELECT * FROM _bak_cash_transactions;
CREATE INDEX idx_cash_tx_register ON cash_transactions(cash_register_id);

-- cash_register_denominations
CREATE TABLE cash_register_denominations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cash_register_id INTEGER NOT NULL REFERENCES cash_registers(id),
    cash_transaction_id INTEGER REFERENCES cash_transactions(id),
    event_type TEXT NOT NULL CHECK (event_type IN (
        'opening', 'closing', 'payment_in', 'change_out', 'deposit', 'withdrawal'
    )),
    denomination_cents INTEGER NOT NULL CHECK (denomination_cents IN (
        20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 25, 10, 5
    )),
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO cash_register_denominations SELECT * FROM _bak_cash_register_denominations;
CREATE INDEX idx_cash_denom_register ON cash_register_denominations(cash_register_id);
CREATE INDEX idx_cash_denom_event ON cash_register_denominations(cash_register_id, event_type);

-- 5. Cleanup
DROP TABLE _bak_session_pauses;
DROP TABLE _bak_cash_transactions;
DROP TABLE _bak_cash_register_denominations;

PRAGMA foreign_keys=ON;
