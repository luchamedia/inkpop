-- Phase 1: Onboarding Revamp — New columns + RPC function
-- Run in Supabase SQL Editor

-- Users: display name + monthly free credit tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_credits_granted_at timestamptz;

-- Sites: topic context from onboarding, posting schedule
ALTER TABLE sites ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS topic_context jsonb;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS posting_schedule text DEFAULT 'weekly';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS posts_per_period integer DEFAULT 1;

-- New RPC: set credit floor for monthly free tier (no stacking)
-- GREATEST(balance, floor) means: if balance < 5, set to 5; if >= 5, leave unchanged
CREATE OR REPLACE FUNCTION set_free_credit_floor(user_id_input uuid, floor_amount integer)
RETURNS integer AS $$
  UPDATE users
  SET credit_balance = GREATEST(credit_balance, floor_amount),
      monthly_credits_granted_at = now()
  WHERE id = user_id_input
  RETURNING credit_balance;
$$ LANGUAGE sql;