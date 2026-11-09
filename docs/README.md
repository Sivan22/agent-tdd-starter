# Documentation

These documents describe the application as it is now, for the agents and people who change it.
Start with [the overview](system/overview.md), then read the document for the area you are about
to change and its decisions. [AGENTS.md](../AGENTS.md) holds the working rules.

## What lives where

| Folder | Holds | Changes when |
| --- | --- | --- |
| `system/` | How each area behaves now, one document per area, in the present tense. | The behaviour changes, in the same commit. |
| `decisions/` | The owner's rulings per area, dated and quoted, newest first. | The owner rules. Add an entry; never rewrite one. |
| `runbooks/` | Procedures with exact commands: release, local database, starting a project. | The procedure changes. |
| `reference/` | Stable facts: the glossary, and the `generated/` inventories. | The source changes. `generated/` changes only through `pnpm docs:gen`. |
| `db/` | The generated schema snapshot and security digest, and how to read them. | Through `pnpm db:schema` on a clean stack. |
| `history/` | Frozen records: audits, retrospectives, release notes. | Never. Add a new file instead. |

## Reading

- Every system document has the same sections: Purpose, Behaviour, Where it lives, Invariants,
  When it goes wrong, Open questions and Decisions.
- The `covers` list in a document's frontmatter names the code it describes. To find the
  document for a file, search for its folder: `grep -rl "lib/notes" docs/system docs/runbooks`.
  The [routes inventory](reference/generated/routes.md) maps every URL to its document.
- A rule in a system document is current. When the code disagrees, one of them is a bug. Say
  which in your report; do not quietly follow either.
- A decision explains why a rule exists. Do not reopen it without the owner.
- History is evidence of the past, not instructions.

## Updating

1. Change the system document in the same commit as the behaviour. `pnpm docs:owed <base>`
   lists the documents whose code you changed while they did not.
2. When the owner rules, add the ruling to `decisions/<area>.md` and change the rule in the
   system document.
3. After adding a route, an environment variable, a bucket, a scheduled job or a package script,
   run `pnpm docs:gen`.
4. Run `pnpm docs:check` before handing over. It is fast and needs no database.
5. For a new area, copy a template from [`_templates/`](_templates/system.md), fill in `covers`,
   and run `pnpm docs:gen`.

## Writing rules

- Write what is true now. No "since", "previously" or "used to", and no ticket or pull request
  numbers. Dates belong in `decisions/`; elsewhere a date only names the ruling an open question
  refers to.
- Point at the code that owns a fact, such as `lib/notes/input.ts`, instead of copying a list it
  owns. Never cite line numbers; they move.
- Keep rollout and deploy steps out of system documents. They belong in the pull request or a
  runbook.
- Quote interface text exactly as the code has it, so a search finds both.
- Keep a document under about 400 lines. Split a large area into a folder with a README.

`pnpm docs:check` enforces the mechanical rules: frontmatter and one title, closed code fences,
links and anchors, cited repository paths, and in system documents, runbooks and reference no
ticket ids (the keys are `TICKET_KEYS` in `scripts/docs/model.ts`), pull request numbers,
migration high-water claims, review-date banners or line-number citations. It also requires every
code file to be claimed by some `covers`, the generated files to be current, and document paths
cited from code to exist. The other writing rules are for the writer and the reviewer. The Vitest
suite runs the same check through `tests/docs/`.

## Index

<!-- docs-index:start -->
### System: how the app behaves now

- [Architecture](system/architecture.md): Stack, repository layout, how a request travels from a page to the database, and the shared UI conventions.
- [Authentication](system/auth.md): Signing in, creating an account and signing out with Supabase Auth email and password.
- [Notes](system/notes.md): The example feature: a user writes, reads and deletes private notes; nobody else can see them.
- [Overview](system/overview.md): What the application is, who uses it, and the one example flow it ships with.
- [Platform](system/platform/README.md): Hosting, environments, migrations, generated schema files, CI, the documentation tooling and the release gate.
- [Testing](system/platform/testing.md): How the Vitest and Playwright suites are organised, how tests own their data, and which command runs what.

### Decisions: owner rulings

- [Platform: decisions](decisions/platform.md): The owner's rulings on the template, hosting, releases, migrations and the working method, newest first.

### Runbooks: procedures

- [Deploy](runbooks/deploy.md): Deploy the stack in one click (GitHub, Vercel, Supabase), what each production build does to the database, and the settings that remain.
- [Local database](runbooks/local-database.md): Start, connect, migrate, regenerate and stop the local Supabase stack, and what never to do to it.
- [Start a new project from this template](runbooks/new-project.md): Turn a copy of this template into a new project: names, ports, ticket keys, the example feature and the hosting.
- [QA gate](runbooks/qa.md): Run the QA gate, a QA agent using the application in a real headless Chromium, beside the hostile review.
- [Release](runbooks/release.md): Release a reviewed candidate to production by merging main, and check that its build applied the migrations.

### Reference

- [Storage buckets](reference/generated/buckets.md): Every storage bucket and the migration that creates it.
- [Scheduled jobs](reference/generated/crons.md): The scheduled jobs Vercel runs, their schedules (UTC) and handlers.
- [Environment variables](reference/generated/env.md): Every environment variable the code reads, where it is read, and whether .env.example lists it.
- [Routes](reference/generated/routes.md): Every page and route handler, its URL and the system document that covers it.
- [Package scripts](reference/generated/scripts.md): Every package.json script and the command it runs.
- [Glossary](reference/glossary.md): The words this repository's rules and documents use, and what each means here.

### Database

- [Database reference](db/README.md): The generated schema snapshot, security digest and types, how to regenerate them, and how they relate to migrations.

### History: frozen records

- [History](history/README.md)

<!-- docs-index:end -->
