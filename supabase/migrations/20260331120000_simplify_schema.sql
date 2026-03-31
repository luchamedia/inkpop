-- Collapse source_snapshots into sources
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_content_hash text;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_scraped_at timestamptz;

-- Migrate latest snapshot per source
UPDATE sources s SET
  last_content_hash = ss.content_hash,
  last_scraped_at = ss.scraped_at
FROM (
  SELECT DISTINCT ON (source_id) source_id, content_hash, scraped_at
  FROM source_snapshots ORDER BY source_id, scraped_at DESC
) ss WHERE s.id = ss.source_id;

DROP TABLE IF EXISTS source_snapshots;

-- Drop generation_runs (remove FK refs first)
ALTER TABLE posts DROP COLUMN IF EXISTS generation_run_id;
ALTER TABLE post_ideas DROP COLUMN IF EXISTS generation_run_id;
DROP TABLE IF EXISTS generation_runs;

-- Remove dead column
ALTER TABLE users DROP COLUMN IF EXISTS subscription_status;
