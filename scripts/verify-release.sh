#!/usr/bin/env bash
# The release gate: the migration ladder, typecheck, lint, schema drift, Vitest and the
# production build, in the foreground, on the candidate at the root checkout, once per
# candidate. CI runs the browser suite. Each step prints its own verdict.
#
#   bash scripts/verify-release.sh <applied-mark>      # production's applied migration, e.g. 0007
#
# It needs a clean local stack with every migration applied. It never resets a database:
# resetting is destructive and stays a decision a person makes.
set -uo pipefail

mark="${1:?usage: verify-release.sh <applied-mark>, e.g. 0007}"
root="$(git rev-parse --show-toplevel)"
cd "$root"

fail=0
step() {
  local name="$1"
  shift
  printf '\n== %s\n' "$name"
  if "$@"; then
    echo "PASS $name"
  else
    echo "FAIL $name (exit $?)"
    fail=1
  fi
}

echo "verifying $(git rev-parse --short HEAD) on $(git rev-parse --abbrev-ref HEAD), applied mark $mark"
[ -z "$(git status --porcelain)" ] || echo "note: the tree has uncommitted changes; the evidence covers them too"

# The ladder first: a hole would silently drop migrations whatever the tests say.
step "migration ladder" bash scripts/check-migration-ladder.sh "$mark"
step "typecheck" pnpm exec tsc --noEmit
step "lint" pnpm lint
step "schema drift" pnpm db:check-schema
step "vitest (unit, RLS, docs)" pnpm exec vitest run
step "production build" pnpm build

echo
if [ "$fail" -eq 0 ]; then echo "ALL GREEN: the candidate may be released."; else echo "SOMETHING FAILED: read the verdicts above. Do not release."; fi
exit "$fail"
