-- Loyalty points ledger (audit trail)
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('earned', 'redeemed', 'adjusted', 'expired')),
    points INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reference_type TEXT,
    reference_id TEXT,
    description TEXT,
    recorded_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_loyalty_tx_tenant_customer ON loyalty_transactions(tenant_id, customer_id);
CREATE INDEX idx_loyalty_tx_created ON loyalty_transactions(tenant_id, created_at);
CREATE INDEX idx_loyalty_tx_type ON loyalty_transactions(tenant_id, type);
