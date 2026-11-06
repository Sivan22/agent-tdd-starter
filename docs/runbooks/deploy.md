---
summary: Deploy the stack in one click (GitHub, Vercel, Supabase), what each production build does to the database, and the settings that remain.
covers:
  - scripts/migrate-production.sh
---
# Deploy

## When to use it

Putting the application online for the first time, or connecting an existing copy of this
repository to Vercel and Supabase. Releasing a change to a running deployment, and undoing one,
is the [release runbook](release.md).

## Before you start

- A GitHub account and a Vercel account. Vercel creates the Supabase project through its
  Marketplace, so no separate Supabase sign-up is needed.
- Read [Platform](../system/platform/README.md#environments) for what runs where.

## Steps

1. Click «Deploy with Vercel» in the [README](../../README.md#deploy-your-own). Vercel asks for:
   - the Git scope and repository name: it creates the repository in your GitHub account;
   - the Supabase project: name and region. The integration creates it and adds its variables
     to the Vercel project, among them `NEXT_PUBLIC_SUPABASE_URL`,
     `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `POSTGRES_URL_NON_POOLING`.

   For a repository you already have, import it in Vercel instead, then add Supabase from the
   project's Storage tab (Vercel Marketplace). `vercel.json` already holds the build command.

2. Vercel builds `main`. The build command in `vercel.json` runs `pnpm build`, then
   `scripts/migrate-production.sh`, which applies every migration to the new database with
   `supabase db push`. The build log shows «Applying migration 0001_notes.sql...». The step
   migrates only a production build of `main` that Vercel's Git integration started, and it
   needs Vercel's system environment variables, which are exposed by default: leave «Automatically
   expose System Environment Variables» on.

3. Keep the Supabase variables out of Preview and Development. Open the Vercel project's
   Settings, Environment Variables (or the Supabase connection in the Storage tab) and make sure
   every Supabase and Postgres variable applies to Production only. Otherwise every preview
   build, including one of a branch pushed before its pull request is reviewed, receives
   production's secret key and database password. A preview without them answers every request
   with an error, which is the safe failure.

   For working previews, add Supabase Branching on top: connect the repository in Supabase's
   GitHub integration and enable branching. Each pull request then gets its own database branch
   with its migrations, and Supabase sets that branch's variables for the pull request's
   previews once the pull request opens. Leave Branching's own production deploy off: the
   production build owns production migrations.

4. Point Supabase Auth at the deployment. In the Supabase dashboard, Authentication:
   - URL Configuration: set the site URL to the production URL, and add the preview URL pattern
     of your Vercel scope to the redirect URLs, so confirmation emails link back to the app;
   - settings: set the minimum password length to 12 to match the form, and choose whether a new
     account must confirm its email. Hosted Supabase requires confirmation by default; the local
     stack does not (`supabase/config.toml`).

## Check it worked

- The production URL serves «Notes». «Create account» either signs the new account in, or, with
  email confirmation on, answers «Check your email to confirm the account, then sign in.»; after
  the link in that email, «Sign in» reaches «Your notes».
- The production deployment's build log shows «Finished supabase db push.» on the first deploy,
  and «up to date» on a deploy with no new migration.
- Supabase's dashboard, Database, Migrations, lists the same versions as `supabase/migrations/`.
- A preview deployment either serves its Branching database or answers with an error; it never
  shows production's notes.

## If it fails

| Symptom | Meaning | Next step |
| --- | --- | --- |
| The build fails with «POSTGRES_URL_NON_POOLING is not set» | The Supabase integration is not connected to this project's Production environment | Connect it from the project's Storage tab, then redeploy |
| The build fails with a connection error while pushing migrations | Vercel's build cannot reach the database address the integration gave | In Supabase's Connect dialog, copy the Session pooler connection string (port 5432) and set it as `MIGRATIONS_DATABASE_URL` in Vercel's Production environment, then redeploy |
| The build fails with «Found local migration files to be inserted before the last migration on remote database» | A migration is numbered below one production already applied | Renumber it above the highest applied version in a new commit; never pass `--include-all` |
| The build fails with «Remote migration versions not found in local migrations directory» | The tree lacks a migration production applied: a revert, a deleted file, or a redeploy of an older commit | Restore the file from Git history in a new commit; undo releases with Instant Rollback ([release](release.md#undo-a-release)) |
| The build fails with «production migrates only from builds of main» | A production deployment came from the Vercel CLI or another branch | Deploy through GitHub: merge to `main` |
| The build fails with «VERCEL_ENV is not» | Vercel's system environment variables are not exposed | Turn «Automatically expose System Environment Variables» back on |
| The build fails while applying a migration | The SQL failed against production's data | Production keeps serving the previous deployment; fix the migration in a new commit |
| The confirmation email links to `localhost` | Auth's site URL is still the default | Step 4 |

## Never

- Copy production's variables into a local `.env`, or run migrations against production from a
  laptop: the production build of `main` is the one path that changes production's schema.
- Deploy with the Vercel CLI, or give previews the production database.
