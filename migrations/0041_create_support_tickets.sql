-- Support ticket system for tenant <-> platform communication
CREATE TABLE IF NOT EXISTS support_tickets (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	tenant_id INTEGER NOT NULL REFERENCES tenants(id),
	subject TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'open',          -- open, awaiting_reply, resolved, closed
	priority TEXT NOT NULL DEFAULT 'normal',      -- low, normal, high, urgent
	created_by INTEGER NOT NULL REFERENCES users(id),
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_support_tickets_tenant ON support_tickets(tenant_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);

CREATE TABLE IF NOT EXISTS ticket_messages (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	ticket_id INTEGER NOT NULL REFERENCES support_tickets(id),
	sender_type TEXT NOT NULL,                    -- tenant, platform
	sender_id INTEGER NOT NULL REFERENCES users(id),
	sender_name TEXT NOT NULL,
	message TEXT NOT NULL,
	attachment_key TEXT,                           -- R2 object key
	attachment_name TEXT,                          -- original filename
	attachment_type TEXT,                          -- MIME type
	read INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ticket_messages_ticket ON ticket_messages(ticket_id);
