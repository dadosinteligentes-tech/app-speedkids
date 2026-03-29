-- Security: invalidate default seed passwords from migrations 0007 and 0032
-- These passwords (admin123) should have been changed after first login
-- This migration ensures they cannot be used if they were never changed

-- Invalidate the default admin@speedkids.com password (tenant 1 seed user)
-- Sets hash to an impossible value that can never match any password
UPDATE users SET password_hash = 'INVALIDATED_CHANGE_VIA_PLATFORM_ADMIN', updated_at = datetime('now')
WHERE email = 'admin@speedkids.com'
  AND password_hash = 'a05089ee7bda1a9db62f0f5f997335029b4a5614abd415a88a8cda7f7452f4b3';

-- Invalidate the contatoricardodiniz@gmail.com password only if still default
UPDATE users SET password_hash = 'INVALIDATED_CHANGE_VIA_PLATFORM_ADMIN', updated_at = datetime('now')
WHERE email = 'contatoricardodiniz@gmail.com'
  AND password_hash = '455a9e187f0eafe76440d8c48bca07f9804bdf5e263537c45b17a600b95df922';
