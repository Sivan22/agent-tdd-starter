---
summary: The owner's rulings on the template, hosting, releases, migrations and the working method, newest first.
---
# Platform: decisions

Add a new ruling at the top. Never rewrite one: when the owner replaces a ruling, add the new
ruling and mark the old one "Superseded by". The working rules themselves live in
[AGENTS.md](../../AGENTS.md); this file records when and why the owner ruled.

## 2026-11-06: one-click deployment on GitHub, Supabase and Vercel

- **Ruling:** Vercel is part of the stack. The README's «Deploy with Vercel» button creates the
  whole setup in one flow: the repository in the user's GitHub, a Vercel project that deploys
  `main`, and a Supabase project from the Vercel Marketplace whose variables Vercel injects.
- **Owner's words:** "and also make it deploy to vercel in one click (if you have supabase
  integration) its part of the stack", then "the setup is github+supabase+vercel".
- **How the builder carried it out:** the production build applies migrations itself
  (`supabase db push` after `pnpm build`), so a fresh deployment has its schema without a
  dashboard step, and a merge to `main` deploys and migrates together. Supabase's GitHub
  integration is used only for preview branches. Supabase Auth's URLs and the preview database
  stay manual settings, because the button cannot reach them. Rules that follow, also the
  builder's, awaiting the owner: only Git-started production builds of `main` migrate; a
  migration works with the code already in production (add first, use later, remove last);
  a migration on `main` is never edited or deleted, even by a revert (CI refuses it), except one
  production never applied, named in an `Unapplied-migration: NNNN` commit trailer; a release
  is undone with Vercel's Instant Rollback; the Vercel CLI never deploys.
- **Where it holds:** `README.md`, `vercel.json`, `scripts/migrate-production.sh`,
  `scripts/check-migrations-immutable.sh`, `tests/deploy/`, [Deploy](../runbooks/deploy.md),
  [Release](../runbooks/release.md), [Platform](../system/platform/README.md).

## 2026-11-06: publish as a public MIT template, with one commit, and keep the secret scan and audit

- **Ruling:** publish the template as the public GitHub repository `Sivan22/agent-tdd-starter`,
  marked as a template repository, under the MIT licence, as a single commit with no earlier
  history. CI keeps the secret scan and the production dependency audit.
- **Owner's words:** "Sivan22/agent-tdd-starter public teplate MIT squash no history wanted yes",
  answering where to publish, the licence, whether to squash the history, and whether the
  secret scan and `pnpm audit` should come back to CI.
- **Where it holds:** `LICENSE`, `package.json`, `.github/workflows/ci.yml`,
  `scripts/security/scan-secrets.sh`, `.gitleaks.toml`.
- **Supersedes in part:** [a general template, without a layered security model](#2026-11-06-a-general-template-without-a-layered-security-model),
  for secret scanning and the dependency audit only.

## 2026-11-06: a general template, without a layered security model

Superseded in part by [publish as a public MIT template](#2026-11-06-publish-as-a-public-mit-template-with-one-commit-and-keep-the-secret-scan-and-audit):
CI keeps the secret scan and the dependency audit.

- **Ruling:** a standalone repository that carries the source project's method (missions on
  their own branches, tests first, the hostile review, documentation in the same commit, the
  migration ladder, generated schema files, CI and the release gate) on a light, general stack.
  Access is decided by the page (`requireUser`) and by row-level security in the database.
- **Owner's words:** "create a skeleton repo project from this as teplate: the stack, the agents
  instructions, the docs aerch, anything here that can adopt to abrand new repo that we will
  publish as agent-tdd-deriven full stack development exapmle to start from scratch a new
  project with the pipelines and methedology we use here", then "create it as a seperate repo",
  then "we dont have to copy the double security model security" and "it should ne more
  general".
- **Not carried over, as the builder read the last two asks:** the nonce content security
  policy, the proxy auth wall with its public-path list, hardened session-cookie options, the
  server-only boundary test suite, secret scanning and the dependency audit in CI, the rules for
  protected health data and cloud administrator logins, the driver agent for another coding
  tool, and the host-specific resource manager (AGENTS.md keeps a general rule for any admission
  wrapper a host provides).
- **Why:** the template is a starting point for any project; a project that needs more adds it
  where its own threat model calls for it.
- **Where it holds:** `proxy.ts`, `lib/auth/require-user.ts`, `supabase/migrations/0001_notes.sql`,
  `.github/workflows/ci.yml`, [Architecture](../system/architecture.md), [AGENTS.md](../../AGENTS.md).
