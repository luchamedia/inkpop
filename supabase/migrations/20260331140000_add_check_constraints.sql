-- Add CHECK constraints to status columns and critical numeric fields

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_posts_status') THEN
    ALTER TABLE posts ADD CONSTRAINT chk_posts_status CHECK (status IN ('draft', 'published'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_generation_queue_status') THEN
    ALTER TABLE generation_queue ADD CONSTRAINT chk_generation_queue_status CHECK (status IN ('queued', 'processing', 'completed', 'failed'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_generation_queue_job_type') THEN
    ALTER TABLE generation_queue ADD CONSTRAINT chk_generation_queue_job_type CHECK (job_type IN ('idea', 'topic', 'scheduled'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_post_ideas_status') THEN
    ALTER TABLE post_ideas ADD CONSTRAINT chk_post_ideas_status CHECK (status IN ('active', 'queued', 'used', 'expired'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_source_suggestions_status') THEN
    ALTER TABLE source_suggestions ADD CONSTRAINT chk_source_suggestions_status CHECK (status IN ('active', 'dismissed', 'accepted'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_users_credit_balance_non_negative') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_credit_balance_non_negative CHECK (credit_balance >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_generation_queue_retry_count') THEN
    ALTER TABLE generation_queue ADD CONSTRAINT chk_generation_queue_retry_count CHECK (retry_count >= 0 AND retry_count <= 5);
  END IF;
END $$;
