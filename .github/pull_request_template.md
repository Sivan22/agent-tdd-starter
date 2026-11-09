<!-- First line for a tracked issue: Fixes <id> -->

## Scope

What this pull request changes and why, in a few lines. What it deliberately leaves out.

## Owner decisions

Rulings made for this change, quoted, and the `docs/decisions/` entry each went into. "None" if none.

## Checks

The tested commit, then each check with its exact command and result line.

| Check | Command | Result |
| --- | --- | --- |
| Failing-first test | `pnpm vitest run <file>` (before the fix) | failed: <reason> |
| Typecheck | `pnpm tsc --noEmit` | |
| Lint | `pnpm lint` | |
| Affected tests | `pnpm vitest run <files>` | |
| Browser | `E2E_PORT=<port> pnpm test:e2e e2e/<spec>` | |
| Docs | `pnpm docs:check` | |

## Migrations

Each new file under `supabase/migrations/`, and the result of
`bash scripts/check-migration-ladder.sh <applied-mark>`. "None" if none.

## Screenshots

Embedded images of each changed screen, captured from the tested version with synthetic data,
each with a one-line caption. Before and after when it helps.

## Hostile review

The verdict line, then every finding with its disposition: fixed (how), or rejected (why, until
the owner rules).

## QA gate

The verdict line and a link to the comment on this pull request, then every problem with its
disposition: fixed (how), or predates the change (the issue it was filed as). For a change with
nothing a user can see, the reason QA was skipped.

## Open questions

Questions for the owner, and what waits on each.
