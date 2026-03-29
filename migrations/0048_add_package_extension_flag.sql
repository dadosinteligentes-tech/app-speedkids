-- Add flag to distinguish extension packages from regular packages
ALTER TABLE packages ADD COLUMN is_extension INTEGER NOT NULL DEFAULT 0;
