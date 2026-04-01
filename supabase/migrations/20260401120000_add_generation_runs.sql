-- Track MindStudio agent dispatches and deliveries for failure recovery
CREATE TABLE IF NOT EXISTS generation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL,
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'dispatched',
  expected_posts integer NOT NULL DEFAULT 0,
  delivered_posts integer DEFAULT 0,
  errors jsonb DEFAULT '[]',
  dispatched_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chk_generation_runs_status CHECK (status IN ('dispatched', 'completed', 'partial', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_generation_runs_run ON generation_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_generation_runs_stale ON generation_runs(dispatched_at) WHERE status = 'dispatched';
