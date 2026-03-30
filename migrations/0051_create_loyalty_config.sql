-- Loyalty program configuration per tenant
CREATE TABLE IF NOT EXISTS loyalty_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL UNIQUE,
    enabled INTEGER NOT NULL DEFAULT 0,
    points_per_real INTEGER NOT NULL DEFAULT 1,
    min_redemption_points INTEGER NOT NULL DEFAULT 100,
    points_value_cents INTEGER NOT NULL DEFAULT 1,
    tiers_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_loyalty_config_tenant ON loyalty_config(tenant_id);
