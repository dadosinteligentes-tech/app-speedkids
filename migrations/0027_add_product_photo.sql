-- Add photo URL to products for R2 bucket storage
ALTER TABLE products ADD COLUMN photo_url TEXT;
