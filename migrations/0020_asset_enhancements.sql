-- Asset enhancements: weight limit, age range, display order
ALTER TABLE assets ADD COLUMN max_weight_kg REAL;
ALTER TABLE assets ADD COLUMN min_age INTEGER;
ALTER TABLE assets ADD COLUMN max_age INTEGER;
ALTER TABLE assets ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
