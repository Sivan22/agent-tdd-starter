/**
 * The pure pieces of the documentation checker in `scripts/docs/model.ts`: glob matching for
 * `covers`, the frontmatter reader, link anchors, the patterns a current-state document may not
 * contain, and the inventories the generator derives from code.
 */
import { describe, expect, it } from "vitest";
import {
  backtickedRepoPaths,
  bannedPatternHits,
  bucketsFromMigration,
  citedDocPaths,
  envNamesIn,
  shellEnvNamesIn,
  globToRegExp,
  isLineAnchor,
  owedDocs,
  parseFrontmatter,
  routeUrl,
  slug,
} from "@/scripts/docs/model";

describe("globToRegExp", () => {
  it("matches a directory tree with **", () => {
    const re = globToRegExp("lib/notes/**");
    expect(re.test("lib/notes/input.ts")).toBe(true);
    expect(re.test("lib/notes/deep/x.ts")).toBe(true);
    expect(re.test("lib/notesx/a.ts")).toBe(false);
  });

  it("keeps Next.js brackets and route groups literal", () => {
    const re = globToRegExp("app/notes/[id]/(tabs)/**");
    expect(re.test("app/notes/[id]/(tabs)/layout.tsx")).toBe(true);
    expect(re.test("app/notes/i/(tabs)/layout.tsx")).toBe(false);
  });

  it("matches one segment with *", () => {
    const re = globToRegExp("lib/*.ts");
    expect(re.test("lib/env.ts")).toBe(true);
    expect(re.test("lib/notes/input.ts")).toBe(false);
  });

  it("matches any depth with a leading **/", () => {
    const re = globToRegExp("**/actions.ts");
    expect(re.test("app/notes/actions.ts")).toBe(true);
    expect(re.test("actions.ts")).toBe(true);
  });
});

describe("parseFrontmatter", () => {
  it("reads summary and covers", () => {
    expect(parseFrontmatter("---\nsummary: Notes.\ncovers:\n  - lib/notes/**\n  - app/notes/**\n---\n# Notes\n")).toEqual({
      ok: true,
      summary: "Notes.",
      covers: ["lib/notes/**", "app/notes/**"],
      body: "# Notes\n",
    });
  });

  it("reports a document without frontmatter", () => {
    expect(parseFrontmatter("# Title\n")).toEqual({ ok: false, error: "missing frontmatter" });
  });

  it("refuses an unknown key", () => {
    expect(parseFrontmatter("---\nsummary: x\nowner: me\n---\n# T\n")).toEqual({ ok: false, error: "unknown frontmatter key: owner" });
  });
});

describe("slug", () => {
  it("follows GitHub's anchor rules", () => {
    expect(slug("When it goes wrong")).toBe("when-it-goes-wrong");
    expect(slug("2026-10-07 — Notes are private")).toBe("2026-10-07--notes-are-private");
    expect(slug("Notizen für «Mittwoch» before `§22`")).toBe("notizen-für-mittwoch-before-22");
  });
});

describe("bannedPatternHits", () => {
  it("finds ticket ids, issue numbers, migration marks, review banners and line numbers", () => {
    const text = [
      "Refunds (APP-398) are offsets.",
      "Since PR #72 the run continues.",
      "The checkout reaches 0209.",
      "Reviewed against the repository on **2026-10-05**.",
      "See `lib/notes/input.ts:57`.",
    ].join("\n");
    expect(bannedPatternHits(text).map((h) => h.rule)).toEqual([
      "ticket id",
      "pull request or issue number",
      "migration high-water claim",
      "review-date banner",
      "line-number citation",
    ]);
  });

  it("treats a GitHub line anchor as a line-number citation", () => {
    expect(bannedPatternHits("See [the guard](../../lib/auth.ts#L40-L52).").map((h) => h.rule)).toEqual(["line-number citation"]);
  });

  it("allows years and large counts after through and up to", () => {
    expect(bannedPatternHits("A page lists up to 1000 notes. Prices hold through 2027.")).toEqual([]);
  });

  it("allows migration file names, plain numbers and colours", () => {
    expect(bannedPatternHits("`supabase/migrations/0001_notes.sql` holds 120 characters; `#000000`.")).toEqual([]);
  });
});

describe("backtickedRepoPaths", () => {
  it("picks repository paths and skips placeholders and plain words", () => {
    const text = "Edit `lib/env.ts`, run `pnpm docs:check`, open `/notes/<id>`, read `app/notes/<id>/page.tsx` and `scripts/*.sh`.";
    expect(backtickedRepoPaths(text)).toEqual(["lib/env.ts", "scripts/*.sh"]);
  });

  it("recognises root files", () => {
    expect(backtickedRepoPaths("`proxy.ts`, `vercel.json` and `playwright.config.ts`")).toEqual(["proxy.ts", "vercel.json", "playwright.config.ts"]);
  });
});

describe("routeUrl", () => {
  it("drops route groups and the page or route file", () => {
    expect(routeUrl("app/(public)/page.tsx")).toBe("/");
    expect(routeUrl("app/notes/[id]/(tabs)/page.tsx")).toBe("/notes/[id]");
    expect(routeUrl("app/api/health/route.ts")).toBe("/api/health");
  });
});

describe("owedDocs", () => {
  const docs = [
    { path: "docs/system/notes.md", covers: ["lib/notes/**"] },
    { path: "docs/system/auth.md", covers: ["lib/auth/**"] },
  ];

  it("names a document whose code changed while it did not", () => {
    expect(owedDocs(["lib/notes/input.ts", "lib/auth/session.ts", "docs/system/auth.md"], docs)).toEqual([
      { doc: "docs/system/notes.md", files: ["lib/notes/input.ts"] },
    ]);
  });
});

describe("citedDocPaths", () => {
  it("finds repository document paths and skips other packages' docs folders", () => {
    const src = "See docs/system/notes.md and node_modules/next/dist/docs/01-app/02-guides/forms.md.";
    expect(citedDocPaths(src).map((c) => c.path)).toEqual(["docs/system/notes.md"]);
  });

  it("reads a path written relative to a nested file as a repository path", () => {
    expect(citedDocPaths('path.resolve(__dirname, "../../docs/db/README.md")').map((c) => c.path)).toEqual(["docs/db/README.md"]);
  });
});

describe("isLineAnchor", () => {
  it("recognises GitHub line anchors, which have no heading", () => {
    expect(isLineAnchor("L72-L105")).toBe(true);
    expect(isLineAnchor("L7")).toBe(true);
    expect(isLineAnchor("when-it-goes-wrong")).toBe(false);
  });
});

describe("bucketsFromMigration", () => {
  it("reads each bucket id from storage.buckets inserts", () => {
    const sql = [
      "insert into storage.buckets (id, name, public) values ('avatars','avatars', false) on conflict (id) do nothing;",
      "insert into storage.buckets (id, name, public, allowed_mime_types)",
      "values (",
      "  'attachments',",
      "  'attachments', false, array['application/pdf']",
      "), ('exports', 'exports', false, array['text/csv']);",
    ].join("\n");
    expect(bucketsFromMigration(sql)).toEqual(["avatars", "attachments", "exports"]);
  });
});

describe("envNamesIn", () => {
  it("finds process.env and Deno.env reads", () => {
    const src = 'const a = process.env.CRON_SECRET; const b = process.env["EMAIL_MOCK"]; Deno.env.get("WEBHOOK_SECRET");';
    expect(envNamesIn(src)).toEqual(["CRON_SECRET", "EMAIL_MOCK", "WEBHOOK_SECRET"]);
  });

  it("finds names read through an env() or requiredEnv() helper", () => {
    const src = 'const from = env("EMAIL_FROM"); const key = requiredEnv("SUPABASE_SECRET_KEY"); const x = polishEnv("NOT_AN_ENV");';
    expect(envNamesIn(src)).toEqual(["EMAIL_FROM", "SUPABASE_SECRET_KEY"]);
  });

  it("finds names read from an env parameter that defaults to process.env", () => {
    const src = "function read(env: Record<string, string | undefined> = process.env) {\n  return env.APP_URL;\n}";
    expect(envNamesIn(src)).toEqual(["APP_URL"]);
  });

  it("finds every name in a computed key", () => {
    expect(envNamesIn('process.env[live ? "LIVE_KEY" : "TEST_KEY"] === "true"')).toEqual(["LIVE_KEY", "TEST_KEY"]);
  });
});

describe("shellEnvNamesIn", () => {
  it("finds the variables a shell script reads, and skips the shell's own", () => {
    const src = [
      'if [ "${VERCEL_ENV:-}" != "production" ]; then exit 0; fi',
      'db="${MIGRATIONS_DATABASE_URL:-${POSTGRES_URL_NON_POOLING:-}}"',
      'cd "$(dirname "${BASH_SOURCE[0]}")" && echo "$HOME $PATH ${PIPESTATUS[0]}"',
      'base="$SECRETS_BASE"; local_var="${lower_case:-x}"',
    ].join("\n");
    expect(shellEnvNamesIn(src)).toEqual(["VERCEL_ENV", "MIGRATIONS_DATABASE_URL", "POSTGRES_URL_NON_POOLING", "SECRETS_BASE"]);
  });
});
