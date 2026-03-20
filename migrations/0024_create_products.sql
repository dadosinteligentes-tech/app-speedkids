-- Products table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL DEFAULT 0,
    category TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Product sales table
CREATE TABLE IF NOT EXISTS product_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cash_register_id INTEGER REFERENCES cash_registers(id),
    customer_id INTEGER REFERENCES customers(id),
    attendant_id INTEGER REFERENCES users(id),
    total_cents INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT CHECK(payment_method IN ('cash', 'credit', 'debit', 'pix', 'mixed')),
    paid INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Product sale items table
CREATE TABLE IF NOT EXISTS product_sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_sale_id INTEGER NOT NULL REFERENCES product_sales(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Add product_sale_id column to cash_transactions
ALTER TABLE cash_transactions ADD COLUMN product_sale_id INTEGER REFERENCES product_sales(id);
