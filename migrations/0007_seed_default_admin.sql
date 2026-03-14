-- Default admin user (password: admin123)
-- IMPORTANT: Change this password immediately after first login
INSERT OR IGNORE INTO users (name, email, password_hash, salt, role)
VALUES (
    'Administrador',
    'admin@speedkids.com',
    'a05089ee7bda1a9db62f0f5f997335029b4a5614abd415a88a8cda7f7452f4b3',
    'd7a8aabdf70f62bafa454a8cd72d2b8d',
    'owner'
);
