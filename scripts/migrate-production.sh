#!/usr/bin/env bash
# Apply pending migrations to the production database, as the last step of a Vercel production
# build (`buildCommand` in vercel.json). It runs only after `pnpm build` has succeeded, and a
# failure here fails the deployment, so production keeps serving the previous one.
#
# `supabase db push` records each migration in the database's own ledger and refuses a local
# migration numbered below the highest one already applied, so a hole in the ladder stops the
# deployment instead of being skipped. It never runs for preview or local builds.
#
# POSTGRES_URL_NON_POOLING comes from the Supabase integration on Vercel. It is never printed.
set -euo pipefail

if [ "${VERCEL_ENV:-}" != "production" ]; then
  echo "migrations: not a Vercel production build (VERCEL_ENV=${VERCEL_ENV:-unset}); nothing applied"
  exit 0
fi
if [ -z "${POSTGRES_URL_NON_POOLING:-}" ]; then
  echo "migrations: POSTGRES_URL_NON_POOLING is not set; connect the Supabase integration to this Vercel project" >&2
  exit 1
fi

cd "$(dirname "${BASH_SOURCE[0]}")/.."
pnpm exec supabase db push --db-url "$POSTGRES_URL_NON_POOLING" --yes
