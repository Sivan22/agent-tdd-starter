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

1. Create the project with «Deploy with Vercel» in the template's README: it creates the GitHub
   repository, the Vercel project and the Supabase project together ([deploy](deploy.md)). For
   code only, without hosting yet, use «Use this template» on GitHub or
   `gh repo create <owner>/<name> --template Sivan22/agent-tdd-starter --private --clone`.
   Then clone and install:

   ```bash
   git clone https://github.com/<owner>/<name>.git && cd <name>
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
   cases, spec and documents. Then remove it in two releases, because the previous deployment
   serves while a new one migrates: first remove its code, tests and documents (its pages are
   gone from that release); in a later release, add a migration that drops the table. Its
   original migration stays forever. `pnpm docs:check` shows anything left behind.
8. Point the README's «Deploy with Vercel» button at your repository (`repository-url`,
   `project-name`, `repository-name`), or remove the button and its cases in
   `tests/deploy/deploy-config.test.ts`.
9. If step 1 did not deploy, follow [deploy](deploy.md) from its first step. Either way, finish
   its Auth settings and preview database steps: `supabase/config.toml` only configures the local
   stack.
10. Protect `main` on GitHub: require pull requests and the CI check.

## Check it worked

- `pnpm docs:check` reports no problems and CI is green on the first pull request.

## If it fails

| Symptom | Meaning | Next step |
| --- | --- | --- |
| `supabase start` reports a port in use | Another project uses the block | Choose another block (step 3) |

## Never

- Copy another project's `.env` or production values into this one.
