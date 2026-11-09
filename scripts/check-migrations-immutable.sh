#!/usr/bin/env bash
# Refuse a change that edits, renames or deletes a migration the base already has.
#
# Production records every migration it applies. A build whose tree lacks one of them (a revert,
# a deleted file, a renumbering) cannot migrate again, and an edited one never re-runs. Undo a
# migration with a new one; undo a release with Vercel's Instant Rollback (docs/runbooks/release.md).
#
# The one exception is a migration production never applied, such as one whose production build
# failed: after checking Supabase's Migrations list, fix or renumber it in a commit whose message
# carries the trailer `Unapplied-migration: NNNN` (docs/runbooks/deploy.md).
#
#   bash scripts/check-migrations-immutable.sh <base>    # e.g. origin/main, or a pull request's base
#
# Committed and uncommitted changes both count. An all-zero or empty base (a repository's first
# push) has nothing to compare; any other base that does not resolve is an error.
set -euo pipefail
base="${1:-}"
root="$(git rev-parse --show-toplevel)"

if [ -z "$base" ] || [[ "$base" =~ ^0+$ ]]; then
  echo "migrations: no base to compare against; nothing to check"
  exit 0
fi
if ! git -C "$root" cat-file -e "${base}^{commit}" 2>/dev/null; then
  echo "refusing: cannot resolve the base '$base'; fetch it or name another" >&2
  exit 1
fi

exempt="$(git -C "$root" log --format=%B "${base}..HEAD" | sed -n 's/^Unapplied-migration: *\([0-9]\{4\}\) *$/\1/p' | sort -u)"
changed="$(
  git -C "$root" diff --name-status --no-renames "$base" -- supabase/migrations/ |
    awk '$1 != "A" { print $1 "  " $2 }' |
    while read -r status file; do
      version="$(basename "$file" | cut -c1-4)"
      printf '%s\n' "$exempt" | grep -qx "$version" || printf '%s  %s\n' "$status" "$file"
    done
)"
if [ -n "$changed" ]; then
  echo "refusing: migrations that already exist on the base were changed or removed:" >&2
  printf '  %s\n' "$changed" >&2
  echo "write a new migration instead; only a migration production never applied may change, in a commit carrying 'Unapplied-migration: NNNN'" >&2
  exit 1
fi
echo "migrations: the base's migrations are unchanged${exempt:+ (except unapplied: $(echo $exempt))}"
