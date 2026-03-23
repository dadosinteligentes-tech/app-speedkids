-- Multi-tenancy: create tenants table and seed first tenant (SpeedKids)

CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  plan TEXT NOT NULL DEFAULT 'pro',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#FF7043',
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  owner_email TEXT NOT NULL,
  max_users INTEGER DEFAULT 10,
  max_assets INTEGER DEFAULT 50,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed SpeedKids as tenant #1
INSERT INTO tenants (id, slug, name, owner_email, plan, primary_color, logo_url)
VALUES (1, 'speedykids', 'SPEEDY KIDS LOCACOES RECREATIVAS LTDA', 'contato.speedykids@gmail.com', 'pro', '#FF7043', '/logo.svg');
