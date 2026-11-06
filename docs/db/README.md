---
summary: The generated schema snapshot, security digest and types, how to regenerate them, and how they relate to migrations.
---
# Database reference

Three sources answer three different questions.

| Question | Read |
| --- | --- |
| What does the schema look like now? | The generated files in this folder and `lib/db/types.gen.ts` |
| What has production applied? | Production's migration ledger ([release](../runbooks/release.md)) |
| How did the schema get this way? | `supabase/migrations/` |

`supabase/migrations/` is the append-only history and the authority for schema changes, but a
poor way to learn a table's current shape, because that means replaying every migration. The
generated files remove that replay.

## The generated files

- `schema-rls.txt` is the security digest: one line per `public` table with RLS on or off, the
  number of policies, and the grants `anon`, `authenticated` and `service_role` hold.
  `service_role` bypasses RLS, so its grants are its only limit. Tables with RLS off sort to
  the top, so a regression shows on the first lines. Read it first in a review.
- `schema.snapshot.sql` is the full `public` DDL, grants included and each policy beside its
  table. Its diff in a pull request shows a migration's net effect.
- `lib/db/types.gen.ts` holds the TypeScript types generated from the same schema.

## Regenerating

```bash
pnpm gen:types        # lib/db/types.gen.ts
pnpm db:schema        # docs/db/schema.snapshot.sql and docs/db/schema-rls.txt
pnpm db:check-schema  # compare all three with a fresh dump, replacing nothing
```

- Generate only from a clean stack with every committed migration applied; a stack that holds
  another branch's schema adds or drops objects that are not yours.
- `SUPABASE_DB_URL` points the generators at another local database.
- Never edit a generated file by hand, and never point a generator at production.
