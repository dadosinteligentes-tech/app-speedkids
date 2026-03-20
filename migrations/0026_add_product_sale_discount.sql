-- Add discount tracking to product sales
ALTER TABLE product_sales ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0;
