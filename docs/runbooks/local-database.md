---
summary: Start, connect, migrate, regenerate and stop the local Supabase stack, and what never to do to it.
covers:
  - scripts/local-env.sh
---
# Local database

## When to use it

Setting up a checkout, adding a migration, or regenerating the schema files. Every checkout and
worktree of this project shares the one local stack that `supabase/config.toml` describes.

## Before you start

- Docker is running, the PostgreSQL client (`psql`) is installed, and the Supabase CLI comes from
  the project (`pnpm supabase`).
- The stack's ports are in `supabase/config.toml`. Another project on the same machine needs its
  own block: change every port there and the URL in `.env.example`; the scripts read the running
  stack's addresses from `supabase status`.

## Steps

1. Start the stack. The first start applies every migration:

   ```bash
   pnpm supabase start
   ```

2. Write `.env` from the running stack (it keeps any other lines already in `.env`):

   ```bash
   bash scripts/local-env.sh
   ```

3. After adding a migration, apply it without touching existing data:

   ```bash
   pnpm supabase migration up
   ```

4. On a clean stack with every migration applied, regenerate the schema files and check them:

   ```bash
   pnpm gen:types
   pnpm db:schema
   pnpm db:check-schema
   ```

5. Stop the stack when you are done; its data survives a stop:

   ```bash
   pnpm supabase stop
   ```

## Check it worked

- `pnpm supabase status` lists the API URL, and it matches `NEXT_PUBLIC_SUPABASE_URL` in `.env`.
- `pnpm vitest run tests/rls/notes.test.ts` passes.

## If it fails

| Symptom | Meaning | Next step |
| --- | --- | --- |
| A port is already allocated | Another stack uses this block | Stop it, or give this project another block |
| `pnpm db:check-schema` reports drift on a stack other branches use | The stack holds another branch's schema | Regenerate on a stack with exactly this branch's migrations |

## Never

- Reset or reseed a stack another worktree is using (`supabase db reset`) without the owner's
  approval: it deletes their data mid-run.
- Point a generator, a test or a script at a production database.
