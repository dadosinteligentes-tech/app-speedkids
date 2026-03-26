-- Email sending log for tracking and auditing
CREATE TABLE IF NOT EXISTS email_logs (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	tenant_id INTEGER,
	recipient TEXT NOT NULL,
	subject TEXT NOT NULL,
	event_type TEXT NOT NULL,        -- 'welcome', 'payment_failed', 'subscription_cancelled', etc.
	status TEXT NOT NULL DEFAULT 'sent',  -- 'sent', 'failed', 'skipped'
	error_message TEXT,
	metadata TEXT,                    -- JSON with extra context
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_email_logs_tenant ON email_logs(tenant_id);
CREATE INDEX idx_email_logs_recipient ON email_logs(recipient);
CREATE INDEX idx_email_logs_event ON email_logs(event_type);
