/**
 * `scripts/check-migrations-immutable.sh <base>` refuses a change that edits, renames or deletes a
 * migration the base already has: production records every applied version, and a build whose
 * tree lacks one of them can never migrate again.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = path.resolve(import.meta.dirname, "../../scripts/check-migrations-immutable.sh");
let repo = "";
let base = "";

const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
const write = (rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
  fs.writeFileSync(path.join(repo, rel), text);
};
const check = (against = base) => {
  const result = spawnSync("bash", [SCRIPT, against], { cwd: repo, encoding: "utf8" });
  return { status: result.status, out: result.stdout + result.stderr };
};

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "migrations-"));
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.test");
  git("config", "user.name", "test");
  write("supabase/migrations/0001_notes.sql", "create table notes ();\n");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  base = git("rev-parse", "HEAD");
});

afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

describe("check-migrations-immutable.sh", () => {
  it("accepts a change that only adds migrations", () => {
    write("supabase/migrations/0002_more.sql", "select 1;\n");
    git("add", "-A");
    git("commit", "-q", "-m", "add");
    expect(check().status).toBe(0);
  });

  it("refuses an edited, deleted or renamed migration, committed or not, and names it", () => {
    write("supabase/migrations/0001_notes.sql", "create table notes (id int);\n");
    expect(check()).toMatchObject({ status: 1, out: expect.stringContaining("0001_notes.sql") });
    git("checkout", "-q", "--", ".");

    git("rm", "-q", "supabase/migrations/0001_notes.sql");
    git("commit", "-q", "-m", "revert");
    expect(check()).toMatchObject({ status: 1, out: expect.stringContaining("0001_notes.sql") });
    git("reset", "-q", "--hard", base);

    git("mv", "supabase/migrations/0001_notes.sql", "supabase/migrations/0003_notes.sql");
    git("commit", "-q", "-m", "renumber");
    expect(check()).toMatchObject({ status: 1, out: expect.stringContaining("0001_notes.sql") });
  });

  it("has nothing to compare against an all-zero or unknown base, as on a repository's first push", () => {
    for (const none of ["0000000000000000000000000000000000000000", ""]) {
      expect(check(none).status, JSON.stringify(none)).toBe(0);
    }
  });
});
