# Documentation Sync Rules (Always-On)

When any major decision, architectural change, or significant feature is added/modified, update ALL affected documentation **in the same commit**. Docs should never drift from reality.

## What Triggers a Doc Update

- New or removed env variables
- New or changed API routes/endpoints
- New or changed database tables/columns
- Tech stack additions or replacements (libraries, services)
- Auth, billing, or middleware behavior changes
- New or changed cron jobs or webhooks
- New or changed AI generation flow
- Major component pattern changes
- New skills, rules, or agents added to `.claude/`

## Documents to Check

| Document | What to update |
|----------|---------------|
| `CLAUDE.md` | Architecture, tech stack, env vars table, route structure, key flows, commands |
| `README.md` | Tech stack, project structure tree, setup instructions, architecture diagram |
| `.env.example` | Add/remove env var entries (never include actual values) |
| `.claude/plans/SETUP.md` | Database schema, service setup steps |
| `.claude/rules/*.md` | Security rules, git workflow, or this file if processes change |
| `.claude/skills/*/SKILL.md` | Skill instructions if the patterns they describe have changed |
| `MEMORY.md` | Key decisions, build fixes, flow changes (auto-memory) |
| `vercel.json` | Cron schedules, rewrites, if deployment config changes |

## Rules

1. **Same commit** — doc updates ship with the code change, not as a follow-up
2. **Only update what changed** — don't rewrite entire files for a one-line addition
3. **Keep it concise** — match the existing style of each document (tables, bullet points, code blocks)
4. **No stale references** — if you remove a feature, remove it from ALL docs listed above
5. **Env vars are critical** — adding a new env var without updating `.env.example` and the CLAUDE.md table is a build-breaking omission for new contributors