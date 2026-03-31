-- Permission to apply existing promotions (separate from manual discounts)
INSERT OR IGNORE INTO permissions (key, label, description, category, sort_order) VALUES
    ('rentals.apply_promotion', 'Aplicar promoções', 'Aplicar promoções cadastradas em locações e vendas', 'Locações', 4);

-- All roles can apply promotions by default
INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES
    ('owner', 'rentals.apply_promotion'),
    ('manager', 'rentals.apply_promotion'),
    ('operator', 'rentals.apply_promotion');
