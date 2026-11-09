---
summary: Turn a copy of this template into a new project: names, ports, ticket keys, the example feature and the hosting.
---
# Start a new project from this template

## When to use it

Once, when a new repository is created from this one.

## Before you start

- Node 24, pnpm 10, Docker, the PostgreSQL client (`psql`) and the GitHub CLI are installed.
- The owner has named the project and chosen its hosting.

## Steps

1. Create the repository from the template on GitHub, clone it and install:

   ```bash
   gh repo create <owner>/<name> --template Sivan22/agent-tdd-starter --private --clone
   cd <name>
   pnpm install
   pnpm exec playwright install chromium
   ```

2. Rename the project: `name` in `package.json`, `project_id` in `supabase/config.toml`, and
   the title in `app/layout.tsx`. Replace `LICENSE` and the `license` field in `package.json`
   if the new project is not MIT-licensed.
3. Choose a free port block for the local stack and change every port in
   `supabase/config.toml` and the URL in `.env.example`. The scripts read the running stack's
   addresses from `supabase status`, so nothing else names a port.
4. Set `TICKET_KEYS` in `scripts/docs/model.ts` to your issue tracker's keys.
5. Start the stack, write `.env` and run every check once
   ([local database](local-database.md)):

   ```bash
   pnpm supabase start
   bash scripts/local-env.sh
   pnpm test
   E2E_PORT=3100 pnpm test:e2e
   ```

6. Replace [the overview](../system/overview.md) with your product's, and write the owner's first
   rulings in `docs/decisions/`.
7. Keep the notes feature as a reference until your first feature has its own migration, RLS
   cases, spec and documents, then delete it in one commit: its migration stays (a pushed
   migration is never removed); add a new migration that drops the table, and remove the code,
   tests and documents. `pnpm docs:check` then shows anything left behind.
8. Fit the QA gate to your product: its sign-in page, its kinds of user and the stand-ins for its
   external services ([adapting it](qa.md#adapting-it-to-your-project)).
9. Connect hosting: a Supabase project with the GitHub integration (or a release step running
   `supabase db push`), and a Vercel project or another Node host with the production variables
   from `.env.example`. Give preview deployments their own database.
10. Apply the Auth settings to the hosted Supabase project, because `supabase/config.toml` only
   configures the local stack: the minimum password length, the site URL and redirect URLs, and
   email confirmation (Authentication settings in the dashboard, or `pnpm supabase config push`
   from a linked checkout).
11. Protect `main` on GitHub: require pull requests and the CI check.

## Check it worked

- `pnpm docs:check` reports no problems and CI is green on the first pull request.

## If it fails

| Symptom | Meaning | Next step |
| --- | --- | --- |
| `supabase start` reports a port in use | Another project uses the block | Choose another block (step 3) |

## Never

- Copy another project's `.env` or production values into this one.
