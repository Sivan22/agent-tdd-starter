---
summary: Hosting, environments, migrations, generated schema files, CI, the documentation tooling and the release gate.
covers:
  - vercel.json
  - pnpm-workspace.yaml
  - scripts/migrate-production.sh
  - scripts/check-migrations-immutable.sh
  - .gitleaks.toml
  - scripts/security/**
  - scripts/check-migration-ladder.sh
  - scripts/verify-release.sh
  - scripts/gen-types.sh
  - scripts/dump-schema.sh
  - scripts/check-schema-drift.sh
  - scripts/docs/**
---
# Platform

## Purpose

Where the application runs and how a change reaches production: environments, migrations, CI,
the documentation tooling and the release gate. Read it before adding a migration, an environment
variable, a scheduled job or a release step. [Testing](testing.md) covers the suites; the
[release runbook](../../runbooks/release.md) has the procedure.

## Behaviour

### Environments

| Environment | What it is |
| --- | --- |
| Production | Vercel's deployment of `main`, against the Supabase project the Vercel Marketplace integration created; the integration supplies its variables. |
| Preview | Vercel's deployment of a pull request's branch. It must use a separate database with synthetic data, never production's: a Supabase Branching branch, or no Supabase variables at all ([deploy](../../runbooks/deploy.md)). |
| Local | `pnpm dev` against the local Supabase stack this checkout starts (`supabase/config.toml`). |
| CI | A GitHub runner with its own throwaway local Supabase stack. |

1. GitHub holds the code, Vercel builds and serves it, and Supabase provides the database and
   Auth through the Vercel Marketplace integration. The README's «Deploy with Vercel» button
   creates all three in one flow ([deploy](../../runbooks/deploy.md)).
2. Dependencies resolve with a supply-chain cooldown: pnpm takes no release younger than three
   days (`minimumReleaseAge` in `pnpm-workspace.yaml`), so a hijacked publish is usually pulled
   before it arrives. Next.js is exempt, because it ships security fixes only in its newest
   release.
3. Configuration comes from environment variables. The
   [environment inventory](../../reference/generated/env.md) lists every variable the code reads
   and whether `.env.example` documents it.

### Migrations

1. A schema change is a new file `supabase/migrations/<nnnn>_<snake_case>.sql`, numbered one above
   the highest number on every branch. A pushed migration is never edited.
2. The ladder above production's applied mark must have no hole: production refuses a migration
   numbered below the highest version it has applied, so a number that arrives late can never be
   applied. `scripts/check-migration-ladder.sh` refuses a hole, a malformed name and two files
   under one number, and warns when two live branches claim one number under different names.
3. Production receives migrations when `main` deploys. The Vercel build command (`vercel.json`)
   runs `pnpm build`, then `scripts/migrate-production.sh`, which applies pending migrations
   with `supabase db push` to `MIGRATIONS_DATABASE_URL` when set, else `POSTGRES_URL_NON_POOLING`.
   Preview, local and CI builds apply nothing. A production build that Vercel's Git integration
   did not start from `main` (a `vercel --prod` from a checkout) is refused, and so is a build
   with a database address but no `VERCEL_ENV`. `supabase db push` records each version
   in the database's own ledger and refuses a migration numbered below the highest applied one,
   so a hole in the ladder fails the deployment instead of being skipped. A failed step fails
   the deployment, and production keeps serving the previous one, which is why a migration must
   work with the code already in production.
4. Production's ledger lists every version it applied, so a build whose tree lacks one cannot
   migrate again. A migration on the base branch is never edited, renamed or deleted:
   `scripts/check-migrations-immutable.sh` refuses such a change in CI and in the release gate.
   A release is undone with Vercel's Instant Rollback, which serves the previous deployment
   without building it.
5. The current schema is generated, never written: `lib/db/types.gen.ts`
   (`scripts/gen-types.sh`), and `docs/db/schema.snapshot.sql` with its security digest
   `docs/db/schema-rls.txt` (`scripts/dump-schema.sh`). `scripts/check-schema-drift.sh`
   regenerates all three into a temporary folder and fails when any differs.
   [The database reference](../../db/README.md) explains how to read them.

### CI

`.github/workflows/ci.yml` runs on every pull request and every push to `main`, in one job:
install, the secret scan, the production dependency audit, the check that the base's migrations
are unchanged, start a local Supabase stack (which
applies every migration), write `.env` (`scripts/local-env.sh`), schema drift, typecheck, lint,
the Vitest suite, the Playwright suite and a production build. The Playwright report is uploaded
when a run fails.

1. The secret scan (`scripts/security/scan-secrets.sh`) runs a pinned, checksum-verified
   gitleaks (Linux or macOS, x64 or arm64) with the rules in `.gitleaks.toml`, and names the
   file, line and rule of each finding with the value redacted. It first proves it detects a planted token, then
   scans the tracked files, then every commit since the pull request's base (the whole history
   on a repository's first push), so a secret added and removed inside a pull request still
   fails it.
2. `pnpm audit --prod --audit-level=high` fails on a known high or critical advisory in a
   production dependency.

### Documentation tooling

`pnpm docs:check`, `pnpm docs:gen` and `pnpm docs:owed` run `scripts/docs/cli.ts`; the rules live
in `scripts/docs/model.ts` and are written for readers in [the documentation index](../../README.md).
`pnpm docs:gen` writes the inventories in `docs/reference/generated/` and the index in
`docs/README.md`.

### The release gate

`bash scripts/verify-release.sh <applied-mark>` runs, in the foreground and in order: the
migration ladder, typecheck, lint, schema drift, the Vitest suite and a production build. Each
step prints its own verdict. It never resets a database.

## Where it lives

| Concern | Code | Database | Test |
| --- | --- | --- | --- |
| Migration ladder | `scripts/check-migration-ladder.sh` | `supabase/migrations/` | run it on a planted hole |
| Production migrations | `scripts/migrate-production.sh`, `vercel.json` | the production ledger | `tests/deploy/migrate-production.test.ts` |
| Released migrations stay as they are | `scripts/check-migrations-immutable.sh` | `supabase/migrations/` | `tests/deploy/migrations-immutable.test.ts` |
| Generated schema | `scripts/gen-types.sh`, `scripts/dump-schema.sh`, `scripts/check-schema-drift.sh` | the local stack | `pnpm db:check-schema` in CI |
| Documentation rules | `scripts/docs/model.ts` | none | `tests/docs/` |
| Release gate | `scripts/verify-release.sh` | the local stack | none |
| Secret scan | `scripts/security/scan-secrets.sh`, `.gitleaks.toml` | none | its own negative control |

## Invariants

- Generated files match the schema and the code: CI fails on schema drift, and `tests/docs/`
  fails on stale inventories.

## When it goes wrong

| Symptom | Cause | Check |
| --- | --- | --- |
| CI fails the secret scan | A file or a commit in the pull request holds a secret-shaped value | Remove the secret and rotate it; a synthetic test value gets an exact allowlist entry in `.gitleaks.toml` |
| CI fails on schema drift | A migration changed the schema and the generated files were not regenerated, or were generated on a drifted stack | Regenerate on a clean stack: [local database](../../runbooks/local-database.md) |
| A production deployment fails while applying migrations | A migration was refused (numbered below the applied mark) or its SQL failed | [Deploy](../../runbooks/deploy.md#if-it-fails) |

## Open questions

- None.

## Decisions

- [2026-11-06: one-click deployment on GitHub, Supabase and Vercel](../../decisions/platform.md#2026-11-06-one-click-deployment-on-github-supabase-and-vercel)
- [2026-11-06: publish as a public MIT template, with one commit, and keep the secret scan and audit](../../decisions/platform.md#2026-11-06-publish-as-a-public-mit-template-with-one-commit-and-keep-the-secret-scan-and-audit)
- [2026-11-06: a general template, without a layered security model](../../decisions/platform.md#2026-11-06-a-general-template-without-a-layered-security-model)
