# Security Rules (Always-On)

These rules apply to every code change in the inkpop project.

## Environment Variables
- NEVER log, print, or expose environment variables in responses, error messages, or client-side code
- Only variables prefixed with `NEXT_PUBLIC_` are safe for client-side code
- Server-only secrets: `CLERK_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MINDSTUDIO_API_KEY`, `CRON_SECRET`
- Never hardcode API keys, tokens, or secrets in source code — always use `process.env`

## HTML Rendering
- All user-generated or AI-generated HTML rendered via `dangerouslySetInnerHTML` MUST be sanitized with `sanitize-html` first
- Review the `sanitize-html` config to ensure dangerous tags/attributes are stripped (script, iframe, onload, onerror, etc.)

## Authentication & Authorization
- Every authenticated API route MUST call `getAuthUser()` from `@/lib/auth` as its first operation
- Every resource access MUST verify ownership (sites: `user_id === user.id`; posts: join through `sites!inner(user_id)`)
- The Supabase service role key bypasses ALL Row Level Security — ownership checks in application code are the ONLY protection
- Never trust client-provided IDs without verifying ownership server-side

## Stripe Webhooks
- Stripe webhook handlers MUST verify signatures using `stripe.webhooks.constructEvent()`
- Use `req.text()` for raw body — `req.json()` breaks signature verification
- Never trust webhook event data without signature verification

## Subdomain Input
- Subdomain values extracted from the `host` header in middleware are untrusted user input
- Validate and sanitize subdomain values before using them in database queries

## Cron Endpoint
- The cron endpoint at `/api/cron/daily-run` MUST check `Authorization: Bearer {CRON_SECRET}`
- It is listed in the public route matcher and is accessible without Clerk auth

## Input Validation
- Always validate and sanitize user input in API routes before database operations
- Never pass raw user input directly to Supabase queries without validation
