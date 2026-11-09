---
summary: How the Vitest and Playwright suites are organised, how tests own their data, and which command runs what.
covers:
  - vitest.config.mts
  - playwright.config.ts
  - e2e/dev-server.ts
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
   not start. Give every run its own unused port. `e2e/dev-server.ts` owns the port (`e2ePort`),
   the address (`baseUrlFor`) and the command (`devServerArgs`); the QA host starts the same
   server from the same module.
3. Specs find elements by role and accessible name, and scope a locator to its form or list
   when the page has more than one match.
4. A spec saves its screenshots to `e2e/.artifacts/`, which git ignores; attach them to the pull
   request.

### The QA gate

1. A change a user can see passes the QA gate beside the hostile review
   ([AGENTS.md](../../../AGENTS.md#qa-gate)): a fresh `qa-tester` agent uses the application in a
   real headless Chromium, step by step, and puts its verdict with screenshots on the pull
   request. The procedure is [the QA runbook](../../runbooks/qa.md).
2. `pnpm qa:host` (`scripts/qa/cli.ts`, `scripts/qa/host.ts`) is the gate's host. From the QA
   agent's own worktree it refuses a Supabase URL that is not on this machine and a port in use,
   starts the developer server, makes the disposable accounts `qa` and `qa-other` with
   `createTestUser`, opens a `playwright cli` browser session on `/login` and writes `ready.json`
   into `QA_DIR` with the address, the commit under test, the session, the cli command and the
   logins.
3. It ends on `QA_DIR/stop`, on SIGINT or SIGTERM, or by itself after `QA_HOURS` (3 by default).
   Ending closes the browser, deletes the accounts and everything they own, and stops the server.
   `QA_DIR/reopen` opens the browser again.
4. `QA_DIR` must be an absolute directory outside the worktree, so no evidence lands in a checkout.
5. CI does not run the gate. The agent's verdict is on the pull request.

## Where it lives

| Concern | Code | Database | Test |
| --- | --- | --- | --- |
| Vitest configuration | `vitest.config.mts` | none | every suite |
| Clients and fixtures | `tests/helpers.ts` | the local stack | `tests/rls/notes.test.ts` |
| Playwright configuration | `playwright.config.ts` | the local stack | `e2e/notes.spec.ts` |
| Developer server | `e2e/dev-server.ts` | none | `tests/unit/dev-server.test.ts` |
| QA gate host | `scripts/qa/host.ts`, `.claude/agents/qa-tester.md` | the local stack | `tests/unit/qa-host.test.ts` |
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

- [2026-11-09: a QA agent in a real browser, beside the hostile review](../../decisions/platform.md#2026-11-09-a-qa-agent-in-a-real-browser-beside-the-hostile-review)
