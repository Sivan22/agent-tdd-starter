---
summary: Release a reviewed candidate to production by merging main, and check that its migrations applied.
covers:
  - scripts/verify-release.sh
  - scripts/check-migration-ladder.sh
---
# Release

## When to use it

Every change that reaches `main`, which deploys to production: a pull request merged on GitHub,
or a fast-forward pushed from the root checkout.

## Before you start

- The owner has asked for this release. Merging `main` is a production deployment.
- Every change in the candidate has a passing hostile review, a QA verdict or a named reason QA
  was skipped, and an open pull request ([AGENTS.md](../../AGENTS.md)).
- You know production's applied migration mark: the highest version in its migration ledger,
  read from the Supabase dashboard (Database, Migrations) or with
  `pnpm supabase migration list --linked`. Write down where you read it; never take it from memory.

## Steps

1. Bring the root checkout to the candidate and run the gate on a clean local stack with every
   migration applied:

   ```bash
   bash scripts/verify-release.sh <applied-mark>
   ```

   Every step prints PASS; the last line reads «ALL GREEN».

2. List the migrations this release adds, and make sure no lower number is still waiting on
   another branch:

   ```bash
   ls supabase/migrations | cut -c1-4 | sort -u | awk -v m=<applied-mark> '$1 + 0 > m + 0'
   ```

3. Merge the pull request on GitHub, or fast-forward `main` at the root and push it.
4. Watch the production deployment for the merge commit until it succeeds.
5. Read the applied mark again. It now equals the highest migration in the release.

## Check it worked

- The production deployment of the merge commit succeeded, and the site answers.
- The applied mark equals the release's highest migration.

## If it fails

| Symptom | Meaning | Next step |
| --- | --- | --- |
| The ladder check refuses a hole | A lower-numbered migration is still on another branch | Merge it first, or renumber this release's migrations above it before anything ships |
| The ladder check refuses more than one file per number | Two missions took the same number | Renumber the one that has not reached production above the highest number |
| The mark did not move after the deploy | Migrations did not run | Read the Supabase integration's log; apply with `pnpm supabase db push` from a linked checkout |
| A feature fails with "relation does not exist" | Its migration was numbered at or below the mark and was skipped | Add a new migration above the mark that creates the missing objects; never edit the skipped one |

## Never

- Push `main` without the owner's request, or force-push it.
- Renumber or edit a migration that already reached production.
