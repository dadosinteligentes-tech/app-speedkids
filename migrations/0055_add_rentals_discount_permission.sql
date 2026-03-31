-- Permission to apply manual discounts on rentals/sales
INSERT OR IGNORE INTO permissions (key, label, description, category, sort_order) VALUES
    ('rentals.discount', 'Aplicar descontos', 'Aplicar descontos manuais em locações e vendas', 'Locações', 3);

-- Manager and owner can discount by default, operator cannot
INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES
    ('owner', 'rentals.discount'),
    ('manager', 'rentals.discount');
