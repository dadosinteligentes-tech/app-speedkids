-- Promotions & Courtesies: pre-defined discounts that are trackable
-- Allows operators to select a named promotion instead of ad-hoc discounts

CREATE TABLE IF NOT EXISTS promotions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	tenant_id INTEGER NOT NULL,
	name TEXT NOT NULL,
	description TEXT,
	discount_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' or 'fixed'
	discount_value INTEGER NOT NULL DEFAULT 0,        -- percentage (e.g. 20 = 20%) or cents (e.g. 1000 = R$10)
	active INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now')),
	FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_promotions_tenant ON promotions(tenant_id);

-- Add promotion tracking to rental sessions
ALTER TABLE rental_sessions ADD COLUMN promotion_id INTEGER REFERENCES promotions(id);
ALTER TABLE rental_sessions ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0;

-- Add promotion tracking to product sales
ALTER TABLE product_sales ADD COLUMN promotion_id INTEGER REFERENCES promotions(id);

-- Seed permission for promotion management
INSERT OR IGNORE INTO permissions (key, label, description, category, sort_order)
VALUES ('promotions.manage', 'Gerenciar Promoções', 'Criar, editar e excluir promoções e cortesias', 'Vendas', 50);

INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES ('owner', 'promotions.manage');
INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES ('manager', 'promotions.manage');
