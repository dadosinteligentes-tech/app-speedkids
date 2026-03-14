-- Migration number: 0014   Add overtime fields to packages and rental_sessions

-- Packages: overtime configuration
ALTER TABLE packages ADD COLUMN overtime_block_minutes INTEGER NOT NULL DEFAULT 5;
ALTER TABLE packages ADD COLUMN overtime_block_price_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE packages ADD COLUMN grace_period_minutes INTEGER NOT NULL DEFAULT 5;

-- Rental sessions: overtime tracking
ALTER TABLE rental_sessions ADD COLUMN overtime_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rental_sessions ADD COLUMN overtime_cents INTEGER NOT NULL DEFAULT 0;

-- Seed default overtime prices for existing packages
-- 15min/R$15 → R$5 per 5min block
UPDATE packages SET overtime_block_price_cents = 500 WHERE duration_minutes = 15;
-- 30min/R$25 → R$5 per 5min block
UPDATE packages SET overtime_block_price_cents = 500 WHERE duration_minutes = 30;
-- 1h/R$40 → R$5 per 5min block
UPDATE packages SET overtime_block_price_cents = 500 WHERE duration_minutes = 60;
