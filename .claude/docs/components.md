# Component Patterns

- **Server components** for data fetching (dashboard pages query Supabase directly)
- **Client components** (`"use client"`) for interactivity (onboarding wizard, post editor)
- New site wizard (`src/components/new-site/new-site-wizard.tsx`): 2-step flow — `StepTopic` (AI topic brief with follow-up questions) → `StepName` (AI-suggested names + subdomain). Sources are managed post-creation in the dashboard Sources tab.
- Setup progress (`src/components/site-dashboard/setup-progress.tsx`): auto-dismissing onboarding cards on site overview — tracks sources, prompt, schedule, payments, first post, first publish
- `RunAgentButton` (`src/components/agent/run-agent-button.tsx`): checks `creditBalance` prop — shows "Buy Credits" if 0, otherwise triggers generation via POST to `/api/agent/run`
- Subdomain availability: debounced (500ms) POST to `/api/sites` with `checkSubdomain: true`
