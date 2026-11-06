#!/usr/bin/env bash
# Refuse a release while the migration ladder above production's applied mark has a hole, and
# warn when two live branches claim the same migration number.
#
# Supabase applies migrations in order and silently skips any whose number is at or below the
# highest version already applied. A hole that ships is therefore not cosmetic: when the missing
# number merges later, production never runs it. Two branches that each take "the next free
# number" lose the same way: whichever ships second is skipped.
#
#   bash scripts/check-migration-ladder.sh <applied-mark>     # e.g. 0007
#
# MAIN_BRANCH names the release branch (default main).
set -euo pipefail

usage="usage: check-migration-ladder.sh <applied-mark>, four digits, e.g. 0007"
mark="${1:?$usage}"
if ! [[ "$mark" =~ ^[0-9]{4}$ ]]; then
  echo "refusing: applied mark '$mark' is not a four-digit migration version" >&2
  echo "$usage" >&2
  exit 2
fi
main="${MAIN_BRANCH:-main}"
root="$(git rev-parse --show-toplevel)"
dir="$root/supabase/migrations"

malformed="$(ls "$dir" | grep -vE '^[0-9]{4}_[a-z0-9_]+\.sql$' || true)"
if [ -n "$malformed" ]; then
  echo "refusing: migration files must be named NNNN_snake_case.sql:" >&2
  printf '  %s\n' $malformed >&2
  exit 1
fi

# Two files under one number in this checkout: whichever applies first wins and the other is
# skipped, so this is a refusal, not a warning.
twins="$(ls "$dir" | cut -c1-4 | sort | uniq -d)"
if [ -n "$twins" ]; then
  echo "refusing: more than one migration file per number:" >&2
  for d in $twins; do ls "$dir" | grep "^${d}_" | sed 's/^/  /' >&2; done
  exit 1
fi

nums="$(ls "$dir" | cut -c1-4 | sort -u | awk -v m="$((10#$mark))" '$1 + 0 > m + 0')"
if [ -z "$nums" ]; then
  echo "no migrations above $mark; nothing to check"
  exit 0
fi
first="$(echo "$nums" | head -1)"
last="$(echo "$nums" | tail -1)"
missing=""
for ((n = 10#$mark + 1; n <= 10#$last; n++)); do
  p="$(printf '%04d' "$n")"
  echo "$nums" | grep -qx "$p" || missing="$missing $p"
done
echo "applied mark: $mark"
echo "ladder on this branch: $(echo "$nums" | tr '\n' ' ')"

# Live branches: the release branch, plus every local branch with commits it does not have.
live_branches() {
  git -C "$root" for-each-ref --format='%(refname:short)' refs/heads/ | while read -r b; do
    if [ "$b" = "$main" ] || [ -n "$(git -C "$root" rev-list -1 "$main..$b" 2>/dev/null)" ]; then echo "$b"; fi
  done
}
# A number claimed under two different file names on two live branches is a collision. Compare
# names, not counts: every branch carries every earlier migration.
dupes="$(
  for b in $(live_branches); do
    git -C "$root" ls-tree -r --name-only "$b" -- supabase/migrations/ 2>/dev/null |
      sed -n 's|^supabase/migrations/\([0-9]\{4\}\)_\(.*\)\.sql$|\1 \2|p'
  done | sort -u | awk '{print $1}' | uniq -d
)"
if [ -n "$dupes" ]; then
  echo
  echo "warning: these numbers are claimed by more than one live branch under different names:"
  for d in $dupes; do
    for b in $(live_branches); do
      f="$(git -C "$root" ls-tree -r --name-only "$b" -- supabase/migrations/ 2>/dev/null | grep "^supabase/migrations/${d}_" | head -1 || true)"
      [ -n "$f" ] && printf '  %s  %-40s %s\n' "$d" "$b" "$(basename "$f")"
    done
  done
  echo "whichever reaches production first sets the mark and the other is skipped; renumber one before either ships"
fi

if [ -n "$missing" ]; then
  echo
  echo "refusing: the ladder has a hole at:$missing"
  echo "shipping now sets production's mark to $last, and every number in the hole would be skipped later."
  echo "merge the missing migrations first, or renumber above $last."
  exit 1
fi
echo "ladder is gapless from $first to $last"
