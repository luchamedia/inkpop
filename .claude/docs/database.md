# Database Schema

11 tables, created manually in Supabase SQL Editor. No RLS — ownership enforced in application code.

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id text UNIQUE NOT NULL,
  email text NOT NULL,
  name text,
  stripe_customer_id text,
  subscription_status text DEFAULT 'inactive',
  credit_balance integer DEFAULT 0 NOT NULL,
  auto_renew boolean DEFAULT false,
  auto_renew_pack text DEFAULT null,
  monthly_credits_granted_at timestamptz,
  created_at timestamptz DEFAULT now()
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
  generation_run_id uuid REFERENCES generation_runs(id) ON DELETE SET NULL,
  idea_id uuid REFERENCES post_ideas(id) ON DELETE SET NULL
);

CREATE TABLE source_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES sources(id) ON DELETE CASCADE NOT NULL,
  content_hash text NOT NULL,
  content_preview text,
  scraped_at timestamptz DEFAULT now()
);

CREATE TABLE source_learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  learnings jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE generation_runs (
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

CREATE TABLE post_ideas (
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
  created_at timestamptz DEFAULT now()
);

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
  completed_at timestamptz
);
```

## Supabase RPC Functions

Required for atomic credit operations and queue processing.

```sql
-- Atomic credit increment
CREATE OR REPLACE FUNCTION increment_credit_balance(user_id_input uuid, amount integer)
RETURNS integer AS $$
  UPDATE users SET credit_balance = credit_balance + amount
  WHERE id = user_id_input
  RETURNING credit_balance;
$$ LANGUAGE sql;

-- Atomic conditional credit deduction (prevents overdraw)
CREATE OR REPLACE FUNCTION deduct_credit_balance(user_id_input uuid, amount integer)
RETURNS integer AS $$
  UPDATE users SET credit_balance = credit_balance - amount
  WHERE id = user_id_input AND credit_balance >= amount
  RETURNING credit_balance;
$$ LANGUAGE sql;

-- Monthly free credit floor (no stacking: GREATEST(balance, floor))
CREATE OR REPLACE FUNCTION set_free_credit_floor(user_id_input uuid, floor_amount integer)
RETURNS integer AS $$
  UPDATE users
  SET credit_balance = GREATEST(credit_balance, floor_amount),
      monthly_credits_granted_at = now()
  WHERE id = user_id_input
  RETURNING credit_balance;
$$ LANGUAGE sql;

-- Atomic queue job claim (prevents double-processing)
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
```
