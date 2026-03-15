-- Migration number: 0019   Battery management for electric assets

-- Flag per-asset: whether this asset uses removable batteries
ALTER TABLE assets ADD COLUMN uses_battery INTEGER NOT NULL DEFAULT 0;

-- Individual battery inventory
CREATE TABLE batteries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL UNIQUE,
    asset_id INTEGER,
    status TEXT NOT NULL DEFAULT 'ready'
        CHECK (status IN ('charging', 'ready', 'in_use', 'depleted', 'retired')),
    full_charge_minutes INTEGER NOT NULL DEFAULT 90,
    estimated_minutes_remaining INTEGER NOT NULL DEFAULT 90,
    last_charged_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL
);

CREATE INDEX idx_batteries_asset ON batteries(asset_id);
CREATE INDEX idx_batteries_status ON batteries(status);
