/**
 * The guard rails of `scripts/migrate-production.sh`, which the Vercel production build runs.
 * These cases never reach a database; applying migrations is checked against a real stack in
 * docs/runbooks/deploy.md.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = path.resolve(import.meta.dirname, "../../scripts/migrate-production.sh");

const run = (env: Record<string, string>) => {
  const result = spawnSync("bash", [SCRIPT], { env: { PATH: process.env.PATH ?? "", NODE_ENV: "test", ...env }, encoding: "utf8" });
  return { status: result.status, out: result.stdout + result.stderr };
};

describe("migrate-production.sh", () => {
  it("applies nothing outside a Vercel production build", () => {
    const builds: Record<string, string>[] = [{}, { VERCEL_ENV: "preview" }, { VERCEL_ENV: "development" }];
    for (const env of builds) {
      const { status, out } = run({ ...env, POSTGRES_URL_NON_POOLING: "postgresql://never:used@127.0.0.1:1/x" });
      expect(status, JSON.stringify(env)).toBe(0);
      expect(out).toContain("not a Vercel production build");
    }
  });

  it("fails a production build that has no database address, and says which variable is missing", () => {
    const { status, out } = run({ VERCEL_ENV: "production" });
    expect(status).toBe(1);
    expect(out).toContain("POSTGRES_URL_NON_POOLING");
  });
});
