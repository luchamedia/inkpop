# Orchestration Rules (Always-On)

When a task involves code changes, follow the Generator-Evaluator loop pattern.

## Protocol

### 1. Plan
Before dispatching any generator, define:
- **Acceptance criteria** (AC) — specific, pass/fail statements
- **Which files** will be touched
- **Which evaluators** should review (see Evaluator Selection below)

### 2. Generate
Dispatch to the appropriate generator (`frontend-dev`, `api-dev`, `seo-specialist`, `perf-optimizer`) with:
- The task description
- Acceptance criteria
- File paths to read for context

### 3. Evaluate
After the generator finishes, dispatch evaluators **in parallel**:
- **Always:** `qa-tester` (build + lint + logic review)
- **Frontend changes:** add `content-reviewer` (user-facing text), `perf-optimizer` (bundle/render)
- **API changes:** add `security-auditor`
- **Blog/content changes:** add `content-reviewer`, `seo-specialist`

### 4. Iterate
If evaluators report issues:
1. Consolidate findings into a structured fix list (see Dispatch Format below)
2. Dispatch the **same generator** with the fix list
3. Re-evaluate — only the evaluators that found issues
4. **Maximum 5 iterations** before escalating to the user

### 5. Verify
Final `qa-tester` run to confirm build + lint pass.

## Dispatch Format

Every agent dispatch must include:

```
## Task
[What to build or fix]

## Acceptance Criteria
- AC-1: [pass/fail statement] — Verified by: [evaluator]
- AC-2: ...

## Files to Read First
- [list of relevant file paths]
```

For iteration dispatches, add:

```
## Required Fixes (from [evaluator-name])
1. BLOCKER: [file:line] — [issue] — [suggested fix]
2. WARNING: [file:line] — [issue] — [suggested fix]

Fix ONLY the listed issues. Do not refactor or change anything else.
```

## Parallel Execution Rules

- **Generators:** NEVER run in parallel (they edit the same codebase)
- **Evaluators:** ALWAYS run in parallel when multiple are needed (they are read-only)
- **Exception:** If an evaluator needs Write access (e.g., `qa-tester` creating test files), run it after other evaluators

## Evaluator Selection Quick Reference

| Change Type | Evaluators (parallel) |
|-------------|----------------------|
| Frontend UI | `qa-tester` + `security-auditor` + `content-reviewer` |
| API route | `qa-tester` + `security-auditor` |
| Full-stack | `qa-tester` + `security-auditor` + `content-reviewer` |
| Blog/SEO | `qa-tester` + `content-reviewer` + `seo-specialist` |
| Bug fix | `qa-tester` only |
| Refactor | `qa-tester` + `code-reviewer` |
| PR review | `code-reviewer` + `code-simplifier` + `silent-failure-hunter` + `security-auditor` + `qa-tester` |
