-- Add metadata columns to source_suggestions for rich cards
ALTER TABLE source_suggestions ADD COLUMN IF NOT EXISTS meta_title text;
ALTER TABLE source_suggestions ADD COLUMN IF NOT EXISTS meta_description text;
ALTER TABLE source_suggestions ADD COLUMN IF NOT EXISTS favicon_url text;
ALTER TABLE source_suggestions ADD COLUMN IF NOT EXISTS og_image_url text;
