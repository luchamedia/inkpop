-- Expand post_ideas with richer metadata from ideation prompt
ALTER TABLE post_ideas ADD COLUMN IF NOT EXISTS meta_description text;
ALTER TABLE post_ideas ADD COLUMN IF NOT EXISTS keywords jsonb DEFAULT '[]';
ALTER TABLE post_ideas ADD COLUMN IF NOT EXISTS slug text;
