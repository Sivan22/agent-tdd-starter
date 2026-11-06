#!/usr/bin/env bash
# Apply pending migrations to the production database, as the last step of a Vercel build
# (`buildCommand` in vercel.json). It runs after `pnpm build` has succeeded; a failure here fails
# the deployment, and production keeps serving the previous one.
#
# Only a production build of main that Vercel's Git integration started may migrate production:
# a preview, a local or CI build, or a `vercel --prod` from someone's checkout applies nothing or
# is refused. `supabase db push` records each version in the database's own ledger and refuses a
# migration numbered below the highest one applied, so a hole in the ladder stops the deployment
# instead of being skipped.
#
# The database address comes from MIGRATIONS_DATABASE_URL when set, else from
# POSTGRES_URL_NON_POOLING, which the Supabase integration on Vercel provides. It is never printed.
set -euo pipefail

env="${VERCEL_ENV:-}"
db="${MIGRATIONS_DATABASE_URL:-${POSTGRES_URL_NON_POOLING:-}}"
main="${MAIN_BRANCH:-main}"

if [ -z "$env" ]; then
  if [ -n "$db" ]; then
    echo "migrations: a database address is set but VERCEL_ENV is not, so this build cannot tell whether it is production; keep Vercel's system environment variables exposed" >&2
    exit 1
  fi
  echo "migrations: not a Vercel build; nothing applied"
  exit 0
fi
if [ "$env" != "production" ]; then
  echo "migrations: a $env build; nothing applied"
  exit 0
fi
if [ -z "${VERCEL_GIT_PROVIDER:-}" ] || [ "${VERCEL_GIT_COMMIT_REF:-}" != "$main" ]; then
  echo "migrations: production migrates only from builds of $main started by Vercel's Git integration (this one: ${VERCEL_GIT_COMMIT_REF:-no Git ref}); refusing" >&2
  exit 1
fi
if [ -z "$db" ]; then
  echo "migrations: POSTGRES_URL_NON_POOLING is not set; connect the Supabase integration to this Vercel project's Production environment" >&2
  exit 1
fi

cd "$(dirname "${BASH_SOURCE[0]}")/.."
pnpm exec supabase db push --db-url "$db" --yes
