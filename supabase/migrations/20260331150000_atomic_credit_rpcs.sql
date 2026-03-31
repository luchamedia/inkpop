-- Atomic credit RPCs: combine balance updates with transaction logging
-- Replaces separate increment/deduct + manual INSERT pattern

-- Atomic credit addition with transaction logging
CREATE OR REPLACE FUNCTION add_credit_with_log(
  user_id_input uuid,
  amount_input integer,
  reference_id_input text DEFAULT NULL,
  type_input text DEFAULT 'purchase'
)
RETURNS integer AS $$
DECLARE
  bal integer;
BEGIN
  UPDATE users SET credit_balance = credit_balance + amount_input
  WHERE id = user_id_input
  RETURNING credit_balance INTO bal;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', user_id_input;
  END IF;

  INSERT INTO credit_transactions (user_id, amount, balance_after, type, reference_id)
  VALUES (user_id_input, amount_input, bal, type_input, reference_id_input);

  RETURN bal;
END;
$$ LANGUAGE plpgsql;

-- Atomic credit deduction with transaction logging (prevents overdraw)
-- Returns new balance on success, NULL if insufficient balance
CREATE OR REPLACE FUNCTION deduct_credit_with_log(
  user_id_input uuid,
  amount_input integer,
  site_id_input uuid DEFAULT NULL,
  type_input text DEFAULT 'generation'
)
RETURNS integer AS $$
DECLARE
  bal integer;
BEGIN
  UPDATE users SET credit_balance = credit_balance - amount_input
  WHERE id = user_id_input AND credit_balance >= amount_input
  RETURNING credit_balance INTO bal;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO credit_transactions (user_id, amount, balance_after, type, site_id)
  VALUES (user_id_input, -amount_input, bal, type_input, site_id_input);

  RETURN bal;
END;
$$ LANGUAGE plpgsql;

-- Updated set_free_credit_floor: now also logs the transaction
CREATE OR REPLACE FUNCTION set_free_credit_floor(
  user_id_input uuid,
  floor_amount integer
)
RETURNS integer AS $$
DECLARE
  old_bal integer;
  new_bal integer;
BEGIN
  SELECT credit_balance INTO old_bal FROM users WHERE id = user_id_input FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', user_id_input;
  END IF;

  new_bal := GREATEST(old_bal, floor_amount);

  UPDATE users SET credit_balance = new_bal, monthly_credits_granted_at = now()
  WHERE id = user_id_input;

  -- Only log if balance actually changed
  IF new_bal > old_bal THEN
    INSERT INTO credit_transactions (user_id, amount, balance_after, type, reference_id)
    VALUES (user_id_input, new_bal - old_bal, new_bal, 'free_monthly',
            'monthly_' || to_char(now(), 'YYYY-MM'));
  END IF;

  RETURN new_bal;
END;
$$ LANGUAGE plpgsql;

-- Updated claim_next_queue_job: FOR UPDATE SKIP LOCKED for proper queue semantics
CREATE OR REPLACE FUNCTION claim_next_queue_job(site_id_input uuid)
RETURNS SETOF generation_queue AS $$
  UPDATE generation_queue
  SET status = 'processing', started_at = now()
  WHERE id = (
    SELECT id FROM generation_queue
    WHERE site_id = site_id_input AND status = 'queued'
    ORDER BY position ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  AND status = 'queued'
  RETURNING *;
$$ LANGUAGE sql;

-- Revoke public access to credit RPCs — only service_role should call these
REVOKE EXECUTE ON FUNCTION add_credit_with_log FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION deduct_credit_with_log FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION set_free_credit_floor FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION claim_next_queue_job FROM anon, authenticated;
