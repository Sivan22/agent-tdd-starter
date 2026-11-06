#!/usr/bin/env bash
# Regenerate lib/db/types.gen.ts from the local stack, or from SUPABASE_DB_URL when set.
# Generate only from a clean stack with every committed migration applied (docs/db/README.md).
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
out="${TYPES_OUT:-$root/lib/db/types.gen.ts}"
cd "$root"
mkdir -p "$(dirname "$out")"
tmp="$(mktemp "${out}.tmp.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  pnpm exec supabase gen types typescript --db-url "$SUPABASE_DB_URL" 2>/dev/null > "$tmp"
else
  pnpm exec supabase gen types typescript --local 2>/dev/null > "$tmp"
fi
[ -s "$tmp" ] || { echo "gen-types: the generator wrote nothing; is the stack running?" >&2; exit 1; }
mv "$tmp" "$out"
trap - EXIT
echo "wrote $out"
