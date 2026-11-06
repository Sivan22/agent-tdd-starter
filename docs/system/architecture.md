---
summary: Stack, repository layout, how a request travels from a page to the database, and the shared UI conventions.
covers:
  - proxy.ts
  - next.config.ts
  - app/layout.tsx
  - app/page.tsx
  - lib/env.ts
  - lib/utils.ts
  - lib/supabase/**
  - lib/db/**
  - components/ui/**
---
# Architecture

## Purpose

How the application is built: the stack, where code lives, how a request reaches the database,
and the rules every feature shares. Read it before adding a route, a Server Action, a Supabase
call or a shared component.

## Behaviour

### Stack

`package.json` holds the exact versions.

| Layer | Choice |
| --- | --- |
| Runtime | Node 24 and pnpm 10 (`engines`, `packageManager`) |
| Hosting | Vercel, with Supabase from the Vercel Marketplace ([deploy](../runbooks/deploy.md)) |
| Framework | Next.js 16 App Router with `proxy.ts` in place of middleware, React 19, TypeScript |
| Styling and UI | Tailwind CSS 4 (`app/globals.css`), shadcn components on `@base-ui/react` (`components.json`), `lucide-react` icons |
| Data | Supabase: Postgres with row-level security and Auth, through `@supabase/supabase-js` and `@supabase/ssr` |
| Validation | Zod 4 |
| Tests | Vitest and Playwright; see [testing](platform/testing.md) |
| Lint | ESLint with `eslint-config-next` (`eslint.config.mjs`) |

### Repository layout

| Folder | Holds |
| --- | --- |
| `app/` | Routes: pages, layouts, route handlers and Server Actions (`actions.ts`). |
| `components/` | React components by area; `components/ui/` holds the shared primitives. |
| `lib/` | Logic by area, the Supabase client in `lib/supabase/`, generated types in `lib/db/`. |
| `supabase/` | `config.toml` and the numbered migrations. |
| `tests/` | Vitest suites: unit, RLS and docs. |
| `e2e/` | Playwright specs. |
| `scripts/` | Database, documentation and release tools. |
| `docs/` | This documentation; [the index](../README.md) explains its layout. |

The import alias `@/` is the repository root (`tsconfig.json`).

### Layers

1. `proxy.ts` runs before every page and refreshes the Supabase session cookie. It decides
   nothing about access.
2. A page is a Server Component. A page that needs a user calls `requireUser()`
   (`lib/auth/require-user.ts`), which sends a signed-out caller to `/login`, and reads through
   that user's client.
3. A change goes through a Server Action. The action parses its input with Zod, then writes
   through the caller's client from `supabaseServer()` (`lib/supabase/server.ts`), so row-level
   security applies to every write.
4. Business rules live in the database: constraints, policies and functions. The UI repeats a
   rule only to give a friendly message. A hidden button is a convenience; the database still
   refuses.
5. Every Supabase client is typed with `Database` from `lib/db/types.gen.ts`, generated from the
   schema.
6. Server-only modules import `server-only`, so a client component that imports one fails the
   build. A secret key never reaches the browser.
7. Configuration is read through `lib/env.ts`: a missing variable throws where it is read.

### UI conventions

1. Pages compose the primitives in `components/ui/` and Tailwind classes; a new primitive comes
   from the shadcn registry (`pnpm exec shadcn add <name>`), not from a parallel style.
2. Every control has an accessible name, and every error is announced (`role="alert"`). The
   browser tests find elements by role and name, so an unnamed control is also untestable.

## Where it lives

| Concern | Code | Database | Test |
| --- | --- | --- | --- |
| Session refresh | `proxy.ts` | Supabase Auth | `e2e/notes.spec.ts` |
| The caller's database client | `lib/supabase/server.ts` (`supabaseServer`) | RLS on every table | `tests/rls/notes.test.ts` |
| Configuration | `lib/env.ts` (`present`, `supabasePublicConfig`) | none | the build |
| Generated types | `lib/db/types.gen.ts` | the schema | `pnpm db:check-schema` |

## Invariants

- Every table has RLS enabled, policies and explicit grants; `docs/db/schema-rls.txt` lists them
  and the RLS suite proves them.
- No module that reads a secret is imported by a client component.

## When it goes wrong

| Symptom | Cause | Check |
| --- | --- | --- |
| A signed-in user is sent back to `/login` | The session cookie was not refreshed or the stack was restarted | Sign in again; check `proxy.ts` runs for the path (its `matcher`) |
| A query returns no rows that should be visible | RLS refuses the caller | Read the table's policies in `docs/db/schema.snapshot.sql` |

## Open questions

- None.

## Decisions

- [2026-11-06: a general template, without a layered security model](../decisions/platform.md#2026-11-06-a-general-template-without-a-layered-security-model)
