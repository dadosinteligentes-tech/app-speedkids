-- Recreate cash_transactions to add 'product_sale' to type CHECK constraint
-- SQLite does not support ALTER TABLE to modify CHECK constraints

-- 1. Backup dependent table
CREATE TABLE _bak_cash_register_denominations AS SELECT * FROM cash_register_denominations;
DROP TABLE cash_register_denominations;

-- 2. Backup cash_transactions
CREATE TABLE _bak_cash_transactions AS SELECT * FROM cash_transactions;
DROP TABLE cash_transactions;

-- 3. Recreate cash_transactions with updated CHECK and product_sale_id column
CREATE TABLE cash_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cash_register_id INTEGER NOT NULL REFERENCES cash_registers(id),
    rental_session_id TEXT REFERENCES rental_sessions(id),
    product_sale_id INTEGER REFERENCES product_sales(id),
    type TEXT NOT NULL CHECK (type IN ('rental_payment', 'product_sale', 'adjustment', 'withdrawal', 'deposit')),
    amount_cents INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT,
    description TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO cash_transactions (id, cash_register_id, rental_session_id, product_sale_id, type, amount_cents, payment_method, description, recorded_by, created_at)
    SELECT id, cash_register_id, rental_session_id, product_sale_id, type, amount_cents, payment_method, description, recorded_by, created_at
    FROM _bak_cash_transactions;
CREATE INDEX idx_cash_tx_register ON cash_transactions(cash_register_id);

-- 4. Recreate cash_register_denominations
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
DROP TABLE _bak_cash_transactions;
DROP TABLE _bak_cash_register_denominations;
