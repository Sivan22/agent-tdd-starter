---
summary: Release a reviewed candidate to production by merging main, and check that its build applied the migrations.
covers:
  - scripts/verify-release.sh
  - scripts/check-migration-ladder.sh
---
# Release

## When to use it

Every change that reaches `main`, which deploys to production: a pull request merged on GitHub,
or a fast-forward pushed from the root checkout.

## Before you start

- The owner has asked for this release. Merging `main` is a production deployment: Vercel builds
  it, and the build applies its migrations ([deploy](deploy.md)).
- Every change in the candidate has a passing hostile review, a QA verdict or a named reason QA
  was skipped, and an open pull request ([AGENTS.md](../../AGENTS.md)).
- You know production's applied migration mark: the highest version in Supabase's dashboard,
  Database, Migrations. Write it down; never take it from memory.

## Steps

1. Bring the root checkout to the candidate and run the gate on a clean local stack with every
   migration applied:

   ```bash
   bash scripts/verify-release.sh <applied-mark>
   ```

   Every step prints PASS, among them «released migrations unchanged»; the last line reads
   «ALL GREEN».

2. List the migrations this release adds, check that no lower number is still waiting on another
   branch, and check that each works with the code already in production:

   ```bash
   ls supabase/migrations | cut -c1-4 | sort -u | awk -v m=<applied-mark> '$1 + 0 > m + 0'
   ```

3. Merge the pull request on GitHub, or fast-forward `main` at the root and push it.
4. Watch the production deployment for the merge commit until it is ready. Its build log lists
   each migration it applied («Applying migration …») or «up to date».

## Check it worked

- The production deployment of the merge commit is ready, and the site answers.
- Supabase's Migrations list ends with the release's highest migration.

## Undo a release

1. In Vercel, Deployments, open the previous production deployment and choose Instant Rollback.
   It serves that deployment again without building it, so no migration runs and the database
   keeps its schema, which the previous code already works with.
2. Fix forward on a branch: a new commit for the code, and a new migration for the schema. The
   fix's production build applies its migrations while the rolled-back deployment still serves,
   so they must work with that deployment's code too.
3. After a rollback, Vercel stops promoting new production deployments on its own. Once the fix's
   deployment is ready and checked, promote it in Vercel, Deployments.
4. Never revert a commit that added a migration, and never Redeploy an older commit: a build
   whose tree lacks a migration production applied fails, and CI refuses the revert.

## If it fails

| Symptom | Meaning | Next step |
| --- | --- | --- |
| The ladder check refuses a hole | A lower-numbered migration is still on another branch | Merge it first, or renumber this release's migrations above it before anything ships |
| The ladder check refuses more than one file per number | Two missions took the same number | Renumber the one that has not reached production above the highest number |
| The production build fails while applying migrations | A migration was refused or its SQL failed; production still serves the previous deployment | [Deploy](deploy.md#if-it-fails) |
| The release misbehaves after it is live | The code or the migration is wrong | [Undo a release](#undo-a-release), then fix forward |

## Never

- Push `main` without the owner's request, or force-push it.
- Renumber or edit a migration that already reached production.
- Apply migrations to production by hand, or pass `--include-all` to get a refused one through.
- Revert a merged migration, or deploy with the Vercel CLI.
