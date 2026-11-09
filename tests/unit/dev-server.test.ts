import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { baseUrlFor, DEFAULT_E2E_PORT, devServerArgs, e2ePort, requireFreePort, startDevServer } from "../../e2e/dev-server";

const temporary: string[] = [];
afterEach(() => {
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A checkout whose `next` is the given script, so the real spawn, wait and stop run without a build. */
function checkoutWithNext(script: string): string {
  const cwd = mkdtempSync(join(tmpdir(), "dev-server-"));
  temporary.push(cwd);
  mkdirSync(join(cwd, "node_modules/.bin"), { recursive: true });
  const next = join(cwd, "node_modules/.bin/next");
  writeFileSync(next, `#!/usr/bin/env node\n${script}\n`);
  chmodSync(next, 0o755);
  return cwd;
}

function listening(): Promise<{ port: number; server: Server }> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") reject(new Error("no port"));
      else resolve({ port: address.port, server });
    });
  });
}

const closed = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()));

async function unusedPort(): Promise<number> {
  const { port, server } = await listening();
  await closed(server);
  return port;
}

const isRunning = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe("the port and address", () => {
  it("takes the port from E2E_PORT and falls back when it is unset or empty", () => {
    expect(e2ePort({ E2E_PORT: "3456" })).toBe(3456);
    expect(e2ePort({})).toBe(DEFAULT_E2E_PORT);
    expect(e2ePort({ E2E_PORT: "" })).toBe(DEFAULT_E2E_PORT);
  });

  it.each(["80", "70000", "31.5", "soon"])("refuses %s as a port", (raw) => {
    expect(() => e2ePort({ E2E_PORT: raw })).toThrow("E2E_PORT must be a port");
  });

  it("serves on the loopback address, never on every interface", () => {
    expect(baseUrlFor(3456)).toBe("http://127.0.0.1:3456");
    expect(devServerArgs(3456)).toEqual(["dev", "--hostname", "127.0.0.1", "--port", "3456"]);
  });
});

describe("requireFreePort", () => {
  it("accepts a free port and names the variable to change for a taken one", async () => {
    const { port, server } = await listening();
    await expect(requireFreePort(port)).rejects.toThrow(`port ${port} is in use; choose an unused E2E_PORT`);
    await closed(server);
    await expect(requireFreePort(port)).resolves.toBeUndefined();
  });
});

describe("startDevServer", () => {
  const listensOnItsPort = `
    require("node:fs").writeFileSync("args.json", JSON.stringify(process.argv.slice(2)));
    const port = Number(process.argv[process.argv.indexOf("--port") + 1]);
    require("node:http").createServer((_request, response) => response.end("ok")).listen(port, "127.0.0.1");
  `;

  it("runs next with the suite's arguments, waits until it answers, and stop ends it", async () => {
    const cwd = checkoutWithNext(listensOnItsPort);
    const port = await unusedPort();
    const server = await startDevServer(port, { cwd });
    expect(server.url).toBe(`http://127.0.0.1:${port}`);
    expect(JSON.parse(readFileSync(join(cwd, "args.json"), "utf8"))).toEqual(devServerArgs(port));
    expect((await fetch(server.url)).status).toBe(200);
    await server.stop();
    await expect(fetch(server.url)).rejects.toThrow();
  });

  it("reports a server that exits before it answers", async () => {
    const cwd = checkoutWithNext("process.exit(3);");
    await expect(startDevServer(await unusedPort(), { cwd })).rejects.toThrow("exited before it answered");
  });

  it("gives up on a server that never answers, and leaves no process behind", async () => {
    const cwd = checkoutWithNext(`
      require("node:fs").writeFileSync("pid", String(process.pid));
      setInterval(() => {}, 1000);
    `);
    await expect(startDevServer(await unusedPort(), { cwd, readyWithinMs: 800 })).rejects.toThrow("did not answer within");
    expect(existsSync(join(cwd, "pid"))).toBe(true);
    expect(isRunning(Number(readFileSync(join(cwd, "pid"), "utf8")))).toBe(false);
  });
});
