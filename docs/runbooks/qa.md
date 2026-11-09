---
summary: Run the QA gate, a QA agent using the application in a real headless Chromium, beside the hostile review.
covers:
  - scripts/qa/**
  - .claude/agents/qa-tester.md
---
# QA gate

## When to use it

A change a user can see (a page, a control, copy, layout, an export, what a request returns to
the screen) passes two gates that run at the same time: the hostile review reads the code, and a
`qa-tester` agent ([definition](../../.claude/agents/qa-tester.md)) uses the application as a
user does, in a real headless Chromium, step by step, and writes its verdict with screenshots,
which the session posts on the pull request.

A change with nothing visible (docs, CI, internals whose output is unchanged) needs only the
review. When the local application cannot show the change, QA checks what it shows around the
change and the pull request says what it could not; with nothing left to show, QA is skipped and
the pull request names the reason. The gate does not replace the Playwright specs: they keep what
is known working, and QA finds what nobody wrote a spec for.

## Before you start

- The local stack is running and `.env` points at it ([local database](local-database.md)). The
  host never seeds; it makes its own accounts.
- The browser is installed (`pnpm exec playwright install chromium`).
- `gh pr comment --help` lists `--attach` (GitHub CLI 2.99 or later).
- The session that owns the branch runs the setup below; the QA agent runs the host.

## Steps

### Setup, by the session that owns the branch

1. Commit on the branch; QA tests a commit, and nothing needs pushing first. Give the QA agent its
   own worktree at that commit, so the reviewer keeps the mission worktree for its own checks.
   With `$root` the root checkout
   (`dirname "$(git rev-parse --path-format=absolute --git-common-dir)"`):

   ```bash
   git worktree add --detach "$root/.worktrees/qa-<nnn>" <sha>
   cp "$root/.env" "$root/.worktrees/qa-<nnn>/.env"
   cd "$root/.worktrees/qa-<nnn>" && pnpm install --frozen-lockfile
   ```

2. Create an evidence directory outside every worktree (`mkdir -p <dir>`, in a session scratchpad
   or a temporary directory) and pick an unused application port.
3. Start a fresh `qa-tester` with the worktree, the pull request or issue if there is one, the
   claim and what to check, the owner's decisions, the directory, the port, and any earlier
   evidence to compare with. Start the `hostile-reviewer` in the same message. If the `qa-tester`
   agent type is unavailable, give the brief to a fresh general-purpose agent told to follow its
   definition.
4. When both report, fix every problem they confirm the change caused, minor ones included. For a
   fix that changes what users see, move the QA worktree to the new head
   (`git -C "$root/.worktrees/qa-<nnn>" checkout --detach <sha>`) and send the delta to the same
   QA agent, as the fix delta goes to the same reviewer.
5. As soon as `gh pr create` returns, post the agent's report
   ([Evidence on GitHub](#evidence-on-github)), and post its new report after each fix delta.
6. When the pull request merges or closes, check that `host.log` ends with
   `[qa] stopped and cleaned up` (or `touch <dir>/stop`), then
   `git worktree remove "$root/.worktrees/qa-<nnn>"`.

### Host

From the QA worktree, in the background:

```bash
mkdir -p <dir>
E2E_PORT=<port> QA_DIR=<dir> QA_SESSION=qa-<nnn> nohup pnpm qa:host > <dir>/host.log 2>&1 &
```

`scripts/qa/host.ts` checks that the Supabase URL is on this machine and the port free, starts the
developer server as `pnpm test:e2e` does (`e2e/dev-server.ts`), makes two disposable accounts,
opens the browser session on `/login`, and writes `<dir>/ready.json` with the address, the commit
under test, the session, the cli command and the logins. Expect up to a minute or two to `READY`;
the first visit to each route compiles it, so a first screenshot can take a while.

- `touch <dir>/stop` ends it: the browser closes, the accounts and everything they own are
  removed, the server stops, and `host.log` ends with `[qa] stopped and cleaned up`.
- SIGINT and SIGTERM end it the same way.
- It also ends by itself after `QA_HOURS` (3 by default), so a session whose agent is gone frees
  the machine.
- If the session's browser closes on its own, `touch <dir>/reopen` opens it again on `/login`.
- A host killed outright (SIGKILL, out of memory) cleans nothing up: stop what is left of it, and
  its two `@test.local` accounts stay in the local stack, holding only what the session made.

The browser is driven directly:
`cd <dir> && <worktree>/node_modules/.bin/playwright cli -s=<session> <command>` (`ready.json` has
it as `cli`). Sessions are scoped to the worktree's Playwright install and to their name; never
use `close-all`, `kill-all` or `delete-data`. When the machine has a resource-admission wrapper
around `pnpm`, run the host through it and expect the worktree's other `pnpm` commands to wait
behind the host; the browser commands do not go through `pnpm`.

### Browser commands

`goto <url>`, `snapshot` (the page's accessibility tree with element refs such as `e15`),
`find <text>`, `click e15`, `fill e7 "text"`, `type "text"`, `press Enter`, `hover e4`,
`mousewheel 0 300`, `resize 430 800`, `screenshot --filename=<name>.png`, `video-start <name>.webm`
and `video-stop`, `console`, `requests`, `go-back`, `reload`, `tab-new <url>`, `eval "<js>"`,
`run-code "async page => { … }"`. Look at a screenshot with your image-reading tool. The full list
is `node_modules/.bin/playwright cli --help`.

### Technique

- **Sign in as a user does.** On `/login`, fill the email and password from `ready.json` and press
  «Sign in». The `qa-other` account is there to prove that one user's data stays out of another's
  sight.
- **Measure from the page's own data.** The snapshot shows what assistive technology sees;
  screenshots show what the user sees. When the two disagree, that is a finding. Re-read element
  refs from a fresh snapshot after any change: refs are not stable across renders.
- **Persistence.** After a save, reload and look again; open the same record in a second tab.
- **Before and after.** For a defect on `main`, give `main` its own QA worktree and port too: both
  hosts run at once, and the before stays open for a later question.
- **Bound before you file.** Reproduce from a fresh page, then vary one thing at a time: the
  bounded trigger is what a fix needs most.
- **Downloads without dialogs.** In `run-code`, start the download and wait for the page's
  `download` event, then `saveAs('<dir>/<name>')`.

### Evidence on GitHub

From `<dir>`:

```bash
gh pr comment <n> --body-file ./comment.md --attach './a.png#alt' --attach './b.webm'
```

uploads the images and videos and puts them inline where `comment.md` references them. Keep videos
short (one to two megabytes): a flow that moves, not a whole session. Keep `[` and `]` out of alt
text, and read the posted comment back: an image reference still shown as text is an image that
did not upload; `gh pr comment --edit-last` fixes it.

The session runs this; the QA agent never writes to GitHub. The review and QA finish before the
branch is pushed, so the agent leaves `comment.md` in `<dir>` and the session posts it as soon as
it has opened the pull request. Read every image first.

### From a finding to a spec

An issue the session files from a QA report, or a problem in the report, has the same parts: what happens; the steps
from sign-in; how often it reproduced and what does not trigger it; before and after screenshots,
and a video when motion matters; what was expected, citing the document; and the code it points
at, when known. File only what reproduced in the browser. The fix's failing-first test is a
Playwright spec that replays those bounded steps, so the suite keeps what QA found and QA moves on
to what nobody wrote a spec for.

### Adapting it to your project

The host is one file, and these are the parts a project changes:

| Your project has | Change |
| --- | --- |
| A different sign-in page | `LOGIN_PATH` in `scripts/qa/host.ts` |
| Roles or kinds of user | `ACCOUNT_LABELS` and the account setup in `scripts/qa/host.ts`, with what each account needs in the database |
| An external service (mail, payments, AI) | A stand-in the server turns on from its environment. Put its variables in one constant in `e2e/dev-server.ts` and pass that to both `webServer.env` in `playwright.config.ts` and the `spawn` in `startDevServer`, so the suite and the host stay the same server; list what QA should expect from it in this runbook |
| A language or time zone of its own | `contextOptions` in the browser configuration in `scripts/qa/host.ts` |

## Check it worked

- `host.log` holds `[qa] READY <url> session <name> at <commit>` and, after the stop, ends with
  `[qa] stopped and cleaned up`.
- The pull request carries one comment whose first line is `QA: PASS at <commit>`,
  `QA: PASS, with earlier problems at <commit>` or `QA: FAIL at <commit>`, with its images shown.
- Nothing still listens on the port.

## If it fails

| Symptom | Meaning | Next step |
| --- | --- | --- |
| `QA_DIR must be an absolute directory outside the worktree` | The evidence directory is inside the checkout | Use a scratchpad or temporary directory |
| `port <n> is in use` | A neighbour's server listens there | Choose another `E2E_PORT` |
| `Missing environment variable` or `Tests run only against a local Supabase stack` | The worktree's `.env` is missing or points elsewhere | Copy `.env` from the root checkout; never point it at a hosted project |
| `the developer server … did not answer` | The first compile took too long, or the server crashed; read `host.log` above it | Rerun once the machine is quieter; a crash is a finding |
| An account cannot sign in | The stack was reset under the host | Stop the host and start it again; it makes new accounts |
| `[qa] stopped, with accounts left behind` | The accounts could not be removed, usually because the stack was reset under the host | Nothing to do after a reset; otherwise the line above it gives the reason, and the `@test.local` accounts hold only what the session made |
| An image reference is shown as text in the posted comment | The attachment did not upload | `gh pr comment --edit-last` with the attachments again |

## Never

- Seed, reset, purge or sweep a shared database to get a fixture: it wipes every neighbour's data.
- Run the host against a hosted database: `tests/helpers.ts` refuses it, and that check stays.
- Upload evidence you have not read: the data is synthetic, but the habit protects production
  screenshots.
