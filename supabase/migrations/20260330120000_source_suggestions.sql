-- Persist AI-generated source suggestions per site
CREATE TABLE IF NOT EXISTS source_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  url text NOT NULL,
  label text NOT NULL,
  reason text,
  status text DEFAULT 'active',    -- active | dismissed | accepted
  search_query text,               -- the query that found this (for debugging)
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_source_suggestions_site_status
  ON source_suggestions(site_id, status);
