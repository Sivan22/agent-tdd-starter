import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { runQaHost } from "../../scripts/qa/host";

const io = vi.hoisted(() => ({ events: [] as string[], serverFails: false, userThatFails: "" }));

vi.mock("node:child_process", () => ({
  execFileSync: (_git: string, args: string[]) => (args[0] === "rev-parse" ? "abc123\n" : ""),
  spawn: (_cli: string, args: string[], options: { cwd: string }) => {
    io.events.push(`cli ${args.slice(1).join(" ")} in ${options.cwd}`);
    const child = new EventEmitter();
    setImmediate(() => child.emit("exit", 0));
    return child;
  },
}));
vi.mock("../helpers", () => ({
  createTestUser: async (label: string) => {
    if (label === io.userThatFails) throw new Error("the Auth API refused the user");
    io.events.push(`user ${label} created`);
    return { id: `id-${label}`, email: `${label}@test.local`, password: `pw-${label}`, client: { secretKey: "never in the report" } };
  },
  deleteTestUsers: async (users: readonly { id: string }[]) => {
    io.events.push(`users removed: ${users.map((user) => user.id).join(" ")}`);
  },
}));
vi.mock("../../e2e/dev-server", async (importActual) => ({
  ...(await importActual<typeof import("../../e2e/dev-server")>()),
  requireFreePort: async (port: number) => io.events.push(`port ${port} free`),
  startDevServer: async (port: number) => {
    io.events.push(`server started on ${port}`);
    if (io.serverFails) throw new Error("the developer server did not answer within 120 s");
    return { url: `http://127.0.0.1:${port}`, stop: async () => void io.events.push("server stopped") };
  },
}));

let dir = "";
beforeEach(() => {
  io.events = [];
  io.serverFails = false;
  io.userThatFails = "";
  dir = mkdtempSync(join(tmpdir(), "qa-host-"));
  vi.stubEnv("QA_DIR", dir);
  vi.stubEnv("QA_SESSION", "qa-test");
  vi.stubEnv("E2E_PORT", "3399");
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

const open = () => `cli -s=qa-test open --config=${join(dir, "cli.json")} http://127.0.0.1:3399/login in ${dir}`;
const close = () => `cli -s=qa-test close in ${dir}`;
const isReady = () => existsSync(join(dir, "ready.json"));
const untilReady = () => vi.waitFor(() => expect(isReady()).toBe(true), { timeout: 5000 });

it("starts the server, makes its accounts, opens the browser, reports ready, and removes everything on the stop file", async () => {
  const run = runQaHost();
  await untilReady();
  const ready = JSON.parse(readFileSync(join(dir, "ready.json"), "utf8"));
  expect(ready).toMatchObject({
    url: "http://127.0.0.1:3399",
    login: "http://127.0.0.1:3399/login",
    session: "qa-test",
    commit: "abc123",
    worktree: process.cwd(),
    stop: `touch ${join(dir, "stop")}`,
    reopen: `touch ${join(dir, "reopen")}`,
  });
  expect(ready.cli).toContain(`cd ${dir} && `);
  expect(ready.cli).toContain("playwright cli -s=qa-test <command>");
  expect(ready.logins).toEqual([
    { label: "qa", email: "qa@test.local", password: "pw-qa" },
    { label: "qa-other", email: "qa-other@test.local", password: "pw-qa-other" },
  ]);
  writeFileSync(join(dir, "stop"), "");
  await run;
  expect(io.events).toEqual([
    "port 3399 free",
    "server started on 3399",
    "user qa created",
    "user qa-other created",
    open(),
    close(),
    "users removed: id-qa id-qa-other",
    "server stopped",
  ]);
  expect(isReady()).toBe(false);
});

it("opens the browser again on the login page when asked, and the session goes on", async () => {
  const run = runQaHost();
  await untilReady();
  writeFileSync(join(dir, "reopen"), "");
  await vi.waitFor(() => expect(existsSync(join(dir, "reopen"))).toBe(false), { timeout: 5000 });
  expect(isReady()).toBe(true);
  writeFileSync(join(dir, "stop"), "");
  await run;
  expect(io.events.filter((event) => event === open())).toHaveLength(2);
});

it("makes no account and never reports ready when the server cannot come up", async () => {
  io.serverFails = true;
  await expect(runQaHost()).rejects.toThrow("did not answer");
  expect(io.events).toEqual(["port 3399 free", "server started on 3399"]);
  expect(isReady()).toBe(false);
});

it("removes the accounts it made and stops the server when a later account fails", async () => {
  io.userThatFails = "qa-other";
  await expect(runQaHost()).rejects.toThrow("refused the user");
  expect(io.events).toContain("users removed: id-qa");
  expect(io.events.at(-1)).toBe("server stopped");
  expect(isReady()).toBe(false);
});

it("a stop file left by an earlier session does not end the new one before it is ready", async () => {
  writeFileSync(join(dir, "stop"), "");
  const run = runQaHost();
  await untilReady();
  writeFileSync(join(dir, "stop"), "");
  await run;
});

it("does not let a report left by a killed session pass for this one", async () => {
  writeFileSync(join(dir, "ready.json"), '{"commit":"stale"}');
  io.serverFails = true;
  await expect(runQaHost()).rejects.toThrow("did not answer");
  expect(isReady()).toBe(false);
});

it("ends by itself after QA_HOURS, as if stopped, when nobody stops it", async () => {
  vi.stubEnv("QA_HOURS", String(1 / 3600));
  await runQaHost();
  expect(io.events.slice(-3)).toEqual([close(), "users removed: id-qa id-qa-other", "server stopped"]);
  expect(isReady()).toBe(false);
});

it.each(["SIGINT", "SIGTERM"] as const)("cleans up as if stopped when it receives %s", async (signal) => {
  const before = process.listenerCount(signal);
  const run = runQaHost();
  await untilReady();
  process.emit(signal);
  await run;
  expect(io.events.slice(-3)).toEqual([close(), "users removed: id-qa id-qa-other", "server stopped"]);
  expect(process.listenerCount(signal)).toBe(before);
});

it("refuses an evidence directory inside the worktree, before starting anything", async () => {
  vi.stubEnv("QA_DIR", join(process.cwd(), "qa-evidence"));
  await expect(runQaHost()).rejects.toThrow("outside the worktree");
  vi.stubEnv("QA_DIR", "relative/qa");
  await expect(runQaHost()).rejects.toThrow("outside the worktree");
  vi.stubEnv("QA_DIR", `${process.cwd()}/..evidence`);
  await expect(runQaHost()).rejects.toThrow("outside the worktree");
  expect(io.events).toEqual([]);
});

it("refuses a session length that is not a positive number of hours, before starting anything", async () => {
  vi.stubEnv("QA_HOURS", "0");
  await expect(runQaHost()).rejects.toThrow("positive number of hours");
  vi.stubEnv("QA_HOURS", "soon");
  await expect(runQaHost()).rejects.toThrow("positive number of hours");
  expect(io.events).toEqual([]);
});
