---
summary: How the Vitest and Playwright suites are organised, how tests own their data, and which command runs what.
covers:
  - vitest.config.mts
  - playwright.config.ts
  - tests/helpers.ts
  - scripts/local-env.sh
---
# Testing

## Purpose

How the test suites are laid out, what each needs, and how a test gets its data. Read it before
writing a test. [AGENTS.md](../../../AGENTS.md) says when each check is required.

## Behaviour

### The test tree

| Path | Holds | Needs |
| --- | --- | --- |
| `tests/unit/` | Pure logic: validation, parsing, formatting. | Nothing |
| `tests/rls/` | One file per table: what each kind of caller may read and write, asked of the database directly. | The local stack |
| `tests/docs/` | The documentation checker, on a planted tree and on this repository. | Nothing |
| `tests/deploy/` | The deployment scripts and settings: the production migration step (with a fake `pnpm`), released-migration immutability (in throwaway repositories), `vercel.json` and the Deploy button. | Nothing |
| `e2e/*.spec.ts` | Playwright flows through a real browser and a dev server. | The local stack and a browser |

1. `vitest.config.mts` runs every `*.test.ts` outside `e2e/` and `.worktrees/`, one file at a
   time, with a 20-second test timeout.
2. A test that reaches the database imports `tests/helpers.ts`. It loads `.env`, throws when a
   Supabase variable is missing, and refuses any Supabase URL that is not on this machine.
3. `tests/helpers.ts` provides `admin` (the secret-key client, which bypasses RLS: for fixtures
   and for reading back what really happened), `anonClient()` (a signed-out caller),
   `createTestUser(label)` (a fresh confirmed user, signed in), `deleteTestUsers(users)` and
   `userIdByEmail(email)`.
4. Each test owns its data. It creates its users with `createTestUser`, which gives each a unique
   `@test.local` address, and deletes them in `afterAll` or `afterEach`; deleting a user cascades
   to the rows it owns. No test reads a seed, so the stack needs none and several runs can share
   it.

### Writing an RLS case

1. Make one user per kind of caller that matters, plus a signed-out client.
2. Build the data as the owner through that user's own client, so the insert policy is exercised
   too.
3. Assert each caller: an allowed read returns the row; a refused read returns nothing, or error
   `42501` when the role has no grant; a refused write leaves the row unchanged when read back
   through `admin`.
4. Assert the database's own rules directly: a CHECK constraint answers `23514`.

### Playwright

1. `playwright.config.ts` runs `e2e/*.spec.ts` in Chromium with one worker, 60-second tests and
   15-second assertions.
2. It starts `next dev` on `127.0.0.1:$E2E_PORT` (default 3100) and never reuses a server it did
   not start. Give every run its own unused port.
3. Specs find elements by role and accessible name, and scope a locator to its form or list
   when the page has more than one match.
4. A spec saves its screenshots to `e2e/.artifacts/`, which git ignores; attach them to the pull
   request.

## Where it lives

| Concern | Code | Database | Test |
| --- | --- | --- | --- |
| Vitest configuration | `vitest.config.mts` | none | every suite |
| Clients and fixtures | `tests/helpers.ts` | the local stack | `tests/rls/notes.test.ts` |
| Playwright configuration | `playwright.config.ts` | the local stack | `e2e/notes.spec.ts` |
| Local `.env` | `scripts/local-env.sh` | `supabase status` | CI |

## Invariants

- A test never depends on another test's data or on a seed.
- No test runs against a Supabase URL outside this machine.

## When it goes wrong

| Symptom | Cause | Check |
| --- | --- | --- |
| "Missing environment variable" when a suite starts | `.env` is missing | `bash scripts/local-env.sh` |
| "Could not find the table … in the schema cache" | A migration is not applied | `pnpm supabase migration up` |
| Playwright cannot start its server | The port is taken | Choose another `E2E_PORT` |

## Open questions

- None.

## Decisions

- None yet.
