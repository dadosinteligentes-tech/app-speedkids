-- Email verification fields on customers
ALTER TABLE customers ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN email_verified_at TEXT;

-- Loyalty discount tracking on rental_sessions
ALTER TABLE rental_sessions ADD COLUMN loyalty_discount_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rental_sessions ADD COLUMN loyalty_points_redeemed INTEGER NOT NULL DEFAULT 0;

-- Loyalty discount tracking on product_sales
ALTER TABLE product_sales ADD COLUMN loyalty_discount_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE product_sales ADD COLUMN loyalty_points_redeemed INTEGER NOT NULL DEFAULT 0;

-- Loyalty permissions
INSERT OR IGNORE INTO permissions (key, label, description, category, sort_order) VALUES
    ('loyalty.view',   'Visualizar fidelidade', 'Ver programa de fidelidade e pontos dos clientes', 'Fidelidade', 60),
    ('loyalty.manage', 'Gerenciar fidelidade',  'Configurar programa de fidelidade, ajustar pontos', 'Fidelidade', 61);

-- Manager can view, owner can manage
INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES
    ('owner', 'loyalty.view'),
    ('owner', 'loyalty.manage'),
    ('manager', 'loyalty.view');
