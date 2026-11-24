---
name: fitvibe-backend-engineering
description: Implement and verify FitVibe backend changes with repository-specific security, formatting, and CI gates.
---

# FitVibe backend engineering

This is a repository-scoped workflow; consult the current target branch before each change. Keep the canonical formatting and lint policy in the repository's `.prettierrc`, ESLint configuration, and package scripts. Do not replace those rules with manually guessed line wraps.

## Before editing

1. Confirm the requested branch and its current commit SHA. Read applicable instructions, `apps/backend/package.json`, root `package.json`, current CI workflows, relevant source, tests, and architecture decisions.
2. Reproduce the smallest failing check, classify the failure (formatting, lint, types, tests, or behavior), and preserve all unrelated behavior.
3. For backend behavior changes, establish the API contract, server-side authorization, persistent state invariants, and relevant regression tests before implementation.

## Required formatting and lint gate

From the repository root, with dependencies installed using the repository's pinned package manager, run **Prettier before ESLint** after any TypeScript/JavaScript change (including generated code and GitHub API edits):

```bash
pnpm exec prettier --write apps/backend/src/modules/admin/admin-user-guard.ts apps/backend/src/modules/admin/admin.repository.ts apps/backend/src/modules/users/users.service.ts
pnpm exec prettier --check apps/backend/src/modules/admin/admin-user-guard.ts apps/backend/src/modules/admin/admin.repository.ts apps/backend/src/modules/users/users.service.ts
pnpm --filter @fitvibe/backend lint
pnpm lint:check
```

Replace the example filenames with the **actual changed files**. Do not format unrelated files. If editing Markdown, JSON, or workflows, run the repository Prettier check on those modified paths too. Run the full `pnpm lint:check` gate before claiming readiness to push; the backend filter alone is a fast diagnostic, not proof that the repository lint gate passes. For behavior-changing backend work, also run `pnpm --filter @fitvibe/backend typecheck` and relevant focused tests, followed by the applicable broader CI checks.

When lint reports `prettier/prettier`, treat the suggestions as evidence that a formatter pass was omitted. Run the installed version of Prettier on the affected files and **then rerun ESLint without `--fix`**. Do not hand-wrap calls based on style preference. Prettier may collapse a multi-line constructor to one line and expand a different one depending on indentation and the 100-character print width.

## When editing through a GitHub connector

GitHub's contents/tree APIs bypass local Husky and lint-staged hooks. Before committing, obtain the exact source, apply only intended changes, run the same repository formatter and nonmutating check in an environment with dependencies when available, and inspect the diff. If formatter execution is unavailable, report this explicitly and **do not claim local verification**. Verify the resulting head, inspect the current commit's CI status, and distinguish pending checks from successful ones. Never use green CI results from an earlier commit to justify a newer commit.

## Completion report

Provide the base and final branch commits, affected files, commands actually executed with results, relevant CI status at the **final** commit, and any remaining unverified checks. Merge or deploy only when expressly authorized.
