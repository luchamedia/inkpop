# Workflow Templates (Always-On)

Standard workflows for common task types. Follow the orchestration protocol in `orchestration.md` for dispatch details.

## A. Frontend Feature

```
1. PLAN — define AC, identify components/pages affected
2. GENERATE → frontend-dev (task + AC + file paths)
3. EVALUATE (parallel):
   - qa-tester: build, lint, logic review, AC check
   - security-auditor: if any API calls or data handling
   - content-reviewer: if user-facing text added
4. BROWSER TEST → qa-tester: Playwright verification of UI (if applicable)
5. ITERATE if issues found (max 5 rounds)
6. VERIFY → qa-tester: final build + lint
```

## B. API Feature

```
1. PLAN — define AC, identify routes and tables affected
2. GENERATE → api-dev (task + AC + file paths)
3. EVALUATE (parallel):
   - qa-tester: build, lint, route logic review
   - security-auditor: auth, ownership, input validation
4. ITERATE if issues found (max 5 rounds)
5. VERIFY → qa-tester: final build + lint
```

## C. Full-Stack Feature

```
1. PLAN — split into API-first then frontend, separate AC for each
2. GENERATE API → api-dev
3. EVALUATE API (parallel): qa-tester + security-auditor
4. ITERATE API if needed
5. GENERATE FRONTEND → frontend-dev
6. EVALUATE FRONTEND (parallel): qa-tester + content-reviewer
7. BROWSER TEST → qa-tester: Playwright verification
8. ITERATE FRONTEND if needed
9. VERIFY → qa-tester: final full build + lint
```

## D. Bug Fix

```
1. DIAGNOSE — use Explore agent or read code to identify root cause
2. GENERATE → appropriate generator (task + AC + affected files)
   - AC must include: "Bug X no longer reproduces" + "No regressions in Y"
3. EVALUATE → qa-tester (build, lint, verify fix, check regressions)
4. ITERATE once if needed — escalate to user if still failing after 2nd attempt
```

## E. Refactor

```
1. PLAN — define what's being refactored and why
   - AC: "All existing behavior preserved" + "Build passes" + "Lint passes"
2. GENERATE → appropriate generator
3. EVALUATE (parallel):
   - qa-tester: build + lint + behavior verification
   - code-reviewer: code quality assessment
4. ITERATE if issues found (max 5 rounds)
5. VERIFY → qa-tester: final build + lint
```

## F. PR Review (no generation)

```
1. DISPATCH all evaluators in parallel:
   - code-reviewer
   - code-simplifier
   - silent-failure-hunter
   - type-design-analyzer (if new types introduced)
   - security-auditor (if API changes)
   - qa-tester (build + lint)
2. SYNTHESIZE — combine all findings, deduplicate, prioritize by severity
```

## G. Content/SEO Work

```
1. PLAN — define AC for content quality and SEO requirements
2. GENERATE → seo-specialist or frontend-dev (depending on scope)
3. EVALUATE (parallel):
   - content-reviewer: quality, AI patterns, readability
   - seo-specialist: meta tags, structured data, keyword placement
   - qa-tester: build + lint
4. ITERATE if issues found (max 5 rounds)
5. VERIFY → qa-tester: final build + lint
```
