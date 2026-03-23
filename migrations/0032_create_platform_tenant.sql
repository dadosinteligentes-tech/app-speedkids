-- Platform tenant: hidden tenant for SaaS admin users
-- slug starts with _ to indicate it's internal
INSERT INTO tenants (slug, name, owner_email, plan, status)
VALUES ('_platform', 'Platform Admin', 'contatoricardodiniz@gmail.com', 'enterprise', 'active');

-- Platform superadmin user (password: admin123)
-- IMPORTANT: Change this password immediately after first login
INSERT INTO users (tenant_id, name, email, password_hash, salt, role)
VALUES (
    (SELECT id FROM tenants WHERE slug = '_platform'),
    'Ricardo Diniz',
    'contatoricardodiniz@gmail.com',
    '455a9e187f0eafe76440d8c48bca07f9804bdf5e263537c45b17a600b95df922',
    '5f8d1daaa2452c9d73005c9929f16d2a',
    'owner'
);

-- Business config for platform tenant (required by queries)
INSERT INTO business_config (tenant_id, name)
VALUES ((SELECT id FROM tenants WHERE slug = '_platform'), 'Platform Admin');
