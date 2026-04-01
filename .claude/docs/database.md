# Database Schema

10 tables, created manually in Supabase SQL Editor. No RLS — ownership enforced in application code.

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id text UNIQUE NOT NULL,
  email text NOT NULL,
  name text,
  stripe_customer_id text,
  credit_balance integer DEFAULT 0 NOT NULL,
  auto_renew boolean DEFAULT false,
  auto_renew_pack text DEFAULT null,
  monthly_credits_granted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chk_users_credit_balance_non_negative CHECK (credit_balance >= 0)
);

CREATE TABLE sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  subdomain text UNIQUE NOT NULL,
  topic text,
  topic_context jsonb,
  description text,
  category text,
  posting_schedule text DEFAULT 'weekly',
  posts_per_period integer DEFAULT 1,
  auto_publish boolean DEFAULT true,
  schedule_confirmed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  type text NOT NULL,
  url text NOT NULL,
  label text,
  last_content_hash text,
  last_scraped_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  body text NOT NULL,
  meta_description text,
  status text DEFAULT 'draft',
  generated_at timestamptz DEFAULT now(),
  published_at timestamptz,
  idea_id uuid REFERENCES post_ideas(id) ON DELETE SET NULL,
  CONSTRAINT chk_posts_status CHECK (status IN ('draft', 'published'))
);

CREATE TABLE source_learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  learnings jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE post_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  angle text NOT NULL,
  key_learnings jsonb NOT NULL,
  status text DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chk_post_ideas_status CHECK (status IN ('active', 'queued', 'used', 'expired'))
);

CREATE TABLE credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  type text NOT NULL,
  reference_id text,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE source_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  url text NOT NULL,
  label text NOT NULL,
  reason text,
  status text DEFAULT 'active',    -- active | dismissed | accepted
  search_query text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chk_source_suggestions_status CHECK (status IN ('active', 'dismissed', 'accepted'))
);

-- Tracks MindStudio agent dispatches and deliveries (replaces generation_queue for new flow)
CREATE TABLE generation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL,
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'dispatched', -- dispatched | completed | partial | failed
  expected_posts integer NOT NULL DEFAULT 0,
  delivered_posts integer DEFAULT 0,
  errors jsonb DEFAULT '[]',
  dispatched_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chk_generation_runs_status CHECK (status IN ('dispatched', 'completed', 'partial', 'failed'))
);

-- Legacy: being phased out in favor of generation_runs
CREATE TABLE generation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  job_type text NOT NULL,              -- 'idea' | 'topic' | 'scheduled'
  idea_id uuid REFERENCES post_ideas(id) ON DELETE SET NULL,
  topic text,
  status text NOT NULL DEFAULT 'queued', -- 'queued' | 'processing' | 'completed' | 'failed'
  position integer NOT NULL,
  post_id uuid REFERENCES posts(id) ON DELETE SET NULL,
  error_message text,
  retry_count integer DEFAULT 0,
  credits_reserved integer NOT NULL DEFAULT 1,
  credits_refunded boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT chk_generation_queue_status CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  CONSTRAINT chk_generation_queue_job_type CHECK (job_type IN ('idea', 'topic', 'scheduled')),
  CONSTRAINT chk_generation_queue_retry_count CHECK (retry_count >= 0 AND retry_count <= 5)
);
```

## Indexes

```sql
-- Posts: blog listing, dashboard published tab, sitemap
CREATE INDEX idx_posts_site_status_published ON posts(site_id, status, published_at DESC);

-- Posts: dashboard drafts tab
CREATE INDEX idx_posts_site_status_generated ON posts(site_id, status, generated_at DESC);

-- Posts: public blog post lookup, enforces slug uniqueness per site
CREATE UNIQUE INDEX idx_posts_site_slug ON posts(site_id, slug);

-- Posts: FK cascade performance for post_ideas deletion
CREATE INDEX idx_posts_idea ON posts(idea_id) WHERE idea_id IS NOT NULL;

-- Sites: dashboard page loads
CREATE INDEX idx_sites_user ON sites(user_id);

-- Sources: source listing, cron joins
CREATE INDEX idx_sources_site ON sources(site_id);

-- Queue: stale job detection (partial — only processing jobs)
CREATE INDEX idx_queue_processing ON generation_queue(started_at) WHERE status = 'processing';

-- Queue: history list on site dashboard (partial — completed + failed)
CREATE INDEX idx_queue_history ON generation_queue(site_id, completed_at DESC) WHERE status IN ('completed', 'failed');

-- Generation runs: group by run ID
CREATE INDEX idx_generation_runs_run ON generation_runs(run_id);

-- Generation runs: stale detection (dispatched but never delivered)
CREATE INDEX idx_generation_runs_stale ON generation_runs(dispatched_at) WHERE status = 'dispatched';
```

## Supabase RPC Functions

Atomic credit operations and queue processing. All RPCs have `EXECUTE` revoked from `anon` and `authenticated` roles — only callable via the service role key.

```sql
-- Atomic credit addition with transaction logging
-- Increments balance and inserts a credit_transactions row in one call
CREATE OR REPLACE FUNCTION add_credit_with_log(
  user_id_input uuid,
  amount_input integer,
  reference_id_input text DEFAULT NULL,
  type_input text DEFAULT 'purchase'
) RETURNS integer AS $$ ... $$ LANGUAGE plpgsql;

-- Atomic credit deduction with transaction logging (prevents overdraw)
-- Returns new balance on success, NULL if insufficient balance
CREATE OR REPLACE FUNCTION deduct_credit_with_log(
  user_id_input uuid,
  amount_input integer,
  site_id_input uuid DEFAULT NULL,
  type_input text DEFAULT 'generation'
) RETURNS integer AS $$ ... $$ LANGUAGE plpgsql;

-- Monthly free credit floor (no stacking: GREATEST(balance, floor))
-- Now also logs a credit_transactions row if balance actually changed
CREATE OR REPLACE FUNCTION set_free_credit_floor(user_id_input uuid, floor_amount integer)
RETURNS integer AS $$ ... $$ LANGUAGE plpgsql;

-- Atomic queue job claim (prevents double-processing)
-- Uses FOR UPDATE SKIP LOCKED for proper concurrent queue semantics
CREATE OR REPLACE FUNCTION claim_next_queue_job(site_id_input uuid)
RETURNS SETOF generation_queue AS $$ ... $$ LANGUAGE sql;
```

### Legacy RPCs (replaced, no longer called by application code)
- `increment_credit_balance` — replaced by `add_credit_with_log`
- `deduct_credit_balance` — replaced by `deduct_credit_with_log`
