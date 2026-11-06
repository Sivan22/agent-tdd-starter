<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Agent guide

This file is the one set of instructions for every agent and every person working in this
repository. It describes a way of working: small missions, each built test-first on its own
branch, checked by a reviewer who did not write it, documented in the same commit, and handed
over as a pull request. The [stack section](#stack-and-conventions) is the only part tied to
the technology; the rest holds for any stack.

Where to look: `docs/system/<area>.md` describes how an area behaves now and lists the code it
covers; `docs/decisions/<area>.md` holds the owner's rulings and their reasons; `docs/runbooks/`
holds procedures; [docs/README.md](docs/README.md) is the index and the writing rules. Before you
change how an area behaves, read its system document and its decisions file, because a dated
ruling may forbid the change. When the code and a document disagree, one of them is wrong: say
which in your report rather than quietly following either.

The owner is the person who decides what the product does. Agents propose; the owner rules.

## When a mission is done

A mission (a feature, a fix, a docs or process change) is done when its pull request is open and
ready for review. "Not committed" or "not pushed" is not done. Take these steps without asking:

1. Work on the mission's own branch and worktree (see [Worktrees and branches](#worktrees-and-branches)).
2. Write the failing test first, watch it fail for the right reason, then make it pass.
3. Run the checks for what changed, in the foreground, and quote their results:

   | Change | Checks |
   | --- | --- |
   | Application code or UI | The failing-first test, `pnpm tsc --noEmit`, `pnpm lint`, the affected Vitest files, and the affected page in a browser: an e2e spec, or a Playwright script plus a screenshot |
   | Schema, RLS, auth, shared infrastructure | All of the above, plus the RLS and database tests of every table touched, and the consumers of the shared behaviour |
   | Scripts, configuration, dependencies, generated files | Run the changed tool, then the checks of whatever it controls |
   | Docs or agent instructions only | `pnpm docs:check`, and a read of every changed instruction for conflicts |

4. Keep the documentation current: change the area's system document in the same commit as the
   behaviour (`pnpm docs:owed <base>` lists what you owe), add owner rulings to its decisions
   file, run `pnpm docs:gen` after adding a route, environment variable, bucket, scheduled job or
   package script, and pass `pnpm docs:check`. Never edit `docs/history/` or
   `docs/reference/generated/` by hand.
5. Pass a [hostile review](#hostile-review).
6. Commit with a conventional prefix and the owner's decisions in the message, push the branch,
   and open a pull request with `gh pr create`, not as a draft. Base it on `main`; when the work
   depends on another unmerged branch, base it on that branch and say so. Fill in
   `.github/pull_request_template.md`: the scope, each check with its result, any migration with
   the ladder-check result, the hostile verdict with every finding's disposition, and open
   questions for the owner. Embed screenshots of UI changes, captured from the tested version
   with synthetic data and inspected for secrets before upload; a local path is not evidence a
   reviewer can see.
7. Read `gh pr checks <number>` and fix any red run on the branch. To bring in a newer `main`,
   merge it into the branch; a pushed branch is never rebased, because that needs a force-push.
8. End your report with the pull request's URL.

When a required check cannot run (the machine is saturated, a fixture is missing), commit on the
branch, report the mission as blocked and name the check. Open the pull request as a draft that
names the missing check, and mark it ready with `gh pr ready` once the check has run.

## Hostile review

Nothing is verified until a fresh reviewer has tried to break it, because self-review misses what
the author assumed. The session that owns the branch spawns a new `hostile-reviewer` agent
(`.claude/agents/hostile-reviewer.md`): never a fork of itself, never the agent that wrote the
code. If that agent type is unavailable, give the brief to a fresh general-purpose agent told to
follow that file. The brief carries the worktree path, an immutable base commit, your claim of
what was built, decided and verified, and `heavy: allowed` if the reviewer may rerun tsc, lint or
an e2e spec; otherwise it audits your quoted evidence. The reviewer returns
`HOSTILE REVIEW: PASS` or `FAIL` with numbered findings. Fix every confirmed finding and send the
same reviewer the delta; it checks the fixes and their consequences rather than restarting. A
finding you reject stays listed with your reason until the owner rules, and the ruling goes in
the commit message. No reviewer spawns another reviewer.

## Working rules

- Scope in chat: for anything beyond one file, state the scope and the plan in a few lines, then
  build. Do not write separate spec, plan or task files; the pull request is the record.
- Tests first: Vitest for logic and database policies, Playwright for flows. A failing test is
  never deleted, skipped or loosened to get green; fix the code, or say openly why the test was
  wrong and change it.
- Each test owns its data: it creates the users and rows it needs and removes them afterwards.
  No test depends on a shared seed or on another test's leftovers.
- Rerun tests and fix the failures your change caused without asking. Run checks in the
  foreground: a subagent that backgrounds a run waits for a notification that never arrives.
- Evidence belongs to the exact inputs it ran on, so the reviewer can audit it: record the tested
  commit, any uncommitted diff, the relevant environment, the commands and where the results
  are. Finish edits before the final checks and keep the tested files unchanged while they run.
- After a fix, rerun the checks whose inputs changed and say why the rest still hold. A prose
  edit does not invalidate a typecheck; a TypeScript edit does, a shared helper affects all its
  consumers, and a migration, dependency or configuration change can invalidate broad evidence.
  When the impact is uncertain, broaden the checks. A stopped or out-of-memory run is incomplete,
  and a failure stays a failure until resolved.
- One builder and one reviewer suffice for a small mission; add agents only for independent
  work. The full gate (`bash scripts/verify-release.sh <applied-mark>`) belongs to the session
  releasing a candidate, once; builders and reviewers do not repeat it.
- Refactor charter: one owner per behaviour, and the old implementation is deleted in the same
  commit (count the copies before and after). No wrapper, flag or shim beside an old path. No
  tombstones, ticket ids or history narration in comments or docs. No new `as any`,
  `as unknown as`, non-null `!` or `@ts-expect-error`; ESLint refuses most of them.
- An owner decision made in chat that changes behaviour goes in the commit message and in
  `docs/decisions/<area>.md`, with the rule changed in the system document. Chat is not a record.
- Ask first only for what is destructive or shared: resetting a shared database, deleting data,
  merging or pushing `main`, rewriting history. Pushing a mission's own branch after its hostile
  review and opening its pull request need no asking.

## Worktrees and branches

- `main` stays checked out at the root checkout. Each mission gets its own branch and worktree:
  `git worktree add <root>/.worktrees/<nnn>-<slug> -b <nnn>-<slug> origin/main`, where `<root>`
  is `dirname "$(git rev-parse --path-format=absolute --git-common-dir)"` and `<nnn>` is one
  above the highest number across `git branch -a` and `.worktrees/`. A session started in a
  worktree made for it uses that one. Work at the root only when the owner says so.
- A mission from an issue tracker that links branches by identifier (Linear, Jira, GitHub
  issues) takes the tracker's branch name instead, so the tracker follows the pull request on its
  own. Put the issue reference on the pull request's first line (`Fixes <id>`).
- Root work also ends in a pull request: create a worktree and branch, and move only your own
  files there with a stash limited to their paths (`git stash push -u -m <tag> -- <paths>`).
  The root is shared, so never sweep up changes you did not make.
- Merging into `main` is a release: it deploys the app and applies migrations. The owner decides
  every merge, and the session that merges follows [the release runbook](docs/runbooks/release.md).
- Commit messages use conventional prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.

## Database and migrations

- Business rules live in the database: a rule that only the UI enforces is a bug. Validate in the
  app for a friendly message, and enforce with a constraint, a policy or a function.
- Every schema change is a new numbered file, `supabase/migrations/<nnnn>_<snake_case>.sql`. Never
  change a database by hand, and never edit a pushed migration, not even its comments.
- Pushing `main` applies migrations: the Vercel production build of `main` runs `supabase db push`
  after the app has built (`scripts/migrate-production.sh`). It refuses a migration numbered
  below the highest one production has applied, and a refusal or a failed migration fails the
  deployment. No other path changes production's schema.
- Numbers are unique and gapless above production's applied mark, because a number that arrives
  below the mark can never be applied. Before picking a number, check every branch and worktree
  (`ls .worktrees/*/supabase/migrations | tail`).
  `bash scripts/check-migration-ladder.sh <applied-mark>` refuses a hole, a malformed name and two
  files under one number, and warns when two live branches claim one number.
- A migration on `main` is never edited, renamed or deleted, not even by a revert: production
  records every version it applied, and a build without one of them cannot migrate again. CI
  refuses such a change (`scripts/check-migrations-immutable.sh`). Undo a migration with a new
  one; undo a release with Vercel's Instant Rollback ([release](docs/runbooks/release.md)).
  The one exception is a migration production never applied, such as one whose production build
  failed: after confirming in Supabase's Migrations list that its version is absent, fix or
  renumber it in a commit carrying the trailer `Unapplied-migration: NNNN`
  ([deploy](docs/runbooks/deploy.md#if-it-fails)).
- A migration works with the code already in production: the previous deployment keeps serving
  while the new build applies it, and goes on serving if the deployment fails afterwards. Add
  first, use in a later release, remove last.
- A new table gets RLS enabled, policies, and explicit grants that start from none: Supabase's
  default privileges grant ALL to `anon`, `authenticated` and `service_role`, so revoke from all
  three, then grant what the feature needs (`supabase/migrations/0001_notes.sql` is the pattern).
  Every policy, and each permission the feature deliberately withholds, gets a case in
  `tests/rls/` that proves the refusal against the database directly. The full grant list of
  every table is pinned by `docs/db/schema-rls.txt` and the drift check.
- `lib/db/types.gen.ts`, `docs/db/schema.snapshot.sql` and `docs/db/schema-rls.txt` are
  generated (`pnpm gen:types`, `pnpm db:schema`) from a clean stack with every migration applied.
  CI fails when they drift (`pnpm db:check-schema`).
- Never point local tooling or tests at a production database; `tests/helpers.ts` refuses any
  Supabase URL that is not on this machine.

## The shared machine

Several sessions may build on one machine at once. These rules keep them out of each other's way.

- Each project's local stack has its own port block (`supabase/config.toml`). Never reset or
  reseed a stack another worktree is using; ask the owner first.
- Every e2e run uses an unused `E2E_PORT`. Playwright starts its own server and never reuses one
  it did not start, because a server on that port may be another checkout's code.
- When the host provides a resource-admission wrapper for heavy commands (typecheck, lint,
  builds, browser suites), use it and never bypass it. A killed or memory-limited check is
  incomplete: inspect why before retrying. Never kill another session's processes.

## Stack and conventions

Next.js 16 (App Router, `proxy.ts` instead of `middleware.ts`), React 19, TypeScript, Tailwind CSS
4, shadcn components on Base UI, Supabase (Postgres with RLS, Auth), Zod 4, Vitest and Playwright,
pnpm on Node 24. GitHub holds the code, Vercel deploys it, and Supabase comes from the Vercel
Marketplace ([deploy](docs/runbooks/deploy.md)). [Architecture](docs/system/architecture.md)
explains the layers.

- A page that needs a user starts with `requireUser()`. A change goes through a Server Action
  that parses its input with Zod and writes through the caller's Supabase client, so RLS applies.
- Server-only modules import `server-only`; secret keys never reach a client component.
- Reuse `components/ui` and the existing page patterns rather than a parallel style. Icons come
  from `lucide-react`. Every control has an accessible name; tests find elements by role and name.
- A missing environment variable throws where it is read (`lib/env.ts`), never falls back silently.

## Commands

| Task | Command |
| --- | --- |
| Install | `pnpm install` (pnpm only) |
| Local database | `pnpm supabase start`, `bash scripts/local-env.sh`, and `pnpm supabase migration up` after adding a migration |
| Dev server | `pnpm dev` |
| Typecheck | `pnpm tsc --noEmit` |
| Lint | `pnpm lint` |
| Unit, RLS and docs tests | `pnpm test`, or one file: `pnpm vitest run tests/rls/notes.test.ts` |
| E2E | `E2E_PORT=<unused-port> pnpm test:e2e e2e/<spec>.spec.ts` |
| Types and schema | `pnpm gen:types`, `pnpm db:schema`, `pnpm db:check-schema` (clean stack only) |
| Docs | `pnpm docs:check`, `pnpm docs:owed <base>`, `pnpm docs:gen` |
| Secret scan | `bash scripts/security/scan-secrets.sh` |
| Release gate | `bash scripts/verify-release.sh <applied-mark>` |

CI (`.github/workflows/ci.yml`) runs on pull requests and on pushes to `main`: a secret scan,
a production dependency audit, unchanged released migrations, schema drift, typecheck, lint, the
Vitest suite, the Playwright suite and a production build, against a throwaway local Supabase
stack.

## Never

- `npm`, `npx` or `yarn`; a stray `package-lock.json` is deleted, not adopted.
- Committing `.env*` (except `.env.example`), keys or credentials.
- `git push --force`, history rewrites, or resetting a shared database, unless the owner asks.
- Editing a pushed migration or a generated file by hand.
- Deploying with the Vercel CLI (`vercel deploy`, `vercel --prod`): production comes from `main`
  through GitHub. The production build refuses other branches, but a CLI deploy from a local
  `main` could pass it.
