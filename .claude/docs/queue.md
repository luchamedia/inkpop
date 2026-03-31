# Generation Queue

Async post generation via the `generation_queue` table. Jobs are added instantly and processed sequentially per site in the background.

- **Job types:** `idea` (from post_ideas), `topic` (custom topic), `scheduled` (from daily cron)
- **Processing:** `POST /api/queue/process` claims the next job via `claim_next_queue_job()` RPC (atomic, uses `FOR UPDATE SKIP LOCKED` for safe concurrency), runs generation, self-chains to process the next job
- **Three triggers:** (1) fire-and-forget fetch on add, (2) self-chaining after each job, (3) `GET /api/cron/process-queue` every 2 min (safety net)
- **Credit flow:** credits reserved (deducted) at queue time, refunded on cancellation or final failure (3 retries)
- **Stale detection:** jobs stuck in `processing` > 5 min are retried or failed
- **UI:** Queue sub-tab in Content Inbox (`src/components/site-dashboard/queue-list.tsx`) with 5s polling
- **Status lifecycle:** `queued` → `processing` → `completed` or `failed`
- Completed posts go to Drafts or Published based on `site.auto_publish`
