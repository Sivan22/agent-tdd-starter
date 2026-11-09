/**
 * The QA gate's host (docs/runbooks/qa.md): this worktree's application on the local stack, held
 * open for a QA agent that uses it step by step in a real headless Chromium through
 * `playwright cli`. It starts the developer server, makes disposable accounts, opens the browser
 * session on the login page, and writes `ready.json` into QA_DIR with the address, the commit
 * under test, the session and the logins. It ends when `QA_DIR/stop` appears, on SIGINT or
 * SIGTERM, or by itself after QA_HOURS (3 by default), and then closes the browser, removes the
 * accounts and everything they own, and stops the server. `QA_DIR/reopen` opens the browser again
 * when it closed.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { baseUrlFor, e2ePort, requireFreePort, startDevServer } from "../../e2e/dev-server";
import { createTestUser, deleteTestUsers, type TestUser } from "../../tests/helpers";

/** One account to work as, and one whose data the first must never see. */
const ACCOUNT_LABELS = ["qa", "qa-other"];
const LOGIN_PATH = "/login";
const SIGNALS = ["SIGINT", "SIGTERM"] as const;
/** A wedged browser must not hold up the cleanup, the stop file or the deadline. */
const CLI_TIME_LIMIT_MS = 180_000;

/** The commit under test, which the verdict names: the branch may move while the session runs. */
function commitUnderTest(): string {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const changed = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim();
  return changed ? `${head} with uncommitted changes` : head;
}

export async function runQaHost(): Promise<void> {
  const dir = process.env.QA_DIR ?? "";
  const fromWorktree = relative(process.cwd(), dir);
  if (!isAbsolute(dir) || (fromWorktree !== ".." && !fromWorktree.startsWith(`..${sep}`))) {
    throw new Error("QA_DIR must be an absolute directory outside the worktree; the evidence goes there");
  }
  const hours = Number(process.env.QA_HOURS || 3);
  if (!(hours > 0)) throw new Error("QA_HOURS must be a positive number of hours");

  const port = e2ePort();
  const session = process.env.QA_SESSION || `qa-${port}`;
  const playwright = join(process.cwd(), "node_modules/.bin/playwright");
  const url = baseUrlFor(port);
  const login = `${url}${LOGIN_PATH}`;
  const ready = join(dir, "ready.json");
  const stop = join(dir, "stop");
  const reopen = join(dir, "reopen");

  /** `playwright cli` run in QA_DIR, where it keeps its files; `open` leaves the session's browser running. */
  const cli = (args: string[]) =>
    new Promise<void>((resolve, reject) => {
      const child = spawn(playwright, ["cli", `-s=${session}`, ...args], { cwd: dir, stdio: "inherit", timeout: CLI_TIME_LIMIT_MS });
      child.once("error", reject);
      child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`playwright cli ${args[0]} exited ${code}`))));
    });

  // A report from a killed session goes first, so a refused start cannot pass for a ready one.
  await mkdir(dir, { recursive: true });
  await rm(ready, { force: true });
  await requireFreePort(port);
  for (const leftover of [stop, reopen]) await rm(leftover, { force: true });

  // Nothing outside this process cleans up after it, so a signal ends the session as a stop does.
  let signalled = false;
  const onSignal = () => {
    signalled = true;
  };
  for (const signal of SIGNALS) process.on(signal, onSignal);

  const leftBehind: string[] = [];
  try {
    const server = await startDevServer(port);
    const users: TestUser[] = [];
    try {
      const logins: { label: string; email: string; password: string }[] = [];
      for (const label of ACCOUNT_LABELS) {
        const user = await createTestUser(label);
        users.push(user);
        logins.push({ label, email: user.email, password: user.password });
      }

      const config = join(dir, "cli.json");
      await writeFile(config, JSON.stringify({ browser: { browserName: "chromium", launchOptions: { headless: true } } }));
      const open = () => cli(["open", `--config=${config}`, login]);
      await open();

      const report = {
        url,
        login,
        session,
        commit: commitUnderTest(),
        worktree: process.cwd(),
        cli: `cd ${dir} && ${playwright} cli -s=${session} <command>`,
        stop: `touch ${stop}`,
        reopen: `touch ${reopen}`,
        logins,
      };
      await writeFile(ready, `${JSON.stringify(report, null, 2)}\n`);
      process.stdout.write(`[qa] READY ${url} session ${session} at ${report.commit}\n`);

      const end = Date.now() + hours * 3_600_000;
      while (!existsSync(stop) && !signalled) {
        if (Date.now() >= end) {
          process.stdout.write(`[qa] ${hours} h passed without a stop: ending the session\n`);
          break;
        }
        if (existsSync(reopen)) {
          await rm(reopen, { force: true });
          await open().catch((error: unknown) => {
            process.stdout.write(`[qa] could not open the browser again: ${error instanceof Error ? error.message : error}\n`);
          });
        }
        await delay(500);
      }
    } finally {
      await rm(ready, { force: true });
      await cli(["close"]).catch((error: unknown) => {
        leftBehind.push("the browser");
        process.stdout.write(`[qa] could not close the browser: ${error instanceof Error ? error.message : error}\n`);
      });
      try {
        await deleteTestUsers(users);
      } catch (error) {
        leftBehind.push("accounts");
        process.stdout.write(`[qa] could not remove the accounts: ${error instanceof Error ? error.message : error}\n`);
      } finally {
        await server.stop();
      }
    }
  } finally {
    for (const signal of SIGNALS) process.off(signal, onSignal);
  }
  process.stdout.write(leftBehind.length ? `[qa] stopped, with ${leftBehind.join(" and ")} left behind\n` : "[qa] stopped and cleaned up\n");
}
