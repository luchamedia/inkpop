-- Add metadata columns to sources for rich source cards
ALTER TABLE sources ADD COLUMN IF NOT EXISTS meta_title text;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS meta_description text;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS favicon_url text;
