-- Migration number: 0005   SpeedKids - Seed default packages and test assets

-- Default packages
INSERT INTO packages (name, duration_minutes, price_cents, sort_order) VALUES
    ('15 Minutos', 15, 1500, 1),
    ('30 Minutos', 30, 2500, 2),
    ('1 Hora', 60, 4000, 3);

-- Test assets
INSERT INTO assets (name, asset_type) VALUES
    ('Carrinho #1', 'carrinho'),
    ('Carrinho #2', 'carrinho'),
    ('Carrinho #3', 'carrinho'),
    ('GoKart #1', 'gokart'),
    ('GoKart #2', 'gokart'),
    ('Bicicleta #1', 'bicicleta'),
    ('Bicicleta #2', 'bicicleta'),
    ('Patinete #1', 'patinete');
