#!/usr/bin/env bash
# Refuse a change that edits, renames or deletes a migration the base already has.
#
# Production records every migration it applies. A build whose tree lacks one of them (a revert,
# a deleted file, a renumbering) cannot migrate again, and an edited one never re-runs. Undo a
# migration with a new one; undo a release with Vercel's Instant Rollback (docs/runbooks/release.md).
#
#   bash scripts/check-migrations-immutable.sh <base>    # e.g. origin/main, or a pull request's base
#
# Committed and uncommitted changes both count. An all-zero or empty base (a repository's first
# push) has nothing to compare.
set -euo pipefail
base="${1:-}"
root="$(git rev-parse --show-toplevel)"

if [ -z "$base" ] || [[ "$base" =~ ^0+$ ]] || ! git -C "$root" cat-file -e "${base}^{commit}" 2>/dev/null; then
  echo "migrations: no base to compare against; nothing to check"
  exit 0
fi

changed="$(git -C "$root" diff --name-status --no-renames "$base" -- supabase/migrations/ | awk '$1 != "A" { print $1 "  " $2 }')"
if [ -n "$changed" ]; then
  echo "refusing: migrations that already exist on the base were changed or removed:" >&2
  printf '  %s\n' "$changed" >&2
  echo "a migration is never edited, renamed or deleted once it exists on the base; write a new one" >&2
  exit 1
fi
echo "migrations: the base's migrations are unchanged"
