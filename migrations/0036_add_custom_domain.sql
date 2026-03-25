-- Add custom_domain column to tenants for vanity/custom domains (e.g. giro-kids.com)

ALTER TABLE tenants ADD COLUMN custom_domain TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_custom_domain ON tenants(custom_domain) WHERE custom_domain IS NOT NULL;

-- Set giro-kids.com as custom domain for speedykids tenant
UPDATE tenants SET custom_domain = 'giro-kids.com' WHERE slug = 'speedykids';
