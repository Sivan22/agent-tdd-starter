-- Notes: each signed-in user's private notes. docs/system/notes.md describes the behaviour.

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The same limits as lib/notes/input.ts: non-empty, no surrounding whitespace, bounded length.
  title text not null check (char_length(title) between 1 and 120 and title !~ '^\s|\s$'),
  body text not null default '' check (char_length(body) <= 10000 and body !~ '^\s|\s$'),
  created_at timestamptz not null default now()
);

create index notes_owner_created_idx on public.notes (owner_id, created_at desc);

alter table public.notes enable row level security;

-- Explicit grants: start from none and give each role only what the feature needs. Supabase's
-- default privileges grant ALL on a new table to anon, authenticated and service_role, so the
-- revoke names all three. Notes are never edited, so no role holds UPDATE.
revoke all on table public.notes from anon, authenticated, service_role;
grant select, insert, delete on table public.notes to authenticated;
grant select, insert, delete on table public.notes to service_role;

create policy notes_select_own on public.notes
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy notes_insert_own on public.notes
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy notes_delete_own on public.notes
  for delete to authenticated
  using (owner_id = (select auth.uid()));
