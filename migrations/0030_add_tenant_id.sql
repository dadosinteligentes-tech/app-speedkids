-- Multi-tenancy: add tenant_id to all data tables
-- All existing data is assigned to tenant 1 (SpeedKids) via DEFAULT 1

-- SQLite ALTER TABLE ADD COLUMN does not support REFERENCES with DEFAULT,
-- so we add columns without FK constraint. Referential integrity is enforced at app level.
ALTER TABLE users ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE assets ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE asset_types ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE packages ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE customers ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE rental_sessions ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE shifts ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE cash_registers ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE product_sales ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE operation_logs ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE batteries ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;

-- business_config: add tenant_id and remove singleton constraint
-- SQLite cannot drop CHECK constraint, so we recreate the table
CREATE TABLE business_config_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL UNIQUE REFERENCES tenants(id),
  name TEXT NOT NULL DEFAULT '',
  cnpj TEXT,
  address TEXT,
  phone TEXT,
  receipt_footer TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO business_config_new (id, tenant_id, name, cnpj, address, phone, receipt_footer, updated_at)
SELECT id, 1, name, cnpj, address, phone, receipt_footer, updated_at
FROM business_config;

DROP TABLE business_config;
ALTER TABLE business_config_new RENAME TO business_config;

-- Indexes for tenant filtering performance
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_assets_tenant ON assets(tenant_id);
CREATE INDEX idx_packages_tenant ON packages(tenant_id);
CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_rental_sessions_tenant ON rental_sessions(tenant_id);
CREATE INDEX idx_shifts_tenant ON shifts(tenant_id);
CREATE INDEX idx_cash_registers_tenant ON cash_registers(tenant_id);
CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_product_sales_tenant ON product_sales(tenant_id);
CREATE INDEX idx_operation_logs_tenant ON operation_logs(tenant_id);
CREATE INDEX idx_batteries_tenant ON batteries(tenant_id);

-- Unique email per tenant (not globally)
CREATE UNIQUE INDEX idx_users_email_tenant ON users(email, tenant_id);
