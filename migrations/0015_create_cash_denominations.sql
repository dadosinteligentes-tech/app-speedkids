-- Migration 0015: Denomination tracking for cash register operations
-- Each row = quantity of a specific bill/coin denomination for an event

CREATE TABLE IF NOT EXISTS cash_register_denominations (
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

CREATE INDEX IF NOT EXISTS idx_cash_denom_register
    ON cash_register_denominations(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_cash_denom_event
    ON cash_register_denominations(cash_register_id, event_type);
