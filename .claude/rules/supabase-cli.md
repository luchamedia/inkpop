# Supabase CLI Rules (Always-On)

Before running ANY Supabase CLI command (`supabase db push`, `supabase migration *`, `supabase migration repair`, etc.):

1. Load the `supabase-cli` skill first — it contains project-specific setup, naming conventions, and troubleshooting for known issues
2. Use **14-digit timestamps** for migration filenames (e.g., `20260325120000_description.sql`) to avoid version collisions
3. Write **idempotent SQL** (`IF NOT EXISTS`, `CREATE OR REPLACE`) so migrations are safe to re-run
4. After pushing migrations, run `supabase migration list` to verify local/remote are in sync