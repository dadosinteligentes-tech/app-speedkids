-- Remove custom_domain column — domain handling moved to platform level
-- (giro-kids.com as APP_DOMAIN, dadosinteligentes.app.br as APP_DOMAIN_LEGACY)
-- SQLite doesn't support DROP COLUMN before 3.35.0, so we recreate the table

ALTER TABLE tenants DROP COLUMN custom_domain;

DROP INDEX IF EXISTS idx_tenants_custom_domain;
