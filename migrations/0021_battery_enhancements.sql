-- Battery charging time field (how long to fully charge, default 8h = 480min)
ALTER TABLE batteries ADD COLUMN charge_time_minutes INTEGER NOT NULL DEFAULT 480;
