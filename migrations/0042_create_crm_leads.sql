-- CRM Leads for platform-level prospecting
CREATE TABLE IF NOT EXISTS crm_leads (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	company_name TEXT NOT NULL,
	contact_name TEXT NOT NULL,
	contact_role TEXT,
	email TEXT,
	whatsapp TEXT,
	social_profile TEXT,
	address TEXT,
	latitude REAL,
	longitude REAL,
	location_type TEXT,
	status TEXT NOT NULL DEFAULT 'novo',
	loss_reason TEXT,
	lead_source TEXT DEFAULT 'ativo',
	last_contact_at TEXT,
	next_followup_at TEXT,
	flow_potential TEXT DEFAULT 'medio',
	has_competition INTEGER DEFAULT 0,
	map_embed TEXT,
	estimated_value_cents INTEGER DEFAULT 0,
	converted_tenant_id INTEGER REFERENCES tenants(id),
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_crm_leads_status ON crm_leads(status);
CREATE INDEX idx_crm_leads_next_followup ON crm_leads(next_followup_at);
CREATE INDEX idx_crm_leads_search ON crm_leads(company_name, contact_name);

-- Interaction timeline with mandatory next step
CREATE TABLE IF NOT EXISTS crm_lead_notes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	lead_id INTEGER NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
	user_id INTEGER NOT NULL,
	user_name TEXT NOT NULL,
	note TEXT NOT NULL,
	next_step TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_crm_lead_notes_lead ON crm_lead_notes(lead_id);
