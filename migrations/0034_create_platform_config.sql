-- Platform-level configuration (plan definitions, etc.)
CREATE TABLE IF NOT EXISTS platform_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default plan definitions
INSERT INTO platform_config (key, value) VALUES ('plan_limits', '{
  "starter": { "label": "Starter", "maxUsers": 3, "maxAssets": 15, "priceCents": 9700 },
  "pro": { "label": "Pro", "maxUsers": 10, "maxAssets": 50, "priceCents": 19700 },
  "enterprise": { "label": "Enterprise", "maxUsers": 999, "maxAssets": 999, "priceCents": 39700 }
}');
