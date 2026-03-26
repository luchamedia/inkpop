-- Add credit balance to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_balance integer DEFAULT 0 NOT NULL;

-- Credit transaction ledger
CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  type text NOT NULL,
  reference_id text,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_created ON credit_transactions(created_at);

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
