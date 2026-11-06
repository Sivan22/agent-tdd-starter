#!/usr/bin/env bash
# Fail when the committed schema files differ from a fresh dump of the current stack.
# Writes fresh copies to a temporary folder and compares byte for byte; replaces nothing.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

SCHEMA_SNAPSHOT_OUT="$work/schema.snapshot.sql" SCHEMA_RLS_OUT="$work/schema-rls.txt" bash "$root/scripts/dump-schema.sh" >/dev/null
TYPES_OUT="$work/types.gen.ts" bash "$root/scripts/gen-types.sh" >/dev/null

status=0
compare() {
  if ! cmp -s "$root/$1" "$2"; then
    echo "schema drift: $1 does not match the stack; regenerate it on a clean stack and review the diff" >&2
    status=1
  fi
}
compare docs/db/schema.snapshot.sql "$work/schema.snapshot.sql"
compare docs/db/schema-rls.txt "$work/schema-rls.txt"
compare lib/db/types.gen.ts "$work/types.gen.ts"
[ "$status" -eq 0 ] && echo "schema drift check passed"
exit "$status"
