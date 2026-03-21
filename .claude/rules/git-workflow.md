# Git & Deployment Rules (Always-On)

These rules apply to all git operations and deployment tasks in the inkpop project.

## Pre-Commit Checks
- Run `pnpm build` before committing — catches TypeScript errors and import issues
- Run `pnpm lint` before committing — catches ESLint violations
- Underscore-prefixed args (`_req`, `_params`) are the convention for unused parameters

## Commit Messages
- Use imperative mood: "Add feature" not "Added feature" or "Adds feature"
- Keep under 72 characters
- Describe the "what" not the "how"

## Branch Naming
- Feature branches: `feat/<description>`
- Bug fixes: `fix/<description>`
- Maintenance: `chore/<description>`

## Deployment
- Deployment is automatic via Vercel on push to `main`
- Environment variables for production are set in the Vercel dashboard, never committed
- The domain `inkpop.net` redirects to `www.inkpop.net` — test with both in mind
- Check `vercel.json` when adding new cron jobs or rewrites

## Sensitive Files
- Never commit `.env.local` (contains all API keys)
- The `.env.example` template should be updated when new env vars are added
- Never commit `node_modules/`, `.next/`, or `.DS_Store`
