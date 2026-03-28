-- Fix: owner was missing documents permissions from migration 0045
INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES
    ('owner', 'documents.manage'),
    ('owner', 'documents.print');
