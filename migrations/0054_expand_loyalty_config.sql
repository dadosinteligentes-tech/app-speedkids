-- Expand loyalty config with expiration, bonus rules, and redemption options
ALTER TABLE loyalty_config ADD COLUMN expiry_months INTEGER DEFAULT 0;
ALTER TABLE loyalty_config ADD COLUMN bonus_first_purchase INTEGER NOT NULL DEFAULT 0;
ALTER TABLE loyalty_config ADD COLUMN bonus_birthday INTEGER NOT NULL DEFAULT 0;
ALTER TABLE loyalty_config ADD COLUMN bonus_referral INTEGER NOT NULL DEFAULT 0;
ALTER TABLE loyalty_config ADD COLUMN double_points_weekends INTEGER NOT NULL DEFAULT 0;
ALTER TABLE loyalty_config ADD COLUMN redemption_options_json TEXT;
