-- Add missing indexes for common query patterns
-- Covers: blog listing, dashboard tabs, public post lookup, ownership queries,
--         source listing, idea FK lookups, and queue job detection/history.

----------------------------------------------------------------------
-- AC-1: posts(site_id, status, published_at DESC)
-- Used by: blog listing, dashboard published tab, sitemap
----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_posts_site_status_published
  ON posts(site_id, status, published_at DESC);

----------------------------------------------------------------------
-- AC-2: posts(site_id, status, generated_at DESC)
-- Used by: dashboard drafts tab
----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_posts_site_status_generated
  ON posts(site_id, status, generated_at DESC);

----------------------------------------------------------------------
-- AC-3: UNIQUE index on posts(site_id, slug)
-- Used by: public blog post lookup (/blog/[subdomain]/[slug])
-- Enforces slug uniqueness per site
-- NOTE: If duplicates exist, this will fail. In that case, deduplicate
-- first: SELECT site_id, slug, count(*) FROM posts GROUP BY site_id, slug HAVING count(*) > 1;
----------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_site_slug
  ON posts(site_id, slug);

----------------------------------------------------------------------
-- AC-4: sites(user_id)
-- Used by: every dashboard page load queries sites by user_id
----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sites_user
  ON sites(user_id);

----------------------------------------------------------------------
-- AC-5: sources(site_id)
-- Used by: source listing, cron joins
----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sources_site
  ON sources(site_id);

----------------------------------------------------------------------
-- AC-6: Partial index on posts(idea_id) WHERE idea_id IS NOT NULL
-- Used by: FK cascade performance when deleting post_ideas
----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_posts_idea
  ON posts(idea_id) WHERE idea_id IS NOT NULL;

----------------------------------------------------------------------
-- AC-7: Replace idx_queue_processing with a partial index
-- Old index scanned all rows; partial index only indexes processing jobs
----------------------------------------------------------------------
DROP INDEX IF EXISTS idx_queue_processing;

CREATE INDEX IF NOT EXISTS idx_queue_processing
  ON generation_queue(started_at) WHERE status = 'processing';

----------------------------------------------------------------------
-- AC-8: Partial index for queue history queries (completed + failed)
-- Used by: queue history list on site dashboard
----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_queue_history
  ON generation_queue(site_id, completed_at DESC)
  WHERE status IN ('completed', 'failed');
