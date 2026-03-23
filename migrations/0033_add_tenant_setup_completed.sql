-- Track whether tenant has completed initial setup wizard
ALTER TABLE tenants ADD COLUMN setup_completed INTEGER NOT NULL DEFAULT 0;

-- Mark existing tenants as already set up (they don't need the wizard)
UPDATE tenants SET setup_completed = 1;
