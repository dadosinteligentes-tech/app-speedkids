-- Document templates for thermal printing (terms, waivers, agreements)
CREATE TABLE IF NOT EXISTS document_templates (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	tenant_id INTEGER NOT NULL REFERENCES tenants(id),
	name TEXT NOT NULL,
	description TEXT,
	content TEXT NOT NULL,
	print_mode TEXT NOT NULL DEFAULT 'optional',
	is_active INTEGER DEFAULT 1,
	sort_order INTEGER DEFAULT 0,
	created_at TEXT DEFAULT (datetime('now')),
	updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_doc_templates_tenant ON document_templates(tenant_id);

-- Track which documents were printed per rental session
CREATE TABLE IF NOT EXISTS rental_signed_documents (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	rental_session_id TEXT NOT NULL,
	template_id INTEGER NOT NULL REFERENCES document_templates(id),
	tenant_id INTEGER NOT NULL REFERENCES tenants(id),
	printed_at TEXT NOT NULL DEFAULT (datetime('now')),
	printed_by INTEGER REFERENCES users(id)
);

CREATE INDEX idx_rental_signed_tenant ON rental_signed_documents(tenant_id);
CREATE INDEX idx_rental_signed_session ON rental_signed_documents(rental_session_id);
