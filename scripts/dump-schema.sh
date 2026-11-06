#!/usr/bin/env bash
# Regenerate the current-state schema files from the local stack, or SUPABASE_DB_URL when set.
#
# Migrations are history: append-only and never edited. These files are state: what the schema
# looks like after every migration has run. Read them to audit; read migrations to learn how the
# schema got here. Both are generated, never edited by hand (docs/db/README.md).
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"
if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  db="$SUPABASE_DB_URL"
  db_args=(--db-url "$db")
else
  # The running stack's own address, so the port always follows supabase/config.toml.
  status="$(pnpm exec supabase status -o env 2>/dev/null || true)"
  db="$(printf '%s\n' "$status" | sed -n 's/^DB_URL="\(.*\)"$/\1/p')"
  [[ -n "$db" ]] || { echo "dump-schema: is the stack running? (pnpm supabase start)" >&2; exit 1; }
  db_args=(--local)
fi
snapshot_out="${SCHEMA_SNAPSHOT_OUT:-$root/docs/db/schema.snapshot.sql}"
rls_out="${SCHEMA_RLS_OUT:-$root/docs/db/schema-rls.txt}"
mkdir -p "$(dirname "$snapshot_out")" "$(dirname "$rls_out")"

snapshot_tmp="$(mktemp "${snapshot_out}.tmp.XXXXXX")"
rls_tmp="$(mktemp "${rls_out}.tmp.XXXXXX")"
trap 'rm -f "$snapshot_tmp" "$rls_tmp"' EXIT

# 1. The full public DDL, grants and policies included, from the project-pinned CLI so the
#    output does not depend on the host's pg_dump version.
pnpm exec supabase db dump "${db_args[@]}" --schema public --file "$snapshot_tmp" >/dev/null 2>&1
# The CLI ends the file with several blank lines; keep the diff whitespace-clean.
awk 'NF { while (blank > 0) { print ""; blank-- } print; next } { blank++ }' "$snapshot_tmp" > "$snapshot_tmp.n"
mv "$snapshot_tmp.n" "$snapshot_tmp"

# 2. The security digest: one line per table with the grants each API role holds. Tables with
#    RLS off sort to the top. service_role bypasses RLS, so its grants are its only limit.
psql "$db" -q -P pager=off --no-psqlrc -o "$rls_tmp" <<'SQL'
\pset footer off
select
  c.relname as "table",
  case when c.relrowsecurity then 'ON' else '*** OFF ***' end as "rls",
  (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as "policies",
  coalesce((select string_agg(distinct g.privilege_type, ',' order by g.privilege_type)
    from information_schema.role_table_grants g
    where g.table_schema = 'public' and g.table_name = c.relname and g.grantee = 'anon'), '-') as "anon_grants",
  coalesce((select string_agg(distinct g.privilege_type, ',' order by g.privilege_type)
    from information_schema.role_table_grants g
    where g.table_schema = 'public' and g.table_name = c.relname and g.grantee = 'authenticated'), '-') as "authed_grants",
  coalesce((select string_agg(distinct g.privilege_type, ',' order by g.privilege_type)
    from information_schema.role_table_grants g
    where g.table_schema = 'public' and g.table_name = c.relname and g.grantee = 'service_role'), '-') as "service_grants"
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;
SQL
sed -i 's/[[:space:]]*$//' "$rls_tmp"

mv "$snapshot_tmp" "$snapshot_out"
mv "$rls_tmp" "$rls_out"
trap - EXIT
printf 'wrote %s (%s lines)\nwrote %s (%s lines)\n' "$snapshot_out" "$(wc -l < "$snapshot_out")" "$rls_out" "$(grep -c . "$rls_out")"
