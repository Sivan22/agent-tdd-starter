/**
 * The contract of `scripts/migrate-production.sh`, which every Vercel build runs after
 * `pnpm build`. A fake `pnpm` on PATH records the command the script would run, so these cases
 * never reach a database. docs/runbooks/deploy.md records the script against a real stack.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SCRIPT = path.resolve(import.meta.dirname, "../../scripts/migrate-production.sh");
const PROD_URL = "postgresql://user:secret-password@db.example.test:5432/postgres";
const GIT_MAIN = { VERCEL_ENV: "production", VERCEL_GIT_PROVIDER: "github", VERCEL_GIT_COMMIT_REF: "main" };

let bin = "";
let calls = "";

beforeAll(() => {
  bin = fs.mkdtempSync(path.join(os.tmpdir(), "fake-pnpm-"));
  calls = path.join(bin, "calls.txt");
  fs.writeFileSync(path.join(bin, "pnpm"), `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "${calls}"\nexit "\${FAKE_PNPM_EXIT:-0}"\n`, { mode: 0o755 });
});

afterAll(() => fs.rmSync(bin, { recursive: true, force: true }));

const run = (env: Record<string, string>) => {
  fs.rmSync(calls, { force: true });
  const result = spawnSync("bash", [SCRIPT], {
    env: { PATH: `${bin}:/usr/bin:/bin`, NODE_ENV: "test", ...env },
    encoding: "utf8",
  });
  const ran = fs.existsSync(calls) ? fs.readFileSync(calls, "utf8").trim() : "";
  return { status: result.status, out: result.stdout + result.stderr, ran };
};

describe("migrate-production.sh", () => {
  it("applies nothing on a local, CI or preview build", () => {
    const builds: Record<string, string>[] = [{}, { VERCEL_ENV: "preview" }, { VERCEL_ENV: "development" }];
    for (const env of builds) {
      const { status, out, ran } = run(env);
      expect(status, JSON.stringify(env)).toBe(0);
      expect(out).toContain("nothing applied");
      expect(ran).toBe("");
    }
  });

  it("fails when a database address is set but the build cannot tell which environment it is", () => {
    const { status, out, ran } = run({ POSTGRES_URL_NON_POOLING: PROD_URL });
    expect(status).toBe(1);
    expect(out).toContain("VERCEL_ENV");
    expect(ran).toBe("");
  });

  it("refuses a production build that did not come from main through Git", () => {
    const builds: Record<string, string>[] = [
      { VERCEL_ENV: "production", POSTGRES_URL_NON_POOLING: PROD_URL },
      { ...GIT_MAIN, VERCEL_GIT_COMMIT_REF: "001-feature", POSTGRES_URL_NON_POOLING: PROD_URL },
    ];
    for (const env of builds) {
      const { status, out, ran } = run(env);
      expect(status, JSON.stringify(env)).toBe(1);
      expect(out).toContain("main");
      expect(ran).toBe("");
    }
  });

  it("fails a production build of main that has no database address, naming the variable", () => {
    const { status, out } = run(GIT_MAIN);
    expect(status).toBe(1);
    expect(out).toContain("POSTGRES_URL_NON_POOLING");
  });

  it("pushes to the production database without --include-all and never prints its address", () => {
    const { status, out, ran } = run({ ...GIT_MAIN, POSTGRES_URL_NON_POOLING: PROD_URL });
    expect(status).toBe(0);
    expect(ran).toBe(`exec supabase db push --db-url ${PROD_URL} --yes`);
    expect(out).not.toContain("secret-password");
  });

  it("prefers MIGRATIONS_DATABASE_URL when it is set", () => {
    const override = "postgresql://user:other@pooler.example.test:5432/postgres";
    const { ran } = run({ ...GIT_MAIN, POSTGRES_URL_NON_POOLING: PROD_URL, MIGRATIONS_DATABASE_URL: override });
    expect(ran).toBe(`exec supabase db push --db-url ${override} --yes`);
  });

  it("fails the build when the push fails", () => {
    const { status } = run({ ...GIT_MAIN, POSTGRES_URL_NON_POOLING: PROD_URL, FAKE_PNPM_EXIT: "1" });
    expect(status).toBe(1);
  });
});
