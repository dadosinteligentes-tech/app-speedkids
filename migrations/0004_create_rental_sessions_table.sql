-- Migration number: 0004   SpeedKids - Rental Sessions (core entity)
CREATE TABLE IF NOT EXISTS rental_sessions (
    id TEXT PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(id),
    package_id INTEGER NOT NULL REFERENCES packages(id),
    pos_id INTEGER,
    attendant_id INTEGER,
    cash_register_id INTEGER,

    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'paused', 'completed', 'cancelled')),
    start_time TEXT NOT NULL,
    pause_time TEXT,
    total_paused_ms INTEGER NOT NULL DEFAULT 0,
    end_time TEXT,
    duration_minutes INTEGER NOT NULL,

    amount_cents INTEGER NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('cash', 'credit', 'debit', 'pix')),
    paid INTEGER NOT NULL DEFAULT 0,

    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_rental_sessions_asset ON rental_sessions(asset_id);
CREATE INDEX idx_rental_sessions_status ON rental_sessions(status);
CREATE INDEX idx_rental_sessions_start ON rental_sessions(start_time);

-- Pause/resume history
CREATE TABLE IF NOT EXISTS session_pauses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES rental_sessions(id),
    paused_at TEXT NOT NULL,
    resumed_at TEXT,
    duration_ms INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_session_pauses_session ON session_pauses(session_id);
