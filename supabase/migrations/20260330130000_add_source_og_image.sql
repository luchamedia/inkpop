-- Add OG image column to sources for rich source cards
ALTER TABLE sources ADD COLUMN IF NOT EXISTS og_image_url text;
