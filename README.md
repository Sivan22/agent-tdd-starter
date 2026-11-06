# agent-tdd-starter

A starting point for full-stack web applications built by AI coding agents, test first, with a
human owner in charge. It packages a working method and a small working app that demonstrates
every step of it:

- **Missions** on their own branch and worktree, each ending in a pull request.
- **Tests first**: the failing test is written and watched fail before the code.
- **Rules in the database**: row-level security, explicit grants and constraints, each proven by
  a test that talks to the database directly.
- **A hostile review**: a fresh agent that did not write the change tries to break it before
  anyone calls it verified.
- **Documentation in the same commit**: one document per area that says how it behaves now,
  dated owner rulings beside it, and a checker that fails when they drift from the code.
- **Release safety**: a migration-ladder check, generated schema files that CI compares against
  the database, and one release gate.

The stack is Next.js 16, React 19, TypeScript, Tailwind CSS 4 with shadcn on Base UI, Supabase
(Postgres with row-level security, Auth), Zod, Vitest and Playwright, on pnpm and Node 24. The
method does not depend on it; [AGENTS.md](AGENTS.md) keeps the stack-specific rules in one section.

## The loop

```text
 owner's ask
     │
     ▼
 scope in chat ──► worktree + branch (.worktrees/<nnn>-<slug>)
                        │
                        ▼
                failing test (Vitest, RLS case, Playwright)  ◄──┐
                        │                                       │
                        ▼                                       │
                code + migration until green                    │
                        │                                       │
                        ▼                                       │
                checks for what changed + docs in same commit   │
                        │                                       │
                        ▼                                       │
                hostile review (fresh agent) ── FAIL ───────────┘
                        │ PASS
                        ▼
                push branch, open pull request, CI green
                        │
                        ▼
                owner merges = release (ladder check, release gate)
```

## Quick start

Prerequisites: Node 24, pnpm 10, Docker, and the PostgreSQL client (`psql`), which the schema
tools use.

```bash
pnpm install
pnpm exec playwright install chromium   # the browser the e2e suite drives
pnpm supabase start                     # local Postgres, Auth and Studio (ports in supabase/config.toml)
bash scripts/local-env.sh               # writes .env from the running stack
pnpm dev                                # http://127.0.0.1:3000
```

Run the checks:

| Command | What it does |
| --- | --- |
| `pnpm tsc --noEmit` | Typecheck |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest: unit, RLS policy cases and the documentation checker |
| `E2E_PORT=3100 pnpm test:e2e` | Playwright, with its own dev server |
| `pnpm db:check-schema` | The generated schema files match the database |
| `pnpm docs:check` | The documentation rules |
| `bash scripts/security/scan-secrets.sh` | Committed secrets, with a negative control |
| `bash scripts/verify-release.sh <applied-mark>` | The release gate: migration ladder, typecheck, lint, schema drift, Vitest and the production build |

## Where to read next

| You want to | Read |
| --- | --- |
| Work in this repository, as an agent or a person | [AGENTS.md](AGENTS.md) |
| Start your own project from this template | «Use this template» on GitHub, then [start a new project](docs/runbooks/new-project.md) |
| See the worked example end to end | [Notes](docs/system/notes.md): `supabase/migrations/0001_notes.sql`, `tests/rls/notes.test.ts`, `tests/unit/note-input.test.ts`, `e2e/notes.spec.ts` |
| Understand the documentation system | [The documentation index](docs/README.md) |
| Run a hostile review | `.claude/agents/hostile-reviewer.md` |
| Release | [The release runbook](docs/runbooks/release.md) |

## What is in the box

| Path | Holds |
| --- | --- |
| `AGENTS.md`, `CLAUDE.md` | The working rules every agent reads first |
| `.claude/agents/hostile-reviewer.md` | The adversarial reviewer's brief |
| `.github/workflows/ci.yml` | CI: secret scan, dependency audit, and every check against a throwaway Supabase stack |
| `.github/pull_request_template.md` | The evidence a pull request carries |
| `docs/` | System documents, decisions, runbooks, reference, schema files, templates |
| `scripts/docs/` | `docs:check`, `docs:gen` and `docs:owed` |
| `scripts/*.sh` | Migration ladder, schema generation and drift, `.env` writer, release gate |
| `app/`, `components/`, `lib/` | The example app: sign in, private notes |
| `supabase/` | Local stack configuration and numbered migrations |
| `tests/`, `e2e/` | Vitest and Playwright suites |

## License

[MIT](LICENSE)
