-- Generation Workflow v2: smart content scanning, learnings, ideas, auto-publish

-- Track scraped content hashes to detect new content
CREATE TABLE IF NOT EXISTS source_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES sources(id) ON DELETE CASCADE NOT NULL,
  content_hash text NOT NULL,
  content_preview text,
  scraped_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_source_snapshots_source ON source_snapshots(source_id);

-- Extracted insights from scraped content, accumulated over time
CREATE TABLE IF NOT EXISTS source_learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  learnings jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_source_learnings_site ON source_learnings(site_id);

-- Audit trail for each generation run
CREATE TABLE IF NOT EXISTS generation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  sources_scanned integer DEFAULT 0,
  new_content_found integer DEFAULT 0,
  learnings_extracted integer DEFAULT 0,
  ideas_generated integer DEFAULT 0,
  posts_generated integer DEFAULT 0,
  credit_deducted boolean DEFAULT false,
  status text DEFAULT 'running',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_generation_runs_site ON generation_runs(site_id);

-- Article ideas with 2-week shelf life, generated in batches of ~20
CREATE TABLE IF NOT EXISTS post_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  generation_run_id uuid REFERENCES generation_runs(id) ON DELETE SET NULL,
  title text NOT NULL,
  angle text NOT NULL,
  key_learnings jsonb NOT NULL,
  status text DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_post_ideas_site ON post_ideas(site_id);
CREATE INDEX IF NOT EXISTS idx_post_ideas_expires ON post_ideas(expires_at);

-- New columns on existing tables
ALTER TABLE sites ADD COLUMN IF NOT EXISTS auto_publish boolean DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS generation_run_id uuid REFERENCES generation_runs(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS idea_id uuid REFERENCES post_ideas(id) ON DELETE SET NULL;
