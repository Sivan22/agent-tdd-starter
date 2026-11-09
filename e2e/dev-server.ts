/**
 * The developer server the browser checks run against: its port, its address and its command.
 * `playwright.config.ts` gives it to Playwright's web server, and `scripts/qa/host.ts` starts the
 * same server for the QA gate, so the suite and the QA agent always see the same application.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export const DEFAULT_E2E_PORT = 3100;

/** The port from `E2E_PORT`. Every run picks its own, so parallel worktrees never share a server. */
export function e2ePort(env: Record<string, string | undefined> = process.env): number {
  const raw = env.E2E_PORT;
  if (raw === undefined || raw === "") return DEFAULT_E2E_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`E2E_PORT must be a port between 1024 and 65535, not "${raw}"`);
  }
  return port;
}

export function baseUrlFor(port: number): string {
  return `http://127.0.0.1:${port}`;
}

/** The arguments to `next`. */
export function devServerArgs(port: number): string[] {
  return ["dev", "--hostname", "127.0.0.1", "--port", String(port)];
}

/** Fails when something already listens on the port: a neighbour's server would be tested instead. */
export async function requireFreePort(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();
    probe.once("error", (error: NodeJS.ErrnoException) => {
      reject(error.code === "EADDRINUSE" ? new Error(`port ${port} is in use; choose an unused E2E_PORT`) : error);
    });
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve()));
  });
}

export type DevServer = {
  readonly url: string;
  /** Ends the server and waits for it to exit. */
  stop(): Promise<void>;
};

/** Starts `next` from `cwd` on `port` and resolves once it answers. Its output goes to this process's. */
export async function startDevServer(
  port: number,
  { cwd = process.cwd(), readyWithinMs = 180_000 }: { cwd?: string; readyWithinMs?: number } = {},
): Promise<DevServer> {
  const url = baseUrlFor(port);
  const child = spawn(path.join(cwd, "node_modules/.bin/next"), devServerArgs(port), { cwd, stdio: "inherit" });
  let gone = false;
  const exited = new Promise<void>((resolve) => {
    const finish = () => {
      gone = true;
      resolve();
    };
    child.once("exit", finish);
    child.once("error", finish);
  });

  const stop = async () => {
    if (gone) return;
    child.kill("SIGTERM");
    const outcome = await Promise.race([exited.then(() => "exited"), delay(10_000, "timeout")]);
    if (outcome === "timeout") {
      child.kill("SIGKILL");
      await exited;
    }
  };

  const deadline = Date.now() + readyWithinMs;
  while (Date.now() < deadline) {
    if (gone) throw new Error(`the developer server on port ${port} exited before it answered`);
    try {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
      if (response.status < 500) return { url, stop };
    } catch {
      // Not listening yet, or the first compile is still running.
    }
    await delay(250);
  }
  await stop();
  throw new Error(`the developer server on port ${port} did not answer within ${Math.round(readyWithinMs / 1000)} s`);
}
