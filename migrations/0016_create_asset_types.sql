-- Asset types management table
CREATE TABLE IF NOT EXISTS asset_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default types
INSERT OR IGNORE INTO asset_types (name, label) VALUES
    ('kart', 'Kart'),
    ('bike', 'Bicicleta'),
    ('scooter', 'Patinete'),
    ('other', 'Outro');

-- Normalize existing assets from seed data
UPDATE assets SET asset_type = 'kart' WHERE asset_type IN ('carrinho', 'gokart');
UPDATE assets SET asset_type = 'bike' WHERE asset_type = 'bicicleta';
UPDATE assets SET asset_type = 'scooter' WHERE asset_type = 'patinete';
