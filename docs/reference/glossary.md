---
summary: The words this repository's rules and documents use, and what each means here.
---
# Glossary

| Term | Meaning |
| --- | --- |
| Mission | One unit of work (a feature, a fix, a docs or process change) with its own branch, worktree and pull request. |
| Owner | The person who decides what the product does, approves every merge, and whose rulings go in `docs/decisions/`. |
| Builder | The agent or person who writes a mission's code and tests. |
| Hostile review | A review by a fresh agent that did not write the change and tries to break it (`.claude/agents/hostile-reviewer.md`). Its verdict is PASS or FAIL. |
| Failing-first test | A test written before the code, run once to watch it fail for the reason the change addresses. |
| Evidence | The exact commands a check ran, on which commit and inputs, and their results. |
| Root checkout | The directory holding the shared `.git`, with `main` checked out. Missions work in worktrees under `.worktrees/`. |
| Applied mark | The highest migration version production has applied. A migration numbered below it can no longer be applied: the production build refuses it. |
| Migration ladder | The sequence of migration numbers above the applied mark. It must have no hole. |
| Release gate | `scripts/verify-release.sh`: the ladder, unchanged released migrations, typecheck, lint, schema drift, Vitest and the production build, once, on the candidate about to reach `main`. CI runs the browser suite. |
| Instant Rollback | Vercel's way to serve an earlier production deployment again without building it, so no migration runs. The way to undo a release. |
| System document | `docs/system/<area>.md`: how an area behaves now, and the code it covers. |
| RLS | Row-level security: Postgres policies that decide which rows each caller may read and write. |
