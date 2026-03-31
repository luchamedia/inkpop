-- Generation queue for async post generation
CREATE TABLE IF NOT EXISTS generation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,

  -- What to generate
  job_type text NOT NULL,              -- 'idea' | 'topic' | 'scheduled'
  idea_id uuid REFERENCES post_ideas(id) ON DELETE SET NULL,
  topic text,                           -- for job_type='topic'

  -- Status tracking
  status text NOT NULL DEFAULT 'queued', -- 'queued' | 'processing' | 'completed' | 'failed'
  position integer NOT NULL,

  -- Results
  post_id uuid REFERENCES posts(id) ON DELETE SET NULL,
  error_message text,
  retry_count integer DEFAULT 0,

  -- Credit tracking
  credits_reserved integer NOT NULL DEFAULT 1,
  credits_refunded boolean DEFAULT false,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_queue_site_status ON generation_queue(site_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_processing ON generation_queue(status, started_at);

-- Atomic claim: grab the next queued job for a site, preventing double-processing
CREATE OR REPLACE FUNCTION claim_next_queue_job(site_id_input uuid)
RETURNS SETOF generation_queue AS $$
  UPDATE generation_queue
  SET status = 'processing', started_at = now()
  WHERE id = (
    SELECT id FROM generation_queue
    WHERE site_id = site_id_input AND status = 'queued'
    ORDER BY position ASC
    LIMIT 1
  )
  AND status = 'queued'
  RETURNING *;
$$ LANGUAGE sql;
