# Style Guide Integration — Onboarding + Generation

## Context

The blog generation prompt in `buildPrompt()` is minimal — it only injects topic, description, and Q&A context. There's no way for users to specify tone, audience, voice, language rules, or content preferences. Every site gets the same "expert SEO blog writer" personality. This means all generated posts sound the same regardless of brand.

We need to:
1. Collect style/voice context during onboarding (new wizard step)
2. Store it on the site
3. Inject it into the generation prompt so posts match the brand

---

## Part 1: Database — Add `style_guide` column

**Migration:** `supabase/migrations/XXXXXXXXXXXXXX_add_style_guide.sql`

```sql
ALTER TABLE sites ADD COLUMN IF NOT EXISTS style_guide jsonb;
```

**Shape of `style_guide` jsonb:**

```typescript
interface StyleGuide {
  // Audience
  audienceRole?: string        // "Marketing managers, founders"
  audienceKnowledge?: string   // "beginners" | "familiar" | "knowledgeable" | "experts"
  audienceProblems?: string    // What problems they solve

  // Voice & Tone
  voiceTraits?: string[]       // ["Direct", "Warm", "Authoritative"] — 1-5 picks
  voiceAvoid?: string[]        // ["Salesy", "Robotic"] — things the voice is NOT
  formality?: number           // 1 (casual) to 5 (formal)
  humor?: string               // "none" | "light" | "core"

  // Language Rules
  bannedPhrases?: string       // Words/phrases to never use (newline-separated)
  preferredJargon?: string     // Industry jargon they actively use
  customerWord?: string        // "users" | "clients" | "members" etc.
  hardRules?: string           // Free-text style rules (Oxford comma, no exclamation points, etc.)
}
```

This is intentionally flat and simple. All fields optional — users can fill in as much or as little as they want.

---

## Part 2: Onboarding — New Wizard Step

**Add Step 3: "Brand Voice"** (between Sources and Finalize, making it a 4-step wizard)

New step order:
1. Define your topic (existing)
2. Add sources (existing)
3. **Brand voice** (NEW)
4. Finalize (existing, renumbered from 3→4)

### Files to create/modify

**New:** `src/components/new-site/step-style.tsx`

This step collects the `StyleGuide` fields in a single, scrollable form. Sections:

**Section A — "Who reads your blog?"**
- `audienceRole` — text input — "Who is your target reader?" placeholder: "e.g. Marketing managers, startup founders"
- `audienceKnowledge` — 4 pill buttons — "How familiar are they with your space?" → Beginners / Familiar / Knowledgeable / Experts
- `audienceProblems` — textarea — "What problems are they trying to solve?"

**Section B — "How should it sound?"**
- `voiceTraits` — tag picker (pill buttons, multi-select, 1-5) — "Pick 3-5 words that describe your brand voice"
  - Presets: Direct, Warm, Authoritative, Witty, Playful, Formal, Conversational, Technical, Empathetic, Bold
  - Custom entry: text input + add button
- `voiceAvoid` — tag picker (pill buttons, multi-select) — "Your voice is NOT..."
  - Presets: Salesy, Robotic, Jargon-heavy, Overly casual, Condescending, Vague
  - Custom entry allowed
- `formality` — range slider 1-5 — labels: "Very casual" ← → "Very formal"
- `humor` — 3 pill buttons — "None" / "Light / occasional" / "Humor is core"

**Section C — "Language rules" (collapsible, starts collapsed)**
- `bannedPhrases` — textarea — "Words or phrases to never use (one per line)"
- `preferredJargon` — textarea — "Industry terms you want the AI to use"
- `customerWord` — text input — "What do you call your customers?" placeholder: "users, clients, members"
- `hardRules` — textarea — "Any other style rules?" placeholder: "e.g. Always use Oxford comma, avoid passive voice"

**Validation:** At least 1 `voiceTraits` selection required to proceed. Everything else optional.

**"Skip this step" link** at bottom for users who don't care — proceeds with empty style guide.

### Props interface
```typescript
interface StepStyleProps {
  styleGuide: StyleGuide
  onNext: (styleGuide: StyleGuide) => void
  onBack: () => void
}
```

### Wizard changes (`new-site-wizard.tsx`)

- Add `styleGuide: StyleGuide` to `WizardData`
- Add step 3 to the `steps` array: `{ number: 3, label: "Brand voice" }`
- Renumber Finalize from step 3 → step 4
- Wire `StepStyle` into the step renderer
- Include `style_guide` in the POST `/api/sites` body on submit

---

## Part 3: API Changes

### `POST /api/sites` (`src/app/api/sites/route.ts`)
- Add `style_guide: body.style_guide || null` to the insert

### `PATCH /api/sites/[siteId]` (`src/app/api/sites/[siteId]/route.ts`)
- Add `style_guide` to the update whitelist:
  ```typescript
  if (body.style_guide && typeof body.style_guide === "object") {
    updates.style_guide = body.style_guide
  }
  ```

### `POST /api/agent/run` (`src/app/api/agent/run/route.ts`)
- Add `style_guide` to the select query: `"id, topic, description, topic_context, style_guide, sources(*)"`
- Pass `styleGuide: site.style_guide` in the SiteContext

### `GET /api/cron/daily-run` (`src/app/api/cron/daily-run/route.ts`)
- Add `style_guide` to the select query
- Pass `styleGuide: site.style_guide` in the SiteContext

---

## Part 4: Generation Prompt — The Core Change

### `SiteContext` update (`src/lib/mindstudio.ts`)

```typescript
export interface SiteContext {
  topic?: string
  description?: string
  topicContext?: Array<{ question: string; answer: string }>
  styleGuide?: StyleGuide  // NEW
}
```

### `buildPrompt()` update (`src/lib/mindstudio.ts`)

Inject a `WRITING STYLE GUIDE` block between the site context and the main instruction. Only include sections that have data:

```
SITE CONTEXT:
Topic: ...
Description: ...
Background: ...

WRITING STYLE GUIDE:
Target Audience: {audienceRole} — {audienceKnowledge} familiarity with the space.
Problems they face: {audienceProblems}

Voice & Tone:
- Brand voice traits: {voiceTraits joined}
- Voice is NOT: {voiceAvoid joined}
- Formality: {formality}/5 (1=very casual, 5=very formal)
- Humor: {humor}

Language Rules:
- Never use: {bannedPhrases}
- Use these terms naturally: {preferredJargon}
- Refer to customers as: {customerWord}
- Style rules: {hardRules}

Follow this style guide closely. Every post should sound on-brand.

You are an expert SEO blog writer...
```

The existing `buildPrompt` function currently returns a single string starting with the context block. We extend it by building a `styleBlock` string (similar pattern to `contextBlock`) and inserting it before the main instruction.

### `buildTopicPrompt()` update
Same treatment for `generatePostForTopic()` — it has its own prompt builder that should also include the style guide.

---

## Part 5: Dashboard — Edit Style Guide Post-Creation

### Existing site dashboard (`src/app/dashboard/sites/[siteId]/page.tsx`)

Add a "Brand Voice" card/section to the site dashboard that:
- Shows current style guide summary (voice traits as pills, formality level, audience)
- Has an "Edit" button that opens the style guide form (reuse the `StepStyle` component or extract the form into a shared component)
- Saves via PATCH `/api/sites/[siteId]` with the updated `style_guide`

This ensures users can update their style guide after initial setup without going through the wizard again.

---

## Files to Modify (Summary)

| File | Change |
|------|--------|
| `supabase/migrations/XXXXXX_add_style_guide.sql` | New migration — add `style_guide` jsonb column |
| `src/components/new-site/step-style.tsx` | **New file** — Brand Voice wizard step |
| `src/components/new-site/new-site-wizard.tsx` | Add step 3, update WizardData, wire StepStyle |
| `src/app/api/sites/route.ts` | Accept `style_guide` in POST insert |
| `src/app/api/sites/[siteId]/route.ts` | Add `style_guide` to PATCH whitelist |
| `src/app/api/agent/run/route.ts` | Select `style_guide`, pass to SiteContext |
| `src/app/api/cron/daily-run/route.ts` | Select `style_guide`, pass to SiteContext |
| `src/lib/mindstudio.ts` | Update `SiteContext`, `buildPrompt()`, `buildTopicPrompt()` |
| `src/app/dashboard/sites/[siteId]/page.tsx` | Add Brand Voice card with edit capability |

---

## Verification

1. **Build:** `pnpm build` — no TypeScript errors
2. **Migration:** Push `style_guide` column to Supabase
3. **Onboarding flow:** Create a new site → Step 3 should appear → fill in voice traits → verify `style_guide` is saved to DB
4. **Skip flow:** Create a new site → skip style step → verify site creates with `style_guide: null`
5. **Generation:** Run agent on a site with a style guide → verify the generated post reflects the tone/voice (e.g., casual site should produce casual posts, formal site should produce formal posts)
6. **Dashboard edit:** Open existing site → edit brand voice → save → run agent again → verify updated style is reflected
7. **Cron:** Verify daily-run passes style guide to generation (check logs or test locally)