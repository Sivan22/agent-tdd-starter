#!/usr/bin/env bash
# Write .env for the local Supabase stack from `supabase status`, keeping any other lines.
#   bash scripts/local-env.sh
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"

status="$(pnpm exec supabase status -o env 2>/dev/null || true)"
lines="$(
  printf '%s\n' "$status" |
    sed -n -e 's/^API_URL="\(.*\)"$/NEXT_PUBLIC_SUPABASE_URL=\1/p' \
      -e 's/^PUBLISHABLE_KEY="\(.*\)"$/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\1/p' \
      -e 's/^SECRET_KEY="\(.*\)"$/SUPABASE_SECRET_KEY=\1/p'
)"
[ "$(printf '%s\n' "$lines" | grep -c .)" -eq 3 ] || { echo "local-env: is the stack running? (pnpm supabase start)" >&2; exit 1; }

kept=""
[ -f .env ] && kept="$(grep -vE '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY|SUPABASE_SECRET_KEY)=' .env || true)"
{ printf '%s\n' "$lines"; [ -n "$kept" ] && printf '%s\n' "$kept"; } > .env
echo "local-env: wrote .env"
