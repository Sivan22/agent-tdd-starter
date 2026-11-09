---
summary: The owner's rulings on the template, hosting, releases, migrations and the working method, newest first.
---
# Platform: decisions

Add a new ruling at the top. Never rewrite one: when the owner replaces a ruling, add the new
ruling and mark the old one "Superseded by". The working rules themselves live in
[AGENTS.md](../../AGENTS.md); this file records when and why the owner ruled.

## 2026-11-09: a QA agent in a real browser, beside the hostile review

- **Ruling:** the template carries the source project's QA gate. A change a user can see passes
  two gates that run at the same time: the hostile review reads the code, and a fresh `qa-tester`
  agent uses the application in a real headless Chromium, step by step through `playwright cli`,
  and writes `QA: PASS`, `QA: PASS, with earlier problems` or `QA: FAIL` with its screenshots,
  which the session posts on the pull request. Every problem the change caused is fixed, minor ones included; a
  problem that predates it is filed as an issue. A change with nothing visible needs only the
  review, and a skipped QA gate is named in the pull request with its reason.
- **Owner's words:** "lets add the idea of the QA agent also to [this template] and open pr".
- **Why:** reading code misses what a user sees, and a spec checks only what someone thought to
  write.
- **As the builder carried it to a general template:** this template has no seed and each test
  owns its data, so `pnpm qa:host` makes two disposable accounts and removes them when it stops.
  It assumes no resource manager around it, so it also ends cleanly on a signal. A mission commits
  first and gates that commit; the review and QA finish before the push, so the agent writes its
  report and the session posts it once the pull request exists. The agent never writes to GitHub.
- **Where it holds:** [AGENTS.md](../../AGENTS.md#qa-gate), `.claude/agents/qa-tester.md`,
  [the QA runbook](../runbooks/qa.md), [testing](../system/platform/testing.md#the-qa-gate).

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
