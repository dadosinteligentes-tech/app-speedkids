-- Remove custom_domain column — domain handling moved to platform level
-- Must drop the index BEFORE dropping the column

DROP INDEX IF EXISTS idx_tenants_custom_domain;

ALTER TABLE tenants DROP COLUMN custom_domain;
