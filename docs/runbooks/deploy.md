---
summary: Deploy the stack in one click (GitHub, Vercel, Supabase), what each production build does to the database, and the settings that remain.
covers:
  - scripts/migrate-production.sh
---
# Deploy

## When to use it

Putting the application online for the first time, or connecting an existing copy of this
repository to Vercel and Supabase. Releasing a change to a running deployment is the
[release runbook](release.md).

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
   `supabase db push`. The build log shows «Applying migration 0001_notes.sql...».

3. Point Supabase Auth at the deployment, so the confirmation email links back to the app. In the
   Supabase dashboard, Authentication, URL Configuration: set the site URL to the production URL,
   and add the preview URL pattern of your Vercel scope to the redirect URLs. In Authentication
   settings, set the minimum password length to 12 to match the form.

4. Give preview deployments their own database. Preview builds never apply migrations, but a
   preview that receives the production variables reads and writes production data. Either:
   - enable Supabase Branching (connect the repository in Supabase's GitHub integration): each
     pull request gets its own database branch with its migrations, and the integration hands
     its credentials to that preview deployment. Leave Branching's own production deploy off:
     the production build owns production migrations; or
   - remove the Supabase variables from Vercel's Preview environment. Previews then answer every
     request with an error instead of touching production.

## Check it worked

- The production URL serves «Notes», and «Create account» then «Sign in» reach «Your notes».
- The production deployment's build log ends with «Finished supabase db push.» on the first
  deploy, and «up to date» on a deploy with no new migration.
- Supabase's dashboard, Database, Migrations, lists the same versions as `supabase/migrations/`.

## If it fails

| Symptom | Meaning | Next step |
| --- | --- | --- |
| The build fails with «POSTGRES_URL_NON_POOLING is not set» | The Supabase integration is not connected to this Vercel project, or not to Production | Connect it from the project's Storage tab, then redeploy |
| The build fails with «Found local migration files to be inserted before the last migration on remote database» | A migration is numbered below one production already applied | Renumber it above the highest applied version in a new commit; never pass `--include-all` |
| The build fails while applying a migration | The SQL failed against production's data | Production keeps serving the previous deployment; fix the migration in a new commit |
| Every page answers an error on a preview | The preview has no Supabase variables (step 4, second option) | Expected; enable Branching for working previews |
| The confirmation email links to `localhost` | Auth's site URL is still the default | Step 3 |

## Never

- Copy production's variables into a local `.env` or run migrations against production from a
  laptop: the production build is the one path that changes production's schema.
- Give previews the production database while they write test data.
