-- CRM enhancements: tags, structured loss reasons, funnel velocity
ALTER TABLE crm_leads ADD COLUMN tags TEXT;
ALTER TABLE crm_leads ADD COLUMN temperature TEXT DEFAULT 'morno';
