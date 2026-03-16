-- Allow naming shifts (e.g. Manha, Tarde, Noite)
ALTER TABLE shifts ADD COLUMN name TEXT;
